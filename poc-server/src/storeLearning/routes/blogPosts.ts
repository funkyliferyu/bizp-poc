import express from 'express';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { getBlogPostDetail } from '../blog/blogGenerator.js';

type BlogPostRoutesOptions = {
  connection: DbConnection;
};

export function createBlogPostRoutes({ connection }: BlogPostRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.get('/:postId', (req, res) => {
    const payload = getBlogPostDetail(repos, req.params.postId);
    if (!payload) {
      res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
      return;
    }
    res.json(payload);
  });

  return router;
}
