import express from 'express';
import type { DbConnection } from '../../db/connection.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { startCollectionRun } from '../collection/collectionRunner.js';
import { buildRelearnEligibility } from '../learning/learningStatusService.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';

type CollectionRunRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  stepDelayMs?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function qualityFlagsFor(item: CollectionItem) {
  const metadata = asRecord(item.metadata);
  const metadataFlags = Array.isArray(metadata.qualityFlags) ? metadata.qualityFlags : [];
  const flags = metadataFlags.filter((flag): flag is string => typeof flag === 'string');

  if (metadata.aiSuspected === true || metadata.aiGeneratedSuspected === true) flags.push('ai_suspected');
  if (metadata.lowQuality === true) flags.push('low_quality');

  return Array.from(new Set(flags));
}

function defaultIncluded(item: CollectionItem) {
  const flags = qualityFlagsFor(item);
  if (flags.includes('ai_suspected') || flags.includes('low_quality')) return false;
  return item.status === 'collected';
}

function hasNoMeaningfulChanges(summary: unknown) {
  const delta = asRecord(asRecord(summary).collectionDelta);
  return delta.hasMeaningfulChanges === false;
}

function serializeSelectableItem(item: CollectionItem) {
  const includeByDefault = defaultIncluded(item);
  const hasExplicitSelection = item.selectedAt !== null || item.selectedForAnalysis === 1;
  const selectedForAnalysis = hasExplicitSelection ? item.selectedForAnalysis : includeByDefault ? 1 : 0;

  return {
    ...item,
    selectedForAnalysis,
    defaultIncluded: includeByDefault,
    qualityFlags: qualityFlagsFor(item)
  };
}

export function createCollectionRunRoutes({ connection, env = process.env, stepDelayMs }: CollectionRunRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.get('/:runId', (req, res) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    res.json({ collectionRun });
  });

  router.get('/:runId/selectable-items', (req, res) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    if (hasNoMeaningfulChanges(collectionRun.summary)) {
      res.json({
        collectionRunId: collectionRun.id,
        storeId: collectionRun.storeId,
        collectionRun,
        relearnEligibility: buildRelearnEligibility(repos, collectionRun.storeId, collectionRun),
        items: []
      });
      return;
    }
    const items = repos.collectionItems
      .listByRunId(collectionRun.id)
      .filter((item) => item.status === 'collected')
      .map((item) => serializeSelectableItem(item));
    res.json({
      collectionRunId: collectionRun.id,
      storeId: collectionRun.storeId,
      collectionRun,
      relearnEligibility: buildRelearnEligibility(repos, collectionRun.storeId, collectionRun),
      items
    });
  });

  router.get('/:runId/items', (req, res) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    res.json({ collectionRunId: collectionRun.id, collectionItems: repos.collectionItems.listByRunId(collectionRun.id) });
  });

  router.post('/:runId/start', async (req, res, next) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    try {
      const started = await startCollectionRun(repos, collectionRun.id, { env, stepDelayMs });
      res.json({ collectionRun: started ?? collectionRun });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
