import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type AnalysisRun = BaseEntity & {
  storeId: string;
  collectionRunId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  result: JsonValue;
  error: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'collectionRunId',
  'status',
  'startedAt',
  'completedAt',
  'result',
  'error',
  'createdAt',
  'updatedAt'
] as const;

export function createAnalysisRunsRepository(connection: DbConnection) {
  const repository = createRepository<AnalysisRun>(connection, {
    tableName: 'analysis_runs',
    columns,
    jsonColumns: ['result', 'error']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByCollectionRunId: (collectionRunId: string) => repository.findManyBy('collectionRunId', collectionRunId)
  };
}
