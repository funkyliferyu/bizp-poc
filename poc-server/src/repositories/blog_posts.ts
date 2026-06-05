import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type BlogPost = BaseEntity & {
  storeId: string;
  contentGenerationId: string | null;
  status: string;
  title: string;
  article: JsonValue;
  publishedUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
};

const columns = [
  'id',
  'storeId',
  'contentGenerationId',
  'status',
  'title',
  'article',
  'publishedUrl',
  'scheduledAt',
  'publishedAt',
  'createdAt',
  'updatedAt'
] as const;

export function createBlogPostsRepository(connection: DbConnection) {
  const repository = createRepository<BlogPost>(connection, {
    tableName: 'blog_posts',
    columns,
    jsonColumns: ['article']
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByContentGenerationId: (contentGenerationId: string) =>
      repository.findManyBy('contentGenerationId', contentGenerationId)
  };
}
