import { randomUUID } from 'node:crypto';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  durationMs,
  getLastAuditMetadata,
  nowIso,
  toJsonValue,
  type LlmAuditMetadataProvider
} from './llmAuditMetadata.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

type LlmAuditProvider = LlmAuditMetadataProvider & {
  name: string;
  mode: string;
  model?: string | null;
};

type RecordLlmAuditLogInput = {
  storeId: string | null;
  relatedEntityType: 'analysis_run' | 'content_generation' | 'blog_post' | 'seo_score' | 'v2_blog_formula_run';
  relatedEntityId: string | null;
  provider: LlmAuditProvider;
  model?: string | null;
  action: string;
  status: 'completed' | 'failed';
  inputBudget?: unknown;
  rawRequestedJson?: unknown;
  rawParsedOutputJson?: unknown;
  normalizedOutputJson?: unknown;
  parsedOutputJson?: unknown;
  errorJson?: unknown;
};

export function recordLlmAuditLog(repos: Repositories, input: RecordLlmAuditLogInput) {
  if (input.provider.mode !== 'openai') return null;

  const auditMetadata = getLastAuditMetadata(input.provider);
  const completedAt = auditMetadata?.responseCompletedAt ?? nowIso();
  const startedAt = auditMetadata?.requestStartedAt ?? completedAt;
  const duration = auditMetadata?.durationMs ?? durationMs(startedAt, completedAt);
  const normalizedOutputJson =
    input.normalizedOutputJson !== undefined
      ? input.normalizedOutputJson
      : auditMetadata?.normalizedOutputJson !== undefined
        ? auditMetadata.normalizedOutputJson
        : input.parsedOutputJson !== undefined
          ? input.parsedOutputJson
          : auditMetadata?.parsedOutputJson !== undefined
            ? auditMetadata.parsedOutputJson
            : null;

  return repos.llmAuditLogs.create({
    id: `llm_audit_${Date.now()}_${randomUUID()}`,
    storeId: input.storeId,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    provider: input.provider.name,
    mode: input.provider.mode,
    model: input.model ?? input.provider.model ?? null,
    action: input.action,
    requestStartedAt: startedAt,
    responseCompletedAt: completedAt,
    durationMs: duration,
    inputBudget: toJsonValue(input.inputBudget ?? auditMetadata?.inputBudget ?? null),
    promptInputJson: toJsonValue(auditMetadata?.promptInputJson ?? null),
    responseFormatJson: toJsonValue(auditMetadata?.responseFormatJson ?? null),
    rawRequestedJson: toJsonValue(input.rawRequestedJson ?? auditMetadata?.rawRequestedJson ?? null),
    rawParsedOutputJson: toJsonValue(
      input.rawParsedOutputJson ?? auditMetadata?.rawParsedOutputJson ?? auditMetadata?.parsedOutputJson ?? null
    ),
    normalizedOutputJson: toJsonValue(normalizedOutputJson),
    parsedOutputJson: toJsonValue(input.parsedOutputJson ?? auditMetadata?.parsedOutputJson ?? null),
    status: input.status,
    errorJson: toJsonValue(input.errorJson ?? auditMetadata?.errorJson ?? null),
    providerMetadataJson: toJsonValue(auditMetadata?.providerMetadataJson ?? null)
  });
}
