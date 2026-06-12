import type { JsonValue } from '../../repositories/base.js';
import type { AnalysisEvidence } from '../../repositories/analysis_evidence.js';
import type { AnalysisRun } from '../../repositories/analysis_runs.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { LearningSnapshot } from '../../repositories/learning_snapshots.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { recordLlmAuditLog } from '../llmAudit/llmAuditRecorder.js';
import {
  REQUIRED_ANALYZER_RULESET_FIELD_KEYS,
  canonicalRulesetFieldKey,
  sourceMatrixForFieldKey
} from '../rulesets/rulesetSourceMatrix.js';
import type { BlockedAnalyzerRulesetField } from './analysisPromptBudget.js';
import { createMockAnalysisProvider, type AnalysisProvider, validateAnalyzerOutput } from './analyzer.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;
type ValidatedAnalyzerOutput = ReturnType<typeof validateAnalyzerOutput>;
export type AnalysisArtifacts = {
  analysisRun: AnalysisRun;
  analysisEvidence: AnalysisEvidence[];
  learningSnapshot: LearningSnapshot | null;
  marketingRuleset: MarketingRuleset | null;
  rulesetFields: RulesetField[];
};
type AnalysisProgressState = 'waiting' | 'running' | 'done' | 'failed';
type AnalysisProgressStep =
  | 'preparing'
  | 'analyzing'
  | 'validating'
  | 'evidence'
  | 'snapshot'
  | 'ruleset'
  | 'ruleset_fields'
  | 'completed'
  | 'failed';

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBlockedFields(value: unknown): BlockedAnalyzerRulesetField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const fieldKey = asString(record.fieldKey);
    const label = asString(record.label);
    const section = asString(record.section);
    const reason = asString(record.reason);
    if (!fieldKey || !label || !section || !reason || record.source !== 'input_blocked') return [];
    return [
      {
        fieldKey,
        label,
        section: section as BlockedAnalyzerRulesetField['section'],
        reason: reason as BlockedAnalyzerRulesetField['reason'],
        source: 'input_blocked'
      }
    ];
  });
}

function providerRunMetadata(provider: AnalysisProvider, selectedItems: CollectionItem[]) {
  const metadata = asRecord(provider.getLastRunMetadata?.());
  return {
    analyzerMode: provider.mode,
    analyzerProvider: provider.name,
    analyzerModel: provider.model ?? null,
    selectedItemCount: asNumber(metadata.selectedItemCount) ?? selectedItems.length,
    promptItemCount: asNumber(metadata.promptItemCount) ?? selectedItems.length,
    omittedItemCount: asNumber(metadata.omittedItemCount) ?? 0,
    blogItemLimit: asNumber(metadata.blogItemLimit),
    selectedBlogItemCount: asNumber(metadata.selectedBlogItemCount),
    promptBlogItemCount: asNumber(metadata.promptBlogItemCount),
    omittedBlogItemCount: asNumber(metadata.omittedBlogItemCount),
    reviewItemLimit: asNumber(metadata.reviewItemLimit),
    selectedReviewItemCount: asNumber(metadata.selectedReviewItemCount),
    promptReviewItemCount: asNumber(metadata.promptReviewItemCount),
    omittedReviewItemCount: asNumber(metadata.omittedReviewItemCount),
    promptCharacterCount: asNumber(metadata.promptCharacterCount),
    promptCharacterBudget: asNumber(metadata.promptCharacterBudget),
    bodyCharacterBudget: asNumber(metadata.bodyCharacterBudget),
    promptBudgetReason: asString(metadata.promptBudgetReason),
    evidenceItemIds: asStringArray(metadata.evidenceItemIds),
    requestedRulesetFieldKeys: asStringArray(metadata.requestedRulesetFieldKeys),
    blockedFields: asBlockedFields(metadata.blockedFields)
  };
}

const contextTooLargeMessage =
  '선택한 콘텐츠가 많아 분석 입력 한도를 초과했습니다. 일부 콘텐츠를 제외하거나 다시 수집 후 실행해주세요.';
const analysisContractMessage = 'AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다. 다시 실행해주세요.';

type AnalysisContractIssue =
  | 'missing_required_ruleset_fields'
  | 'duplicate_ruleset_fields'
  | 'unknown_ruleset_fields'
  | 'invalid_openai_ruleset_source';

