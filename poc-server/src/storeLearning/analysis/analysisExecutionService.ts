import type { JsonValue } from '../../repositories/base.js';
import type { AnalysisEvidence } from '../../repositories/analysis_evidence.js';
import type { AnalysisRun } from '../../repositories/analysis_runs.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { LearningSnapshot } from '../../repositories/learning_snapshots.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { createMockAnalysisProvider, type AnalysisProvider, validateAnalyzerOutput } from './analyzer.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;
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
  const collectedItems = repos.collectionItems
    .listByRunId(run.collectionRunId)
    .filter((item) => item.storeId === run.storeId && item.status === 'collected');

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
    const output = validateAnalyzerOutput(await provider.analyze({ store, selectedItems }));
    updateAnalysisProgress(repos, analysisRun.id, 'validating', 'running');
    validateAnalyzerReferences(output, selectedItems);
    updateAnalysisProgress(repos, analysisRun.id, 'evidence', 'running');
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
          mode: provider.mode
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
        imageDirection: output.imageDirection,
        negativeExpressions: output.negativeExpressions,
        evidenceItemIds: selectedItems.map((item) => item.id),
        provider: provider.name,
        mode: provider.mode
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
        imageDirection: output.imageDirection,
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
        analyzerMode: provider.mode,
        analyzerProvider: provider.name,
        output,
        learningSnapshotId: snapshot.id,
        marketingRulesetId: ruleset.id,
        analysisEvidenceIds: evidenceRows.map((evidence) => evidence.id),
        rulesetFieldIds: rulesetFields.map((field) => field.id)
      },
      error: null
    });

    return getAnalysisArtifacts(repos, analysisRun.id);
  } catch (error) {
    updateAnalysisProgress(
      repos,
      analysisRun.id,
      'failed',
      'failed',
      error instanceof Error ? error.message : progressMessages.failed
    );
    repos.analysisRuns.update(analysisRun.id, {
      status: 'failed',
      completedAt: nowIso(),
      error: {
        message: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}
