import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type LearningSnapshot = BaseEntity & {
  storeId: string;
  analysisRunId: string;
  status: string;
  snapshot: JsonValue;
};

const columns = ['id', 'storeId', 'analysisRunId', 'status', 'snapshot', 'createdAt', 'updatedAt'] as const;

export function createLearningSnapshotsRepository(connection: DbConnection) {
  const repository = createRepository<LearningSnapshot>(connection, {
    tableName: 'learning_snapshots',
    columns,
    jsonColumns: ['snapshot']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByAnalysisRunId: (analysisRunId: string) => repository.findManyBy('analysisRunId', analysisRunId)
  };
}
