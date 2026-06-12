import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type RulesetField = BaseEntity & {
  rulesetId: string;
  fieldKey: string;
  fieldValue: string;
  aiValue: string;
  userValue: string | null;
  finalValue: string;
  source: string;
  locked: number;
  evidenceItemIds: JsonValue;
  metadata?: JsonValue;
  confidence: number | null;
};

const columns = [
  'id',
  'rulesetId',
  'fieldKey',
  'fieldValue',
  'aiValue',
  'userValue',
  'finalValue',
  'source',
  'locked',
  'evidenceItemIds',
  'metadata',
  'confidence',
  'createdAt',
  'updatedAt'
] as const;

export function createRulesetFieldsRepository(connection: DbConnection) {
  const repository = createRepository<RulesetField>(connection, {
    tableName: 'ruleset_fields',
    columns,
    jsonColumns: ['evidenceItemIds', 'metadata'],
    columnOverrides: {
      evidenceItemIds: 'evidence_item_ids_json'
    }
  });
  return {
    ...repository,
    listByRulesetId: (rulesetId: string) => repository.findManyBy('rulesetId', rulesetId)
  };
}