class AnalysisContractError extends Error {
  readonly issue: AnalysisContractIssue;
  readonly fieldCount: number;

  constructor(issue: AnalysisContractIssue, fieldCount: number) {
    super(analysisContractMessage);
    this.name = 'AnalysisContractError';
    this.issue = issue;
    this.fieldCount = fieldCount;
  }
}

function isContextLengthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /maximum context length|context length|context_length|too many tokens|tokens/i.test(message);
}

function analysisErrorMetadata(error: unknown, provider: AnalysisProvider, selectedItems: CollectionItem[]) {
  if (error instanceof AnalysisContractError) {
    return {
      errorType: 'analysis_contract_invalid',
      message: analysisContractMessage,
      contractIssue: error.issue,
      contractFieldCount: error.fieldCount,
      ...providerRunMetadata(provider, selectedItems)
    };
  }

  if (!isContextLengthError(error)) {
    return {
      message: error instanceof Error ? error.message : String(error)
    };
  }

  return {
    errorType: 'analysis_context_too_large',
    message: contextTooLargeMessage,
    ...providerRunMetadata(provider, selectedItems)
  };
}

const progressLabels: Record<AnalysisProgressStep, string> = {
  preparing: '분석 준비',
  analyzing: 'AI 분석',
  validating: '결과 검증',
  evidence: '근거 저장',
  snapshot: '학습 스냅샷 저장',
  ruleset: '룰셋 생성',
  ruleset_fields: '룰셋 필드 저장',
  completed: '분석 완료',
  failed: '분석 실패'
};

const progressMessages: Record<AnalysisProgressStep, string> = {
  preparing: '선택한 콘텐츠와 매장 정보를 분석 입력으로 정리하고 있습니다.',
  analyzing: 'AI가 블로그, 플레이스, 리뷰 근거를 분석하고 있습니다. 이 단계가 가장 오래 걸릴 수 있습니다.',
  validating: 'AI 결과가 필수 형식과 근거 연결 조건을 만족하는지 검증하고 있습니다.',
  evidence: '분석에 사용된 콘텐츠 근거를 저장하고 있습니다.',
  snapshot: '학습 현황에서 사용할 매장 학습 스냅샷을 저장하고 있습니다.',
  ruleset: '마케팅 전략 룰셋 초안을 생성하고 있습니다.',
  ruleset_fields: '화면에서 편집할 수 있는 룰셋 항목을 저장하고 있습니다.',
  completed: '분석과 룰셋 생성이 완료되었습니다. 학습 현황 화면으로 이동합니다.',
  failed: '분석 실행 중 문제가 발생했습니다.'
};

function progressTimeline(value: unknown) {
  const progress = asRecord(value);
  const timeline = progress.timeline;
  return Array.isArray(timeline) ? timeline.filter((item) => typeof item === 'object' && item !== null) : [];
}

function updateAnalysisProgress(
  repos: Repositories,
  analysisRunId: string,
  step: AnalysisProgressStep,
  state: AnalysisProgressState,
  message = progressMessages[step]
) {
  const run = repos.analysisRuns.findById(analysisRunId);
  if (!run) return null;
  const result = asRecord(run.result);
  const previousProgress = asRecord(result.analysisProgress);
  const now = nowIso();
  const entry = {
    step,
    label: progressLabels[step],
    state,
    message,
    updatedAt: now
  };
  return repos.analysisRuns.update(analysisRunId, {
    result: {
      ...result,
      analysisProgress: {
        ...entry,
        startedAt: asString(previousProgress.startedAt) ?? run.startedAt ?? now,
        timeline: [...progressTimeline(previousProgress), entry]
      }
    }
  });
}

function sanitizeIdPart(value: string) {
  return value.replace(/[^0-9A-Za-z_-]/g, '_').replace(/_+/g, '_');
}

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function selectedItemIdsFromRun(result: JsonValue) {
  return asStringArray(asRecord(result).selectedItemIds);
}

