import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  INSUFFICIENT_NEW_EVIDENCE_MESSAGE,
  decideAnalysisExecution,
  type AnalysisExecutionDecision
} from '../analysis/analysisDecision.js';
import { getAnalysisArtifacts, getLatestAnalysisArtifacts, startAnalysisRun } from '../analysis/analysisExecutionService.js';
import type { AnalysisProvider } from '../analysis/analyzer.js';
import { createAnalysisProvider } from '../analysis/openAIAnalysisProvider.js';
import { createRulesetEvidenceClassifier } from '../learning/rulesetEvidenceState.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import { backfillRulesetContractFields } from '../rulesets/rulesetContractBackfill.js';

type AnalysisRunRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  provider?: AnalysisProvider;
};

const AnalysisRunCreateSchema = z.object({
  storeId: z.string().trim().min(1),
  collectionRunId: z.string().trim().min(1),
  selectedItemIds: z.array(z.string().trim().min(1)).default([])
});

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function analysisRunId(storeId: string) {
  return `analysis_run_${storeId}_${Date.now()}`;
}

function selectedCounts(items: CollectionItem[]) {
  return {
    blogPosts: items.filter((item) => item.channel === 'blog' && item.sourceType === 'post').length,
    placeProfiles: items.filter((item) => item.channel === 'place' && item.sourceType === 'profile').length,
    placeReviews: items.filter((item) => item.channel === 'place' && item.sourceType === 'review').length,
    total: items.length
  };
}

function reuseProgressMessage(reason: AnalysisExecutionDecision['reason']) {
  if (reason === 'insufficient_new_evidence_for_ruleset_regeneration') {
    return INSUFFICIENT_NEW_EVIDENCE_MESSAGE;
  }
  if (reason === 'latest_ruleset_contract_incomplete') {
    return '기존 룰셋 항목 보정이 필요한 상태로 기존 학습 결과를 재사용했습니다.';
  }
  if (reason === 'place_profile_fact_change_only') {
    return '매장 기본정보만 갱신되어 기존 학습 결과를 재사용했습니다.';
  }
  return '이전 수집 결과와 동일해 기존 학습 결과를 재사용했습니다.';
}

function skippedAnalysisProgress(now: string, reason: AnalysisExecutionDecision['reason']) {
  const entry = {
    step: 'completed',
    label: '분석 완료',
    state: 'done',
    message: reuseProgressMessage(reason),
    updatedAt: now
  };
  return {
    ...entry,
    startedAt: now,
    timeline: [entry]
  };
}

function latestLearningDecisionInput(latestArtifacts: ReturnType<typeof getLatestAnalysisArtifacts>) {
  if (!latestArtifacts?.learningSnapshot || !latestArtifacts.marketingRuleset) return null;
  return {
    analysisRunId: latestArtifacts.analysisRun.id,
    learningSnapshotId: latestArtifacts.learningSnapshot.id,
    marketingRulesetId: latestArtifacts.marketingRuleset.id,
    rulesetFieldKeys: latestArtifacts.rulesetFields.map((field) => field.fieldKey)
  };
}

function blockedDecisionMessage(decision: AnalysisExecutionDecision) {
  if (decision.reason === 'latest_ruleset_contract_incomplete') {
    return '기존 학습 결과의 룰셋 항목 보정이 필요합니다. 보정 후 다시 실행해주세요.';
  }
  if (decision.reason === 'no_previous_learning_to_reuse') {
    return '재사용할 이전 학습 결과가 없습니다. 분석할 블로그 또는 리뷰 콘텐츠를 선택해주세요.';
  }
  if (decision.reason === 'no_collected_selected_items') {
    return '분석할 수집 콘텐츠가 없습니다.';
  }
  return '현재 선택 조합으로는 분석을 시작할 수 없습니다.';
}

function markSelectedItems(repos: ReturnType<typeof createStoreLearningRepositories>, collectedItems: CollectionItem[], selectedIdSet: Set<string>) {
  const selectedAt = nowIso();
  for (const item of collectedItems) {
    const selected = selectedIdSet.has(item.id);
    repos.collectionItems.update(item.id, {
      selectedForAnalysis: selected ? 1 : 0,
      selectionReason: selected ? 'selected_for_queued_analysis' : 'not_selected_for_queued_analysis',
      selectedAt
    });
  }
}

