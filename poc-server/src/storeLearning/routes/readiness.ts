import express from 'express';
import { buildProviderReadiness } from '../readiness/providerReadiness.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';

type StoreLearningReadinessRoutesOptions = {
  env?: ProviderEnv;
  now?: () => string;
};

export function createStoreLearningReadinessRoutes({
  env = process.env,
  now
}: StoreLearningReadinessRoutesOptions = {}) {
  const router = express.Router();

  router.get('/provider-readiness', (_req, res) => {
    res.json(buildProviderReadiness(env, now));
  });

  return router;
}
