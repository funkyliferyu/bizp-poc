import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type Store = BaseEntity & {
  name: string;
  naverPlaceUrl: string | null;
  naverPlaceId: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  metadata: JsonValue;
};

const columns = [
  'id',
  'name',
  'naverPlaceUrl',
  'naverPlaceId',
  'category',
  'address',
  'phone',
  'description',
  'metadata',
  'createdAt',
  'updatedAt'
] as const;

export function createStoresRepository(connection: DbConnection) {
  return createRepository<Store>(connection, {
    tableName: 'stores',
    columns,
    jsonColumns: ['metadata']
  });
}
