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
import type { BlogContentProvider } from '../blog/blogProvider.js';
import { createBlogContentProvider, type OpenAIBlogParseClient } from '../blog/openAIBlogProvider.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';

type BlogPostRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  blogProvider?: BlogContentProvider | null;
  blogProviderClient?: OpenAIBlogParseClient | null;
};

export function createBlogPostRoutes({
  connection,
  env = process.env,
  blogProvider,
  blogProviderClient
}: BlogPostRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);
  const selectedBlogProvider =
    blogProvider !== undefined
      ? blogProvider
      : createBlogContentProvider(
          env,
          blogProviderClient !== undefined
            ? { client: blogProviderClient, model: env.OPENAI_MODEL }
            : { model: env.OPENAI_MODEL }
        );

  router.post('/:postId/regenerate-text', async (req, res, next) => {
    try {
      const payload = await regenerateBlogPostText(repos, req.params.postId, selectedBlogProvider);
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

  router.post('/:postId/seo-score', async (req, res, next) => {
    try {
      const payload = await rescoreBlogPostSeo(repos, req.params.postId, selectedBlogProvider);
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
