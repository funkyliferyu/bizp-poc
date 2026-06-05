import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type MarketingRuleset = BaseEntity & {
  storeId: string;
  learningSnapshotId: string | null;
  status: string;
  version: number;
  ruleset: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'learningSnapshotId',
  'status',
  'version',
  'ruleset',
  'createdAt',
  'updatedAt'
] as const;

export function createMarketingRulesetsRepository(connection: DbConnection) {
  const repository = createRepository<MarketingRuleset>(connection, {
    tableName: 'marketing_rulesets',
    columns,
    jsonColumns: ['ruleset']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}
