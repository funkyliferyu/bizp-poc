import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type StoreChannel = BaseEntity & {
  storeId: string;
  channel: string;
  sourceUrl: string | null;
  status: string;
  providerMode: string;
  settings: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'channel',
  'sourceUrl',
  'status',
  'providerMode',
  'settings',
  'createdAt',
  'updatedAt'
] as const;

export function createStoreChannelsRepository(connection: DbConnection) {
  const repository = createRepository<StoreChannel>(connection, {
    tableName: 'store_channels',
    columns,
    jsonColumns: ['settings']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}