function reuseSkippedReason(collectionSummary: unknown, decision: AnalysisExecutionDecision) {
  if (decision.reason !== 'latest_ruleset_contract_incomplete') return decision.reason;
  const collectionDelta = asRecord(asRecord(collectionSummary).collectionDelta);
  if (collectionDelta.hasMeaningfulChanges === false) return 'no_meaningful_collection_changes';
  return 'place_profile_fact_change_only';
}

function failedAnalysisResponse(artifacts: NonNullable<ReturnType<typeof getAnalysisArtifacts>>, fallbackError: unknown) {
  const analysisRun = artifacts.analysisRun;
  const error = asRecord(analysisRun.error);
  const message =
    asString(error.message) ??
    (fallbackError instanceof Error ? fallbackError.message : null) ??
    '분석 실행을 시작하지 못했습니다.';

  return {
    error: message,
    analysisRunId: analysisRun.id,
    analysisRun,
    analysisFailure: {
      analysisRunId: analysisRun.id,
      status: analysisRun.status,
      isCurrentRun: true,
      failedAt: analysisRun.completedAt ?? analysisRun.updatedAt,
      message,
      errorType: asString(error.errorType),
      contractIssue: asString(error.contractIssue),
      analyzerProvider: asString(error.analyzerProvider),
      analyzerMode: asString(error.analyzerMode),
      analyzerModel: asString(error.analyzerModel),
      selectedItemCount: error.selectedItemCount,
      promptItemCount: error.promptItemCount,
      omittedItemCount: error.omittedItemCount,
      promptBudgetReason: asString(error.promptBudgetReason)
    }
  };
}

