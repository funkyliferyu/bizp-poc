import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { getAnalysisArtifacts, startAnalysisRun } from '../analysis/analysisExecutionService.js';
import type { AnalysisProvider } from '../analysis/analyzer.js';
import { createAnalysisProvider } from '../analysis/openAIAnalysisProvider.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';

type AnalysisRunRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  provider?: AnalysisProvider;
};

const AnalysisRunCreateSchema = z.object({
  storeId: z.string().trim().min(1),
  collectionRunId: z.string().trim().min(1),
  selectedItemIds: z.array(z.string().trim().min(1)).min(1)
});

function nowIso() {
  return new Date().toISOString();
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

      const collectedItems = repos.collectionItems
        .listByRunId(collectionRun.id)
        .filter((item) => item.storeId === store.id && item.status === 'collected');
      const collectedById = new Map(collectedItems.map((item) => [item.id, item]));
      const selectedIdSet = new Set(body.selectedItemIds);

      for (const item of collectedItems) {
        if (item.sourceType === 'profile') selectedIdSet.add(item.id);
      }

      const missingIds = Array.from(selectedIdSet).filter((itemId) => !collectedById.has(itemId));
      if (missingIds.length > 0) {
        res.status(400).json({ error: `Selected items are not available for analysis: ${missingIds.join(', ')}` });
        return;
      }

      const selectedItems = Array.from(selectedIdSet).map((itemId) => collectedById.get(itemId) as CollectionItem);
      const selectedAt = nowIso();
      for (const item of collectedItems) {
        const selected = selectedIdSet.has(item.id);
        repos.collectionItems.update(item.id, {
          selectedForAnalysis: selected ? 1 : 0,
          selectionReason: selected ? 'selected_for_queued_analysis' : 'not_selected_for_queued_analysis',
          selectedAt
        });
      }

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
          selectedCounts: selectedCounts(selectedItems)
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
