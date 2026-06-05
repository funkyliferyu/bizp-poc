import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type TrainingSettings = BaseEntity & {
  storeId: string;
  status: string;
  settings: JsonValue;
};

const columns = ['id', 'storeId', 'status', 'settings', 'createdAt', 'updatedAt'] as const;

export function createTrainingSettingsRepository(connection: DbConnection) {
  const repository = createRepository<TrainingSettings>(connection, {
    tableName: 'training_settings',
    columns,
    jsonColumns: ['settings']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}