function selectedItemsForRun(repos: Repositories, analysisRunId: string): CollectionItem[] {
  const run = repos.analysisRuns.findById(analysisRunId);
  if (!run) throw new Error(`Analysis run not found: ${analysisRunId}`);

  const selectedIdSet = new Set(selectedItemIdsFromRun(run.result));
  const collectedItems = (selectedIdSet.size > 0
    ? repos.collectionItems.listByStoreId(run.storeId)
    : repos.collectionItems.listByRunId(run.collectionRunId)
  ).filter((item) => item.storeId === run.storeId && item.status === 'collected');

  if (selectedIdSet.size === 0) return collectedItems.filter((item) => item.selectedForAnalysis === 1);
  return collectedItems.filter((item) => selectedIdSet.has(item.id));
}

function validateAnalyzerReferences(
  output: ReturnType<typeof validateAnalyzerOutput>,
  selectedItems: CollectionItem[]
) {
  const availableItemIds = new Set(selectedItems.map((item) => item.id));
  const referencedItemIds = new Set<string>();

  for (const evidence of output.evidence) {
    referencedItemIds.add(evidence.collectionItemId);
  }

  for (const field of output.rulesetFields) {
    for (const itemId of field.evidenceItemIds) {
      referencedItemIds.add(itemId);
    }
  }

  const missingItemIds = Array.from(referencedItemIds).filter((itemId) => !availableItemIds.has(itemId));
  if (missingItemIds.length > 0) {
    throw new Error(`Analyzer output referenced unavailable collection items: ${missingItemIds.join(', ')}`);
  }
}

function validateAnalyzerRulesetFieldContract(
  output: ReturnType<typeof validateAnalyzerOutput>,
  provider: AnalysisProvider
) {
  const requiredFieldKeys = new Set(REQUIRED_ANALYZER_RULESET_FIELD_KEYS);
  const metadata = asRecord(provider.getLastRunMetadata?.());
  const blockedFields = asBlockedFields(metadata.blockedFields);
  const blockedFieldKeys = new Set(blockedFields.map((field) => field.fieldKey));
  const requestedFieldKeysFromMetadata = asStringArray(metadata.requestedRulesetFieldKeys);
  const requestedFieldKeys =
    provider.mode === 'openai' && (requestedFieldKeysFromMetadata.length > 0 || blockedFieldKeys.size > 0)
      ? requestedFieldKeysFromMetadata
      : REQUIRED_ANALYZER_RULESET_FIELD_KEYS;
  const requestedFieldKeySet = new Set(requestedFieldKeys);
  const seenFieldKeys = new Set<string>();
  const duplicateFieldKeys = new Set<string>();
  const unknownFieldKeys = new Set<string>();
  const invalidOpenAISourceFieldKeys = new Set<string>();
  const contractCoverage = new Set([...requestedFieldKeySet, ...blockedFieldKeys]);
  const missingContractCoverage = REQUIRED_ANALYZER_RULESET_FIELD_KEYS.filter((fieldKey) => !contractCoverage.has(fieldKey));

  for (const field of output.rulesetFields) {
    if (seenFieldKeys.has(field.fieldKey)) {
      duplicateFieldKeys.add(field.fieldKey);
    }
    seenFieldKeys.add(field.fieldKey);
    if (!requiredFieldKeys.has(field.fieldKey)) {
      unknownFieldKeys.add(field.fieldKey);
    }
    if (provider.mode === 'openai' && requestedFieldKeySet.has(field.fieldKey) && field.source !== 'openai_analysis') {
      invalidOpenAISourceFieldKeys.add(field.fieldKey);
    }
    if (provider.mode === 'openai' && blockedFieldKeys.has(field.fieldKey) && field.source !== 'input_blocked') {
      invalidOpenAISourceFieldKeys.add(field.fieldKey);
    }
  }

  const missingFieldKeys = REQUIRED_ANALYZER_RULESET_FIELD_KEYS.filter((fieldKey) => !seenFieldKeys.has(fieldKey));
  if (missingFieldKeys.length > 0 || missingContractCoverage.length > 0) {
    throw new AnalysisContractError(
      'missing_required_ruleset_fields',
      missingFieldKeys.length + missingContractCoverage.length
    );
  }
  if (duplicateFieldKeys.size > 0) {
    throw new AnalysisContractError('duplicate_ruleset_fields', duplicateFieldKeys.size);
  }
  if (unknownFieldKeys.size > 0) {
    throw new AnalysisContractError('unknown_ruleset_fields', unknownFieldKeys.size);
  }
  if (invalidOpenAISourceFieldKeys.size > 0) {
    throw new AnalysisContractError('invalid_openai_ruleset_source', invalidOpenAISourceFieldKeys.size);
  }
}

