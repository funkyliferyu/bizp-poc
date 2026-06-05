import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type CollectionItem = BaseEntity & {
  runId: string;
  storeId: string;
  channel: string;
  sourceType: string;
  status: string;
  sourceUrl: string | null;
  title: string | null;
  bodyText: string | null;
  selectedForAnalysis: number;
  selectionReason: string | null;
  selectedAt: string | null;
  metadata: JsonValue;
};

const columns = [
  'id',
  'runId',
  'storeId',
  'channel',
  'sourceType',
  'status',
  'sourceUrl',
  'title',
  'bodyText',
  'selectedForAnalysis',
  'selectionReason',
  'selectedAt',
  'metadata',
  'createdAt',
  'updatedAt'
] as const;

export function createCollectionItemsRepository(connection: DbConnection) {
  const repository = createRepository<CollectionItem>(connection, {
    tableName: 'collection_items',
    columns,
    jsonColumns: ['metadata']
  });
  return {
    ...repository,
    listByRunId: (runId: string) => repository.findManyBy('runId', runId),
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}
