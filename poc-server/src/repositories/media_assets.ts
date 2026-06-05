import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type MediaAsset = BaseEntity & {
  storeId: string;
  blogPostId: string | null;
  assetType: string;
  status: string;
  url: string | null;
  prompt?: string | null;
  metadata: JsonValue;
};

const columns = [
  'id',
  'storeId',
  'blogPostId',
  'assetType',
  'status',
  'url',
  'prompt',
  'metadata',
  'createdAt',
  'updatedAt'
] as const;

export function createMediaAssetsRepository(connection: DbConnection) {
  const repository = createRepository<MediaAsset>(connection, {
    tableName: 'media_assets',
    columns,
    jsonColumns: ['metadata'],
    columnOverrides: {
      prompt: 'prompt'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByBlogPostId: (blogPostId: string) => repository.findManyBy('blogPostId', blogPostId)
  };
}