function blockedFieldFinalValue(field: BlockedAnalyzerRulesetField) {
  if (field.reason === 'review_text_unavailable') {
    return `${field.label}은(는) 수집된 리뷰 본문 입력 데이터가 부족해 AI가 추론하지 않았습니다.`;
  }
  return `${field.label}은(는) 입력 데이터가 부족해 AI가 추론하지 않았습니다.`;
}

function appendBlockedInputRulesetFields(
  output: ReturnType<typeof validateAnalyzerOutput>,
  provider: AnalysisProvider
): ReturnType<typeof validateAnalyzerOutput> {
  if (provider.mode !== 'openai') return output;
  const blockedFields = asBlockedFields(asRecord(provider.getLastRunMetadata?.()).blockedFields);
  if (blockedFields.length === 0) return output;
  return {
    ...output,
    rulesetFields: [
      ...output.rulesetFields,
      ...blockedFields.map((field) => {
        const finalValue = blockedFieldFinalValue(field);
        return {
          fieldKey: field.fieldKey,
          aiValue: finalValue,
          userValue: null,
          finalValue,
          source: 'input_blocked',
          locked: false,
          evidenceItemIds: [],
          confidence: null
        };
      })
    ]
  };
}

function nextRulesetVersion(repos: Repositories, storeId: string) {
  return repos.marketingRulesets
    .listByStoreId(storeId)
    .reduce((max, ruleset) => Math.max(max, ruleset.version), 0) + 1;
}

function snapshotId(analysisRunId: string) {
  return `learning_snapshot_${analysisRunId}`;
}

function rulesetId(analysisRunId: string, version: number) {
  return `marketing_ruleset_${analysisRunId}_v${version}`;
}

function evidenceId(analysisRunId: string, index: number) {
  return `analysis_evidence_${analysisRunId}_${index + 1}`;
}

function rulesetFieldId(marketingRulesetId: string, fieldKey: string) {
  return `ruleset_field_${marketingRulesetId}_${sanitizeIdPart(fieldKey)}`;
}

function compactText(value: unknown, maxLength = 140) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function rulesetFieldLabel(fieldKey: string) {
  return sourceMatrixForFieldKey(fieldKey)?.label ?? fieldKey;
}

function rulesetFieldEvidenceAliases(fieldKey: string) {
  const aliases = new Set([fieldKey, canonicalRulesetFieldKey(fieldKey)]);
  if (fieldKey === 'storePositioning') aliases.add('positioning');
  return Array.from(aliases);
}

function fieldEvidenceByCollectionItemId(output: ValidatedAnalyzerOutput) {
  const evidenceSummaryByItemId = new Map(
    output.evidence.map((evidence) => [evidence.collectionItemId, evidence.summary])
  );
  const result = new Map<string, Record<string, { summary: string }>>();

  for (const field of output.rulesetFields) {
    const label = rulesetFieldLabel(field.fieldKey);
    const fieldValue = compactText(field.finalValue || field.aiValue);
    if (!fieldValue) continue;
    const aliases = rulesetFieldEvidenceAliases(field.fieldKey);
    for (const collectionItemId of field.evidenceItemIds) {
      const baseSummary = compactText(evidenceSummaryByItemId.get(collectionItemId));
      const summary = `${label} 산출 근거: ${fieldValue}${baseSummary ? `. 수집 근거: ${baseSummary}` : ''}`;
      const existing = result.get(collectionItemId) ?? {};
      for (const alias of aliases) {
        existing[alias] = { summary };
      }
      result.set(collectionItemId, existing);
    }
  }

  return result;
}

