import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity } from './base.js';

export type RulesetField = BaseEntity & {
  rulesetId: string;
  fieldKey: string;
  fieldValue: string;
  source: string;
  confidence: number | null;
};

const columns = [
  'id',
  'rulesetId',
  'fieldKey',
  'fieldValue',
  'source',
  'confidence',
  'createdAt',
  'updatedAt'
] as const;

export function createRulesetFieldsRepository(connection: DbConnection) {
  const repository = createRepository<RulesetField>(connection, {
    tableName: 'ruleset_fields',
    columns
  });
  return {
    ...repository,
    listByRulesetId: (rulesetId: string) => repository.findManyBy('rulesetId', rulesetId)
  };
}
