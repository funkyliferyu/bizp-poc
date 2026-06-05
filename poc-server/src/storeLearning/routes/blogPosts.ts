import express from 'express';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  getBlogPostDetail,
  getBlogPostPreview,
  regenerateBlogPostImages,
  regenerateBlogPostText,
  requestBlogPostPublish,
  rescoreBlogPostSeo
} from '../blog/blogGenerator.js';

type BlogPostRoutesOptions = {
  connection: DbConnection;
};

export function createBlogPostRoutes({ connection }: BlogPostRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.post('/:postId/regenerate-text', (req, res, next) => {
    try {
      const payload = regenerateBlogPostText(repos, req.params.postId);
      if (!payload) {
        res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:postId/regenerate-images', (req, res, next) => {
    try {
      const payload = regenerateBlogPostImages(repos, req.params.postId);
      if (!payload) {
        res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:postId/seo-score', (req, res, next) => {
    try {
      const payload = rescoreBlogPostSeo(repos, req.params.postId);
      if (!payload) {
        res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:postId/preview', (req, res) => {
    const payload = getBlogPostPreview(repos, req.params.postId);
    if (!payload) {
      res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
      return;
    }
    res.json(payload);
  });

  router.post('/:postId/request-publish', (req, res, next) => {
    try {
      const payload = requestBlogPostPublish(repos, req.params.postId);
      if (!payload) {
        res.status(404).json({ error: `Blog post not found: ${req.params.postId}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

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
