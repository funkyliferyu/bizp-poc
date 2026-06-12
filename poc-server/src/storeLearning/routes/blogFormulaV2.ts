import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  extractBlogFormulaV2,
  generateBlogFormulaV2Draft,
  getBlogFormulaV2Draft,
  getBlogFormulaV2Payload,
  listBlogFormulaV2Drafts,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../blogFormulaV2/blogFormulaV2Service.js';
import { BlogTopicBriefInputSchema } from '../blogFormulaV2/types.js';

type BlogFormulaV2RoutesOptions = {
  connection: DbConnection;
};

const RetrieveSamplesBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefId: z.string().trim().min(1).optional(),
  topicBrief: BlogTopicBriefInputSchema.optional(),
  maxSamples: z.number().int().min(1).max(10).optional()
});

const GenerateDraftBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefId: z.string().trim().min(1),
  retrievalRunId: z.string().trim().min(1)
});

const ValidateDraftBodySchema = z.union([
  z.object({
    draftGenerationId: z.string().trim().min(1)
  }),
  z.object({
    selectedTitle: z.string().trim().min(1),
    blogDraft: z.string().trim().min(1),
    topicBrief: BlogTopicBriefInputSchema
  })
]);

export function createBlogFormulaV2Routes({ connection }: BlogFormulaV2RoutesOptions) {
  const router = express.Router({ mergeParams: true });
  const repos = createStoreLearningRepositories(connection);

  function storeId(req: express.Request) {
    const value = req.params.storeId;
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }

  router.get('/', (req, res, next) => {
    try {
      res.json(getBlogFormulaV2Payload(repos, storeId(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post('/extract', (req, res, next) => {
    try {
      res.json(extractBlogFormulaV2(repos, storeId(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post('/retrieve-samples', (req, res, next) => {
    try {
      const body = RetrieveSamplesBodySchema.parse(req.body);
      res.json(retrieveBlogFormulaV2Samples(repos, storeId(req), body));
    } catch (error) {
      next(error);
    }
  });

  router.post('/generate-draft', (req, res, next) => {
    try {
      const body = GenerateDraftBodySchema.parse(req.body);
      res.json(generateBlogFormulaV2Draft(repos, storeId(req), body));
    } catch (error) {
      next(error);
    }
  });

  router.post('/validate-draft', (req, res, next) => {
    try {
      const body = ValidateDraftBodySchema.parse(req.body);
      res.json(validateBlogFormulaV2Draft(repos, storeId(req), body));
    } catch (error) {
      next(error);
    }
  });

  router.get('/drafts', (req, res, next) => {
    try {
      res.json({ drafts: listBlogFormulaV2Drafts(repos, storeId(req)) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/drafts/:draftGenerationId', (req, res, next) => {
    try {
      const draftGenerationId = req.params.draftGenerationId;
      const payload = getBlogFormulaV2Draft(repos, storeId(req), draftGenerationId);
      if (!payload) {
        res.status(404).json({ error: `Blog Formula V2 draft not found: ${draftGenerationId}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
