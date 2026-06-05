import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { createMockAnalysisProvider, type AnalysisProvider, validateAnalyzerOutput } from './analyzer.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

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

export function getAnalysisArtifacts(repos: Repositories, analysisRunId: string) {
  const analysisRun = repos.analysisRuns.findById(analysisRunId);
  if (!analysisRun) return null;

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

  try {
    const output = validateAnalyzerOutput(await provider.analyze({ store, selectedItems }));
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
    const completedAt = nowIso();
    repos.analysisRuns.update(analysisRun.id, {
      status: 'completed',
      completedAt,
      result: {
        ...asRecord(analysisRun.result),
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
