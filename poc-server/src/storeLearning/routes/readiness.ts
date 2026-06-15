import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { LlmAuditLog } from '../../repositories/llm_audit_logs.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { buildProviderReadiness } from '../readiness/providerReadiness.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import { buildSqlDbDashboard, resetSqlDbDashboardStore } from '../dbDashboard/dbDashboardService.js';

type StoreLearningReadinessRoutesOptions = {
  env?: ProviderEnv;
  now?: () => string;
  connection?: DbConnection;
  ragOutputRoot?: string;
};

export function createStoreLearningReadinessRoutes({
  env = process.env,
  now,
  connection,
  ragOutputRoot
}: StoreLearningReadinessRoutesOptions = {}) {
  const router = express.Router();
  const repos = connection ? createStoreLearningRepositories(connection) : null;

  router.get('/provider-readiness', (_req, res) => {
    res.json(buildProviderReadiness(env, now));
  });

  router.get('/db-dashboard', (_req, res) => {
    if (!connection) {
      res.status(503).json({ error: 'DB dashboard is unavailable without a store-learning database connection.' });
      return;
    }
    res.json(buildSqlDbDashboard(connection, { ragOutputRoot }));
  });

  router.post('/db-dashboard/reset', (req, res, next) => {
    try {
      if (!connection) {
        res.status(503).json({ error: 'DB dashboard is unavailable without a store-learning database connection.' });
        return;
      }
      const body = z.object({
        storeId: z.string().trim().min(1),
        target: z.enum(['all', 'place', 'blog', 'rag_info', 'rag_reviews', 'generated_blog'])
      }).parse(req.body ?? {});
      res.json(resetSqlDbDashboardStore(connection, body, { ragOutputRoot }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/llm-audit-logs', (req, res) => {
    if (!repos) {
      res.status(503).json({ error: 'LLM audit logs are unavailable without a store-learning database connection.' });
      return;
    }

    const storeId = getQueryString(req.query.storeId);
    const action = getQueryString(req.query.action);
    const relatedEntityType = getQueryString(req.query.relatedEntityType);
    const relatedEntityId = getQueryString(req.query.relatedEntityId);
    const limit = clampLimit(req.query.limit);
    const logs = repos.llmAuditLogs
      .all()
      .filter((log) => !storeId || log.storeId === storeId)
      .filter((log) => !action || log.action === action)
      .filter((log) => !relatedEntityType || log.relatedEntityType === relatedEntityType)
      .filter((log) => !relatedEntityId || log.relatedEntityId === relatedEntityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(serializeLlmAuditLog);

    res.json({ logs });
  });

  return router;
}

function getQueryString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampLimit(value: unknown) {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, parsed));
}

function serializeLlmAuditLog(log: LlmAuditLog) {
  return {
    id: log.id,
    storeId: log.storeId,
    relatedEntityType: log.relatedEntityType,
    relatedEntityId: log.relatedEntityId,
    provider: log.provider,
    mode: log.mode,
    model: log.model,
    action: log.action,
    status: log.status,
    requestStartedAt: log.requestStartedAt,
    responseCompletedAt: log.responseCompletedAt,
    durationMs: log.durationMs,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    inputBudgetJson: log.inputBudget,
    promptInputJson: log.promptInputJson,
    responseFormatJson: log.responseFormatJson,
    rawRequestedJson: log.rawRequestedJson,
    rawParsedOutputJson: log.rawParsedOutputJson,
    normalizedOutputJson: log.normalizedOutputJson ?? log.parsedOutputJson,
    parsedOutputJson: log.parsedOutputJson,
    errorJson: log.errorJson,
    providerMetadataJson: log.providerMetadataJson
  };
}
