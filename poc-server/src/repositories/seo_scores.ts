import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type SeoScore = BaseEntity & {
  blogPostId: string;
  score: number;
  totalScore?: number | null;
  status: string;
  rubric: JsonValue;
};

const columns = ['id', 'blogPostId', 'score', 'totalScore', 'status', 'rubric', 'createdAt', 'updatedAt'] as const;

export function createSeoScoresRepository(connection: DbConnection) {
  const repository = createRepository<SeoScore>(connection, {
    tableName: 'seo_scores',
    columns,
    jsonColumns: ['rubric'],
    columnOverrides: {
      totalScore: 'total_score'
    }
  });
  return {
    ...repository,
    listByBlogPostId: (blogPostId: string) => repository.findManyBy('blogPostId', blogPostId)
  };
}
