import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type LlmAuditLogStatus = 'completed' | 'failed';

export type LlmAuditLog = BaseEntity & {
  storeId: string | null;
  relatedEntityType: string;
  relatedEntityId: string | null;
  provider: string;
  mode: string;
  model: string | null;
  action: string;
  requestStartedAt: string;
  responseCompletedAt: string | null;
  durationMs: number | null;
  inputBudget: JsonValue;
  promptInputJson: JsonValue;
  responseFormatJson: JsonValue;
  rawRequestedJson: JsonValue;
  rawParsedOutputJson: JsonValue;
  normalizedOutputJson: JsonValue;
  parsedOutputJson: JsonValue;
  status: LlmAuditLogStatus;
  errorJson: JsonValue;
  providerMetadataJson: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'relatedEntityType',
  'relatedEntityId',
  'provider',
  'mode',
  'model',
  'action',
  'requestStartedAt',
  'responseCompletedAt',
  'durationMs',
  'inputBudget',
  'promptInputJson',
  'responseFormatJson',
  'rawRequestedJson',
  'rawParsedOutputJson',
  'normalizedOutputJson',
  'parsedOutputJson',
  'status',
  'errorJson',
  'providerMetadataJson',
  'createdAt',
  'updatedAt'
] as const;

export function createLlmAuditLogsRepository(connection: DbConnection) {
  const repository = createRepository<LlmAuditLog>(connection, {
    tableName: 'llm_audit_logs',
    columns,
    jsonColumns: [
      'inputBudget',
      'promptInputJson',
      'responseFormatJson',
      'rawRequestedJson',
      'rawParsedOutputJson',
      'normalizedOutputJson',
      'parsedOutputJson',
      'errorJson',
      'providerMetadataJson'
    ],
    columnOverrides: {
      inputBudget: 'input_budget_json'
    }
  });

  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByRelatedEntity: (relatedEntityType: string, relatedEntityId: string) =>
      repository
        .all()
        .filter((log) => log.relatedEntityType === relatedEntityType && log.relatedEntityId === relatedEntityId),
    latest: (limit = 20) => repository.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  };
}
