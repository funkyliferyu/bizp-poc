import express from 'express';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  extendBlogFormulaV2TopicBriefSets,
  extractBlogFormulaV2,
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  generateBlogFormulaV2DraftWithProvider,
  getBlogFormulaV2Draft,
  getBlogFormulaV2Payload,
  getTopicBriefSetProviderModeForStore,
  listBlogFormulaV2Drafts,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from '../blogFormulaV2/blogFormulaV2Service.js';
import {
  createBlogFormulaV2ProviderForMode,
  type BlogFormulaV2ProviderFactoryOptions
} from '../blogFormulaV2/providers/providerFactory.js';
import { createBlogDraftV2ProviderForMode } from '../blogFormulaV2/providers/draftProviderFactory.js';
import { createTopicBriefSetProviderForMode } from '../blogFormulaV2/providers/topicBriefSetProviderFactory.js';
import { BlogTopicBriefInputSchema } from '../blogFormulaV2/types.js';

type BlogFormulaV2RoutesOptions = {
  connection: DbConnection;
  providerFactoryOptions?: BlogFormulaV2ProviderFactoryOptions;
};

const ExtractFormulaBodySchema = z.object({
  providerMode: z.enum(['deterministic', 'safe_mock', 'openai', 'auto']).optional()
});

const RetrieveSamplesBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefId: z.string().trim().min(1).optional(),
  topicBrief: BlogTopicBriefInputSchema.optional(),
  maxSamples: z.number().int().min(1).max(10).optional()
});

const GenerateDraftBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefId: z.string().trim().min(1),
  retrievalRunId: z.string().trim().min(1),
  providerMode: z.enum(['deterministic', 'safe_mock', 'openai', 'auto']).optional()
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

const ExtendTopicBriefSetsBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional()
});

export function createBlogFormulaV2Routes({ connection, providerFactoryOptions }: BlogFormulaV2RoutesOptions) {
  const router = express.Router({ mergeParams: true });
  const repos = createStoreLearningRepositories(connection);

  function storeId(req: express.Request) {
    const value = req.params.storeId;
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }

  // Spread (rather than an explicit-key literal) so the `openAIClient` key is
  // only present when it was actually provided — mirroring the SL-F1 `/extract`
  // call site. An always-present `openAIClient: undefined` key would make the
  // factory's `'openAIClient' in options` check true and inject `client:
  // undefined`, which then suppresses the provider's getOpenAIClient() fallback
  // and breaks the OpenAI SL-F2 path in production (no injected client).
  function topicBriefSetFactoryOptions() {
    return { ...(providerFactoryOptions ?? {}) };
  }

  async function populateFirstTopicBriefSetBatch(
    storeIdValue: string,
    formulaSetId: string,
    providerMode: 'deterministic' | 'safe_mock' | 'openai' | 'auto' | undefined
  ) {
    try {
      const provider = createTopicBriefSetProviderForMode(providerMode, topicBriefSetFactoryOptions());
      await extendBlogFormulaV2TopicBriefSets(repos, storeIdValue, { formulaSetId, provider });
    } catch {
      // best-effort: the topic brief library stays empty and is retryable via the extend route
    }
  }

  router.get('/', (req, res, next) => {
    try {
      res.json(getBlogFormulaV2Payload(repos, storeId(req)));
    } catch (error) {
      next(error);
    }
  });

  router.post('/extract', async (req, res, next) => {
    try {
      const body = ExtractFormulaBodySchema.parse(req.body ?? {});
      const provider = createBlogFormulaV2ProviderForMode(body.providerMode, {
        ...(providerFactoryOptions ?? {})
      });
      const result = provider
        ? await extractBlogFormulaV2WithProvider(repos, storeId(req), provider)
        : extractBlogFormulaV2(repos, storeId(req));
      await populateFirstTopicBriefSetBatch(storeId(req), result.formulaSet.id, body.providerMode);
      res.json(result);
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

  router.post('/generate-draft', async (req, res, next) => {
    try {
      const body = GenerateDraftBodySchema.parse(req.body);
      const provider = createBlogDraftV2ProviderForMode(body.providerMode, {
        ...(providerFactoryOptions ?? {})
      });
      if (!provider) {
        res.json(generateBlogFormulaV2Draft(repos, storeId(req), body));
        return;
      }
      res.json(await generateBlogFormulaV2DraftWithProvider(repos, storeId(req), body, provider));
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

  router.post('/topic-brief-sets/extend', async (req, res, next) => {
    try {
      const body = ExtendTopicBriefSetsBodySchema.parse(req.body ?? {});
      const mode = getTopicBriefSetProviderModeForStore(repos, storeId(req), body.formulaSetId);
      const provider = createTopicBriefSetProviderForMode(mode, topicBriefSetFactoryOptions());
      const result = await extendBlogFormulaV2TopicBriefSets(repos, storeId(req), {
        formulaSetId: body.formulaSetId,
        provider
      });
      res.json(result);
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