export function getAnalysisArtifacts(repos: Repositories, analysisRunId: string): AnalysisArtifacts | null {
  const analysisRun = repos.analysisRuns.findById(analysisRunId);
  if (!analysisRun) return null;

  const result = asRecord(analysisRun.result);
  const reusedAnalysisRunId = asString(result.reusedAnalysisRunId);
  if (reusedAnalysisRunId && reusedAnalysisRunId !== analysisRun.id) {
    const reusedArtifacts = getAnalysisArtifacts(repos, reusedAnalysisRunId);
    if (reusedArtifacts) {
      return {
        ...reusedArtifacts,
        analysisRun
      };
    }
  }

  const analysisEvidence = repos.analysisEvidence.listByAnalysisRunId(analysisRun.id);
  const learningSnapshot = latestByUpdatedAt(repos.learningSnapshots.listByAnalysisRunId(analysisRun.id));
  const marketingRuleset = learningSnapshot
    ? repos.marketingRulesets
        .listByStoreId(analysisRun.storeId)
        .find((ruleset) => ruleset.learningSnapshotId === learningSnapshot.id) ?? null
    : null;
  const rulesetFields = marketingRuleset ? repos.rulesetFields.listByRulesetId(marketingRuleset.id) : [];

  return {
    analysisRun,
    analysisEvidence,
    learningSnapshot,
    marketingRuleset,
    rulesetFields
  };
}

export function getLatestAnalysisArtifacts(repos: Repositories, storeId: string) {
  const runs = repos.analysisRuns
    .listByStoreId(storeId)
    .filter((run) => run.status === 'completed' || run.status === 'succeeded')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const run of runs) {
    const artifacts = getAnalysisArtifacts(repos, run.id);
    if (artifacts?.learningSnapshot && artifacts.marketingRuleset) return artifacts;
  }

  return null;
}

