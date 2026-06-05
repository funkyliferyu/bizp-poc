import express from 'express';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { startMockCollectionRun } from '../collection/mockCollectionRunner.js';

type CollectionRunRoutesOptions = {
  connection: DbConnection;
  stepDelayMs?: number;
};

export function createCollectionRunRoutes({ connection, stepDelayMs }: CollectionRunRoutesOptions) {
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

  router.get('/:runId/items', (req, res) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    res.json({ collectionRunId: collectionRun.id, collectionItems: repos.collectionItems.listByRunId(collectionRun.id) });
  });

  router.post('/:runId/start', (req, res) => {
    const collectionRun = repos.collectionRuns.findById(req.params.runId);
    if (!collectionRun) {
      res.status(404).json({ error: `Collection run not found: ${req.params.runId}` });
      return;
    }
    const started = startMockCollectionRun(repos, collectionRun.id, { stepDelayMs });
    res.json({ collectionRun: started ?? collectionRun });
  });

  return router;
}
