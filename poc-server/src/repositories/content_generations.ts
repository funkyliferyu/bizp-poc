import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type ContentGeneration = BaseEntity & {
  storeId: string;
  rulesetId: string | null;
  status: string;
  contentType: string;
  prompt: JsonValue;
  output: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'rulesetId',
  'status',
  'contentType',
  'prompt',
  'output',
  'createdAt',
  'updatedAt'
] as const;

export function createContentGenerationsRepository(connection: DbConnection) {
  const repository = createRepository<ContentGeneration>(connection, {
    tableName: 'content_generations',
    columns,
    jsonColumns: ['prompt', 'output']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByRulesetId: (rulesetId: string) => repository.findManyBy('rulesetId', rulesetId)
  };
}
