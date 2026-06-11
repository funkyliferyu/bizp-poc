import type { JsonValue } from '../../repositories/base.js';

export type LlmCallAuditMetadata = {
  requestStartedAt: string;
  responseCompletedAt: string;
  durationMs: number;
  inputBudget: JsonValue;
  promptInputJson: JsonValue;
  responseFormatJson: JsonValue;
  parsedOutputJson: JsonValue;
  errorJson: JsonValue;
  providerMetadataJson?: JsonValue;
};

export type LlmAuditMetadataProvider = {
  getLastAuditMetadata?: () => LlmCallAuditMetadata | null;
};

export function nowIso() {
  return new Date().toISOString();
}

export function durationMs(startedAt: string, completedAt: string) {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) return 0;
  return Math.max(0, completed - started);
}

export function toJsonValue(value: unknown): JsonValue {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function summarizeResponseFormat(responseFormat: unknown, fallbackName: string) {
  const responseFormatRecord = asRecord(responseFormat);
  const jsonSchema = asRecord(responseFormatRecord.json_schema);
  return toJsonValue({
    type: typeof responseFormatRecord.type === 'string' ? responseFormatRecord.type : 'json_schema',
    name: typeof jsonSchema.name === 'string' ? jsonSchema.name : fallbackName,
    strict: jsonSchema.strict === true
  });
}

export function sanitizedProviderError(error: unknown): JsonValue {
  const message = error instanceof Error ? error.message : String(error);
  if (/maximum context length|context length|context_length|too many tokens|tokens/i.test(message)) {
    return {
      errorType: 'provider_context_too_large',
      message: 'LLM provider rejected the request because the prompt exceeded context limits.'
    };
  }
  return {
    message: message.replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
  };
}

export function getLastAuditMetadata(provider: LlmAuditMetadataProvider) {
  return provider.getLastAuditMetadata?.() ?? null;
}