export function createAnalysisRunRoutes({ connection, env = process.env, provider }: AnalysisRunRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.get('/:analysisRunId', (req, res) => {
    const artifacts = getAnalysisArtifacts(repos, req.params.analysisRunId);
    if (!artifacts) {
      res.status(404).json({ error: `Analysis run not found: ${req.params.analysisRunId}` });
      return;
    }
    res.json(artifacts);
  });

  router.post('/:analysisRunId/start', async (req, res, next) => {
    try {
      const artifacts = await startAnalysisRun(repos, req.params.analysisRunId, provider ?? createAnalysisProvider(env));
      res.json(artifacts);
    } catch (error) {
      const artifacts = getAnalysisArtifacts(repos, req.params.analysisRunId);
      if (artifacts?.analysisRun.status === 'failed') {
        res.status(400).json(failedAnalysisResponse(artifacts, error));
        return;
      }
      next(error);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const body = AnalysisRunCreateSchema.parse(req.body);
      const store = repos.stores.findById(body.storeId);
      if (!store) {
        res.status(404).json({ error: `Store not found: ${body.storeId}` });
        return;
      }

      const collectionRun = repos.collectionRuns.findById(body.collectionRunId);
      if (!collectionRun || collectionRun.storeId !== store.id) {
        res.status(404).json({ error: `Collection run not found: ${body.collectionRunId}` });
        return;
      }

      const runCollectedItems = repos.collectionItems
        .listByRunId(collectionRun.id)
        .filter((item) => item.storeId === store.id && item.status === 'collected');
      const selectedIdSet = new Set(body.selectedItemIds);
      const storeCollectedItemsById = new Map(
        repos.collectionItems
          .listByStoreId(store.id)
          .filter((item) => item.status === 'collected')
          .map((item) => [item.id, item])
      );
      const selectedOutsideRunItems = Array.from(selectedIdSet)
        .map((itemId) => storeCollectedItemsById.get(itemId))
        .filter((item): item is CollectionItem => Boolean(item));
      const collectedItems = [
        ...runCollectedItems,
        ...selectedOutsideRunItems.filter((item) => !runCollectedItems.some((runItem) => runItem.id === item.id))
      ];
      const collectedById = new Map(collectedItems.map((item) => [item.id, item]));

      for (const item of runCollectedItems) {
        if (item.sourceType === 'profile') selectedIdSet.add(item.id);
      }

      const missingIds = Array.from(selectedIdSet).filter((itemId) => !collectedById.has(itemId));
      if (missingIds.length > 0) {
        res.status(400).json({ error: `Selected items are not available for analysis: ${missingIds.join(', ')}` });
        return;
      }

      const classifier = createRulesetEvidenceClassifier(repos, store.id);
      const selectedItems = Array.from(selectedIdSet).map((itemId) => classifier.withState(collectedById.get(itemId) as CollectionItem));
      const latestArtifacts = getLatestAnalysisArtifacts(repos, store.id);
      const analysisDecision = decideAnalysisExecution({
        collectionSummary: collectionRun.summary,
        selectedItems,
        latestLearning: latestLearningDecisionInput(latestArtifacts)
      });

      if (analysisDecision.action === 'block') {
        res.status(400).json({
          error: blockedDecisionMessage(analysisDecision),
          analysisDecision
        });
        return;
      }

      if (analysisDecision.action === 'reuse_latest_learning' || analysisDecision.action === 'backfill_latest_ruleset') {
        if (!latestArtifacts?.learningSnapshot || !latestArtifacts.marketingRuleset) {
          res.status(400).json({
            error: blockedDecisionMessage({
              ...analysisDecision,
              reason: 'no_previous_learning_to_reuse'
            }),
            analysisDecision
          });
          return;
        }
        const backfillResult =
          analysisDecision.action === 'backfill_latest_ruleset'
            ? backfillRulesetContractFields(repos, {
                store,
                rulesetId: latestArtifacts.marketingRuleset.id,
                missingFieldKeys: analysisDecision.missingRulesetFieldKeys,
                selectedItems
              })
            : null;
        markSelectedItems(repos, collectedItems, selectedIdSet);
        const selectedItemIds = selectedItems.map((item) => item.id);
        const completedAt = nowIso();
        const skippedReason = reuseSkippedReason(collectionRun.summary, analysisDecision);
        const newEvidenceCounts = analysisDecision.newEvidenceCounts;
        const analysisRun = repos.analysisRuns.create({
          id: analysisRunId(store.id),
          storeId: store.id,
          collectionRunId: collectionRun.id,
          status: 'completed',
          startedAt: completedAt,
          completedAt,
          result: {
            selectedItemIds,
            selectedCounts: selectedCounts(selectedItems),
            skippedReason,
            requiredNewBlogPostCount: newEvidenceCounts.requiredBlogPosts,
            requiredNewPlaceReviewCount: newEvidenceCounts.requiredPlaceReviews,
            newBlogPostCount: newEvidenceCounts.blogPosts,
            newPlaceReviewCount: newEvidenceCounts.placeReviews,
            pendingRulesetBackfill: analysisDecision.action === 'backfill_latest_ruleset' && !backfillResult?.applied,
            rulesetBackfillApplied: backfillResult?.applied ?? false,
            rulesetBackfillSource: backfillResult?.source ?? null,
            rulesetBackfillMissingFieldKeys: backfillResult ? analysisDecision.missingRulesetFieldKeys : [],
            rulesetBackfillFieldIds: backfillResult?.fieldIds ?? [],
            rulesetBackfillFieldKeys: backfillResult?.fieldKeys ?? [],
            analysisDecision,
            reusedAnalysisRunId: latestArtifacts.analysisRun.id,
            learningSnapshotId: latestArtifacts.learningSnapshot.id,
            marketingRulesetId: latestArtifacts.marketingRuleset.id,
            analysisProgress: skippedAnalysisProgress(completedAt, analysisDecision.reason)
          },
          error: null
        });

        res.json({ analysisRunId: analysisRun.id, analysisRun });
        return;
      }

      markSelectedItems(repos, collectedItems, selectedIdSet);
      const selectedItemIds = selectedItems.map((item) => item.id);
      const analysisRun = repos.analysisRuns.create({
        id: analysisRunId(store.id),
        storeId: store.id,
        collectionRunId: collectionRun.id,
        status: 'queued',
        startedAt: null,
        completedAt: null,
        result: {
          selectedItemIds,
          selectedCounts: selectedCounts(selectedItems),
          analysisDecision
        },
        error: null
      });

      res.json({ analysisRunId: analysisRun.id, analysisRun });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
