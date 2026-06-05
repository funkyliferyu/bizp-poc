import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type CollectionRun = BaseEntity & {
  storeId: string;
  status: string;
  mode: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'status',
  'mode',
  'startedAt',
  'completedAt',
  'summary',
  'createdAt',
  'updatedAt'
] as const;

export function createCollectionRunsRepository(connection: DbConnection) {
  const repository = createRepository<CollectionRun>(connection, {
    tableName: 'collection_runs',
    columns,
    jsonColumns: ['summary'],
    columnOverrides: {
      summary: 'summary_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}