export async function startAnalysisRun(
  repos: Repositories,
  analysisRunId: string,
  provider: AnalysisProvider = createMockAnalysisProvider()
) {
  const analysisRun = repos.analysisRuns.findById(analysisRunId);
  if (!analysisRun) throw new Error(`Analysis run not found: ${analysisRunId}`);
  if (analysisRun.status === 'completed') return getAnalysisArtifacts(repos, analysisRun.id);

  const store = repos.stores.findById(analysisRun.storeId);
  if (!store) throw new Error(`Store not found: ${analysisRun.storeId}`);

  const selectedItems = selectedItemsForRun(repos, analysisRun.id);
  if (selectedItems.length === 0) throw new Error(`No selected collection items for analysis run: ${analysisRun.id}`);

  const startedAt = analysisRun.startedAt ?? nowIso();
  repos.analysisRuns.update(analysisRun.id, {
    status: 'analyzing',
    startedAt,
    error: null
  });
  updateAnalysisProgress(repos, analysisRun.id, 'preparing', 'running');

  try {
    updateAnalysisProgress(repos, analysisRun.id, 'analyzing', 'running');
    const output = appendBlockedInputRulesetFields(validateAnalyzerOutput(await provider.analyze({ store, selectedItems })), provider);
    const runMetadata = providerRunMetadata(provider, selectedItems);
    updateAnalysisProgress(repos, analysisRun.id, 'validating', 'running');
    validateAnalyzerRulesetFieldContract(output, provider);
    validateAnalyzerReferences(output, selectedItems);
    updateAnalysisProgress(repos, analysisRun.id, 'evidence', 'running');
    const fieldEvidenceByItemId = fieldEvidenceByCollectionItemId(output);
    const evidenceRows = output.evidence.map((evidence, index) =>
      repos.analysisEvidence.upsert({
        id: evidenceId(analysisRun.id, index),
        analysisRunId: analysisRun.id,
        collectionItemId: evidence.collectionItemId,
        evidenceType: evidence.evidenceType,
        summary: evidence.summary,
        score: evidence.score,
        metadata: {
          provider: provider.name,
          mode: provider.mode,
          model: runMetadata.analyzerModel,
          fieldEvidence: fieldEvidenceByItemId.get(evidence.collectionItemId) ?? {}
        }
      })
    );
    updateAnalysisProgress(repos, analysisRun.id, 'snapshot', 'running');
    const snapshot = repos.learningSnapshots.upsert({
      id: snapshotId(analysisRun.id),
      storeId: analysisRun.storeId,
      analysisRunId: analysisRun.id,
      status: 'active',
      snapshot: {
        storePositioning: output.storePositioning,
        keyStrengths: output.keyStrengths,
        targetCustomers: output.targetCustomers,
        toneAndManner: output.toneAndManner,
        blogWritingStyle: output.blogWritingStyle,
        seoKeywords: output.seoKeywords,
        ctaStyle: output.ctaStyle,
        negativeExpressions: output.negativeExpressions,
        evidenceItemIds: selectedItems.map((item) => item.id),
        provider: provider.name,
        mode: provider.mode,
        model: runMetadata.analyzerModel,
        promptItemCount: runMetadata.promptItemCount,
        omittedItemCount: runMetadata.omittedItemCount,
        blogItemLimit: runMetadata.blogItemLimit,
        promptBlogItemCount: runMetadata.promptBlogItemCount,
        omittedBlogItemCount: runMetadata.omittedBlogItemCount,
        reviewItemLimit: runMetadata.reviewItemLimit,
        promptReviewItemCount: runMetadata.promptReviewItemCount,
        omittedReviewItemCount: runMetadata.omittedReviewItemCount,
        promptBudgetReason: runMetadata.promptBudgetReason
      }
    });
    updateAnalysisProgress(repos, analysisRun.id, 'ruleset', 'running');
    const version = nextRulesetVersion(repos, analysisRun.storeId);
    const ruleset = repos.marketingRulesets.create({
      id: rulesetId(analysisRun.id, version),
      storeId: analysisRun.storeId,
      learningSnapshotId: snapshot.id,
      status: 'draft',
      version,
      ruleset: {
        storePositioning: output.storePositioning,
        keyStrengths: output.keyStrengths,
        targetCustomers: output.targetCustomers,
        toneAndManner: output.toneAndManner,
        blogWritingStyle: output.blogWritingStyle,
        seoKeywords: output.seoKeywords,
        ctaStyle: output.ctaStyle,
        negativeExpressions: output.negativeExpressions
      }
    });
    updateAnalysisProgress(repos, analysisRun.id, 'ruleset_fields', 'running');
    const rulesetFields = output.rulesetFields.map((field) =>
      repos.rulesetFields.upsert({
        id: rulesetFieldId(ruleset.id, field.fieldKey),
        rulesetId: ruleset.id,
        fieldKey: field.fieldKey,
        fieldValue: field.finalValue,
        aiValue: field.aiValue,
        userValue: field.userValue,
        finalValue: field.finalValue,
        source: field.source,
        locked: field.locked ? 1 : 0,
        evidenceItemIds: field.evidenceItemIds,
        confidence: field.confidence
      })
    );
    updateAnalysisProgress(repos, analysisRun.id, 'completed', 'done');
    const completedAt = nowIso();
    const latestRun = repos.analysisRuns.findById(analysisRun.id);
    const latestResult = asRecord(latestRun?.result);
    repos.analysisRuns.update(analysisRun.id, {
      status: 'completed',
      completedAt,
      result: {
        ...latestResult,
        ...runMetadata,
        output,
        learningSnapshotId: snapshot.id,
        marketingRulesetId: ruleset.id,
        analysisEvidenceIds: evidenceRows.map((evidence) => evidence.id),
        rulesetFieldIds: rulesetFields.map((field) => field.id)
      },
      error: null
    });
    recordLlmAuditLog(repos, {
      storeId: analysisRun.storeId,
      relatedEntityType: 'analysis_run',
      relatedEntityId: analysisRun.id,
      provider,
      model: runMetadata.analyzerModel,
      action: 'analyze_store_learning',
      status: 'completed',
      inputBudget: runMetadata,
      parsedOutputJson: output
    });

    return getAnalysisArtifacts(repos, analysisRun.id);
  } catch (error) {
    const storedError = analysisErrorMetadata(error, provider, selectedItems);
    const runMetadata = providerRunMetadata(provider, selectedItems);
    updateAnalysisProgress(
      repos,
      analysisRun.id,
      'failed',
      'failed',
      asString(storedError.message) ?? progressMessages.failed
    );
    repos.analysisRuns.update(analysisRun.id, {
      status: 'failed',
      completedAt: nowIso(),
      error: storedError
    });
    recordLlmAuditLog(repos, {
      storeId: analysisRun.storeId,
      relatedEntityType: 'analysis_run',
      relatedEntityId: analysisRun.id,
      provider,
      model: runMetadata.analyzerModel,
      action: 'analyze_store_learning',
      status: 'failed',
      inputBudget: runMetadata,
      errorJson: storedError
    });
    if (asString(asRecord(storedError).errorType) === 'analysis_context_too_large') {
      throw new Error(contextTooLargeMessage);
    }
    if (asString(asRecord(storedError).errorType) === 'analysis_contract_invalid') {
      throw new Error(analysisContractMessage);
    }
    throw error;
  }
}
