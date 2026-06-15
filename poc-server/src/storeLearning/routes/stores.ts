import express from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { JsonValue } from '../../repositories/base.js';
import type { StoreChannel } from '../../repositories/store_channels.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { Store } from '../../repositories/stores.js';
import { importNaverPlaceUrl } from '../providers/placeImportService.js';
import type { JsonRecord, PlaceImportProvider, ProviderEnv } from '../providers/placeImportTypes.js';
import { parseNaverPlaceUrl } from '../providers/naverPlaceUrlParser.js';
import { configuredBlogProvider, configuredPlaceProvider, ownerSourcePolicy, sourceMetadata } from '../providers/ownerSourcePolicy.js';
import { extractExternalChannelLinks, type StoreExternalChannel } from '../providers/placeExternalChannels.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';
import {
  buildBlogLearningStatus,
  buildInstagramLearningStatus,
  buildLearningStatus,
  buildPlaceLearningStatus
} from '../learning/learningStatusService.js';
import {
  buildMarketingRulesetVersionPayload,
  buildMarketingRulesetPayload,
  buildRulesetFieldEvidence,
  buildRulesetVersionsPayload,
  resetRulesetFieldValue,
  restoreMarketingRulesetVersion,
  updateRulesetFieldValue
} from '../rulesets/rulesetService.js';
import { buildRulesetBenchmarkPayload } from '../rulesets/rulesetBenchmarkService.js';
import { buildRulesetPreviewPayload } from '../rulesets/rulesetPreviewService.js';
import { generateApprovalPendingBlogPost, listBlogPostsForStore } from '../blog/blogGenerator.js';
import {
  generateApprovalPendingBlogPostFromV2Formula,
  selectTopicBriefSetsForV2Batch
} from '../blog/blogFormulaV2PostGenerator.js';
import type { BlogContentProvider } from '../blog/blogProvider.js';
import { createBlogContentProvider, type OpenAIBlogParseClient } from '../blog/openAIBlogProvider.js';
import {
  createBlogDraftV2ProviderForMode,
  type BlogDraftV2ProviderFactoryOptions
} from '../blogFormulaV2/providers/draftProviderFactory.js';

type StoreRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
  blogProvider?: BlogContentProvider | null;
  blogProviderClient?: OpenAIBlogParseClient | null;
  blogDraftV2ProviderOptions?: BlogDraftV2ProviderFactoryOptions;
};

const OptionalTextSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() || null : value ?? null),
  z.string().nullable()
).optional();

const StoreBodySchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  naverPlaceUrl: OptionalTextSchema,
  naverPlaceId: OptionalTextSchema,
  category: OptionalTextSchema,
  address: OptionalTextSchema,
  phone: OptionalTextSchema,
  description: OptionalTextSchema,
  metadata: z.record(z.unknown()).optional()
});

const StorePatchSchema = StoreBodySchema.partial().extend({
  name: z.string().trim().min(1).optional()
});

const ImportPlaceBodySchema = z.object({
  naverPlaceUrl: z.string().trim().min(1)
});

const ChannelSettingsSchema = z.object({
  enabled: z.boolean(),
  sourceUrl: OptionalTextSchema,
  blogPostLimit: z.number().int().min(0).max(1000).optional(),
  placeReviewLimit: z.number().int().min(0).max(1000).optional(),
  instagramPostLimit: z.number().int().min(0).max(1000).optional(),
  daangnPostLimit: z.number().int().min(0).max(1000).optional()
});

const TrainingSettingsBodySchema = z.object({
  channels: z.object({
    naverBlog: ChannelSettingsSchema,
    naverPlace: ChannelSettingsSchema,
    instagram: ChannelSettingsSchema,
    daangn: ChannelSettingsSchema.optional(),
    youtube: ChannelSettingsSchema.optional(),
    tiktok: ChannelSettingsSchema.optional()
  })
});

const RulesetFieldPatchSchema = z.object({
  userValue: z.string().trim().min(1).max(4000)
});

const BlogFormulaV2GeneratePostBodySchema = z.object({
  formulaSetId: z.string().trim().min(1).optional(),
  topicBriefSetId: z.string().trim().min(1),
  providerMode: z.enum(['deterministic', 'safe_mock', 'openai', 'auto']).optional()
});

const BlogFormulaV2BatchCandidateQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3)
});

const RulesetPreviewRequestSchema = z.object({
  channel: z.literal('blog'),
  topic: z.string().trim().min(1).max(120).default('딸기 생크림 케이크 예약 안내'),
  variantIndex: z.number().int().min(0).max(20).default(0)
});

function sanitizeStoreId(seed: string) {
  const sanitized = seed
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return sanitized || createHash('sha1').update(seed).digest('hex').slice(0, 10);
}

function generatedStoreId(input: { id?: string; name: string; naverPlaceUrl?: string | null }) {
  if (input.id) return input.id;
  const parsed = input.naverPlaceUrl ? parseNaverPlaceUrl(input.naverPlaceUrl) : null;
  if (parsed?.candidateId) return `store_${sanitizeStoreId(parsed.candidateId)}`;
  return `store_${sanitizeStoreId(input.name)}_${createHash('sha1').update(input.name).digest('hex').slice(0, 8)}`;
}

function toJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function mergeMetadata(existing: JsonValue, patch: unknown) {
  return {
    ...toJsonRecord(existing),
    ...toJsonRecord(patch)
  };
}

function channelId(storeId: string, channel: string) {
  return `channel_${storeId}_${channel}`;
}

function trainingSettingsId(storeId: string) {
  return `training_settings_${storeId}`;
}

function collectionRunId(storeId: string) {
  return `collection_run_${storeId}_${Date.now()}`;
}

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function defaultTrainingSettings() {
  return {
    channels: {
      naverBlog: { enabled: true, blogPostLimit: 50, sourceUrl: null },
      naverPlace: { enabled: true, placeReviewLimit: 50, sourceUrl: null },
      instagram: { enabled: false, instagramPostLimit: 0, sourceUrl: null },
      daangn: { enabled: false, daangnPostLimit: 0, sourceUrl: null },
      youtube: { enabled: false, sourceUrl: null },
      tiktok: { enabled: false, sourceUrl: null }
    }
  };
}

function numberFromLegacy(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanFromLegacy(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function textFromLegacy(value: unknown, fallback: string | null = null) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeTrainingSettings(value: unknown) {
  const settings = toJsonRecord(value);
  const channels = toJsonRecord(settings.channels);
  const naverBlog = toJsonRecord(channels.naverBlog);
  const naverPlace = toJsonRecord(channels.naverPlace);
  const instagram = toJsonRecord(channels.instagram);
  const daangn = toJsonRecord(channels.daangn);
  const youtube = toJsonRecord(channels.youtube);
  const tiktok = toJsonRecord(channels.tiktok);
  const legacyBlog = toJsonRecord(channels.blog);
  const legacyPlace = toJsonRecord(channels.place);

  return TrainingSettingsBodySchema.parse({
    channels: {
      naverBlog: {
        enabled: booleanFromLegacy(naverBlog.enabled, booleanFromLegacy(legacyBlog.enabled, true)),
        blogPostLimit: numberFromLegacy(naverBlog.blogPostLimit, numberFromLegacy(legacyBlog.postLimit, 50)),
        sourceUrl: textFromLegacy(naverBlog.sourceUrl, textFromLegacy(legacyBlog.sourceUrl))
      },
      naverPlace: {
        enabled: booleanFromLegacy(naverPlace.enabled, booleanFromLegacy(legacyPlace.enabled, true)),
        placeReviewLimit: numberFromLegacy(
          naverPlace.placeReviewLimit,
          booleanFromLegacy(legacyPlace.includeReviews, true) ? 50 : 0
        ),
        sourceUrl: textFromLegacy(naverPlace.sourceUrl, textFromLegacy(legacyPlace.sourceUrl))
      },
      instagram: {
        enabled: booleanFromLegacy(instagram.enabled, false),
        instagramPostLimit: numberFromLegacy(instagram.instagramPostLimit, 0),
        sourceUrl: textFromLegacy(instagram.sourceUrl)
      },
      daangn: {
        enabled: booleanFromLegacy(daangn.enabled, false),
        daangnPostLimit: numberFromLegacy(daangn.daangnPostLimit, 0),
        sourceUrl: textFromLegacy(daangn.sourceUrl)
      },
      youtube: {
        enabled: false,
        sourceUrl: textFromLegacy(youtube.sourceUrl)
      },
      tiktok: {
        enabled: false,
        sourceUrl: textFromLegacy(tiktok.sourceUrl)
      }
    }
  });
}

function channelSourceUrl(channels: StoreChannel[], channelName: string) {
  const channel = channels.find((item) => item.channel === channelName);
  return channel?.sourceUrl ?? null;
}

function collectionPlanFromSettings(
  settings: ReturnType<typeof normalizeTrainingSettings>,
  env: ProviderEnv,
  storeChannels: ReturnType<ReturnType<typeof createStoreLearningRepositories>['storeChannels']['listByStoreId']> = []
) {
  const channels = settings.channels;
  return {
    requestedLimits: {
      blogPostLimit: channels.naverBlog.blogPostLimit ?? 0,
      placeReviewLimit: channels.naverPlace.placeReviewLimit ?? 0,
      instagramPostLimit: channels.instagram.instagramPostLimit ?? 0,
      daangnPostLimit: channels.daangn?.daangnPostLimit ?? 0
    },
    sourceUrls: {
      naverBlog: channels.naverBlog.sourceUrl ?? null,
      naverPlace: channels.naverPlace.sourceUrl ?? null,
      instagram: channels.instagram.sourceUrl ?? channelSourceUrl(storeChannels, 'instagram'),
      daangn: channels.daangn?.sourceUrl ?? channelSourceUrl(storeChannels, 'daangn'),
      youtube: channels.youtube?.sourceUrl ?? channelSourceUrl(storeChannels, 'youtube'),
      tiktok: channels.tiktok?.sourceUrl ?? channelSourceUrl(storeChannels, 'tiktok')
    },
    channelPlan: {
      naverBlog: {
        enabled: channels.naverBlog.enabled,
        limit: channels.naverBlog.blogPostLimit ?? 0
      },
      naverPlace: {
        enabled: channels.naverPlace.enabled,
        limit: channels.naverPlace.placeReviewLimit ?? 0
      },
      instagram: {
        enabled: channels.instagram.enabled,
        limit: channels.instagram.instagramPostLimit ?? 0
      },
      daangn: {
        enabled: channels.daangn?.enabled ?? false,
        limit: channels.daangn?.daangnPostLimit ?? 0
      }
    },
    sourcePolicy: ownerSourcePolicy(env)
  };
}

function upsertPlaceChannel(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  store: Store,
  provider: PlaceImportProvider | null,
  env: ProviderEnv
) {
  if (!store.naverPlaceUrl) return null;

  return repos.storeChannels.upsert({
    id: channelId(store.id, 'place'),
    storeId: store.id,
    channel: 'place',
    sourceUrl: store.naverPlaceUrl,
    status: 'connected',
    providerMode: provider?.mode ?? 'parser',
    settings: {
      providerName: provider?.name ?? 'manual',
      naverPlaceId: store.naverPlaceId,
      configuredPlaceProvider: configuredPlaceProvider(env),
      ...sourceMetadata('place_profile', env)
    }
  });
}

function providerModeForDetectedChannel(channel: StoreExternalChannel['channel'], env: ProviderEnv) {
  if (channel === 'blog') return providerModeFromConfig(configuredBlogProvider(env));
  return 'provider_ready';
}

function providerSettingsForDetectedChannel(channel: StoreExternalChannel['channel'], link: StoreExternalChannel, env: ProviderEnv) {
  const base = {
    providerName: 'naverPlaceDetectedChannel',
    detectedFrom: 'naver_place',
    label: link.label
  };
  if (channel === 'blog') {
    return {
      ...base,
      configuredBlogProvider: configuredBlogProvider(env),
      ...sourceMetadata('owner_blog_post', env)
    };
  }
  return {
    ...base,
    providerScope: 'not_implemented'
  };
}

function detectedExternalChannelLinks(store: Store) {
  const metadata = toJsonRecord(store.metadata);
  const parsedPlace = toJsonRecord(metadata.naverPlaceParsed);
  return extractExternalChannelLinks([metadata.externalChannelLinks, parsedPlace.externalChannelLinks]);
}

function upsertDetectedExternalChannels(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  store: Store,
  env: ProviderEnv
) {
  for (const link of detectedExternalChannelLinks(store)) {
    repos.storeChannels.upsert({
      id: channelId(store.id, link.channel),
      storeId: store.id,
      channel: link.channel,
      sourceUrl: link.url,
      status: 'connected',
      providerMode: providerModeForDetectedChannel(link.channel, env),
      settings: providerSettingsForDetectedChannel(link.channel, link, env)
    });
  }
}

function providerModeFromConfig(provider: string) {
  return provider === 'mock' ? 'mock' : 'real';
}

function upsertTrainingSourceChannel(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  input: {
    store: Store;
    channel: string;
    sourceUrl: string | null | undefined;
    enabled: boolean;
    limit: number;
    providerName: string;
    providerMode: string;
    settings: JsonRecord;
  }
) {
  const existing =
    repos.storeChannels.listByStoreId(input.store.id).find((channel) => channel.channel === input.channel) ??
    repos.storeChannels.findById(channelId(input.store.id, input.channel));
  const id = existing?.id ?? channelId(input.store.id, input.channel);
  if (!existing && input.sourceUrl === undefined) return null;
  const sourceUrl = input.sourceUrl === undefined ? existing?.sourceUrl ?? null : input.sourceUrl;
  const existingSettings = toJsonRecord(existing?.settings);

  return repos.storeChannels.upsert({
    id,
    storeId: input.store.id,
    channel: input.channel,
    sourceUrl,
    status: sourceUrl ? 'connected' : input.enabled ? 'missing_url' : 'not_connected',
    providerMode: input.providerMode,
    settings: {
      ...existingSettings,
      ...input.settings,
      providerName: input.providerName,
      enabled: input.enabled,
      limit: input.limit
    }
  });
}

function syncTrainingSourceChannels(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  store: Store,
  settings: ReturnType<typeof normalizeTrainingSettings>,
  env: ProviderEnv
) {
  const blogProvider = configuredBlogProvider(env);
  const placeProvider = configuredPlaceProvider(env);

  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'blog',
    sourceUrl: settings.channels.naverBlog.sourceUrl,
    enabled: settings.channels.naverBlog.enabled,
    limit: settings.channels.naverBlog.blogPostLimit ?? 0,
    providerName: 'trainingSettings',
    providerMode: providerModeFromConfig(blogProvider),
    settings: {
      configuredBlogProvider: blogProvider,
      ...sourceMetadata('owner_blog_post', env)
    }
  });

  const placeSourceUrl = settings.channels.naverPlace.sourceUrl;
  if (placeSourceUrl && placeSourceUrl !== store.naverPlaceUrl) {
    repos.stores.update(store.id, {
      naverPlaceUrl: placeSourceUrl,
      naverPlaceId: store.naverPlaceId ?? parseNaverPlaceUrl(placeSourceUrl)?.candidateId ?? null
    });
  }
  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'place',
    sourceUrl: placeSourceUrl,
    enabled: settings.channels.naverPlace.enabled,
    limit: settings.channels.naverPlace.placeReviewLimit ?? 0,
    providerName: 'trainingSettings',
    providerMode: providerModeFromConfig(placeProvider),
    settings: {
      configuredPlaceProvider: placeProvider,
      ...sourceMetadata('place_profile', env)
    }
  });

  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'instagram',
    sourceUrl: settings.channels.instagram.sourceUrl,
    enabled: settings.channels.instagram.enabled,
    limit: settings.channels.instagram.instagramPostLimit ?? 0,
    providerName: 'trainingSettings',
    providerMode: 'manual',
    settings: {
      providerScope: 'not_implemented'
    }
  });

  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'daangn',
    sourceUrl: settings.channels.daangn?.sourceUrl || undefined,
    enabled: settings.channels.daangn?.enabled ?? false,
    limit: settings.channels.daangn?.daangnPostLimit ?? 0,
    providerName: 'trainingSettings',
    providerMode: 'manual',
    settings: {
      providerScope: 'not_implemented'
    }
  });

  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'youtube',
    sourceUrl: settings.channels.youtube?.sourceUrl || undefined,
    enabled: false,
    limit: 0,
    providerName: 'trainingSettings',
    providerMode: 'provider_ready',
    settings: {
      providerScope: 'not_implemented'
    }
  });

  upsertTrainingSourceChannel(repos, {
    store,
    channel: 'tiktok',
    sourceUrl: settings.channels.tiktok?.sourceUrl || undefined,
    enabled: false,
    limit: 0,
    providerName: 'trainingSettings',
    providerMode: 'provider_ready',
    settings: {
      providerScope: 'not_implemented'
    }
  });
}

function serializeStore(repos: ReturnType<typeof createStoreLearningRepositories>, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;
  return {
    store,
    channels: repos.storeChannels.listByStoreId(store.id)
  };
}

export function createStoreRoutes({
  connection,
  env = process.env,
  blogProvider,
  blogProviderClient,
  blogDraftV2ProviderOptions
}: StoreRoutesOptions) {
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

  function routeParam(req: express.Request, name: string) {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
  }

  function sendRuleset(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const payload = buildMarketingRulesetPayload(repos, storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${storeId}` });
      return;
    }
    res.json(payload);
  }

  function sendRulesetVersions(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const payload = buildRulesetVersionsPayload(repos, storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${storeId}` });
      return;
    }
    res.json(payload);
  }

  function sendRulesetVersion(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const rulesetId = routeParam(req, 'rulesetId');
    const payload = buildMarketingRulesetVersionPayload(repos, storeId, rulesetId);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${storeId}` });
      return;
    }
    if (!payload.ruleset) {
      res.status(404).json({ error: `Ruleset not found: ${rulesetId}` });
      return;
    }
    res.json(payload);
  }

  function restoreRulesetVersion(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const rulesetId = routeParam(req, 'rulesetId');
    const payload = restoreMarketingRulesetVersion(repos, storeId, rulesetId);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${storeId}` });
      return;
    }
    if (!payload.ruleset) {
      res.status(404).json({ error: `Ruleset not found: ${rulesetId}` });
      return;
    }
    res.json(payload);
  }

  function patchRulesetField(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      const storeId = routeParam(req, 'storeId');
      const fieldKey = routeParam(req, 'fieldKey');
      const body = RulesetFieldPatchSchema.parse(req.body);
      const payload = updateRulesetFieldValue(repos, storeId, fieldKey, body.userValue);
      if (!payload) {
        res.status(404).json({ error: `Store or ruleset not found: ${storeId}` });
        return;
      }
      if (!payload.field) {
        res.status(404).json({ error: `Ruleset field not found: ${fieldKey}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }

  function resetRulesetField(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const fieldKey = routeParam(req, 'fieldKey');
    const payload = resetRulesetFieldValue(repos, storeId, fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${fieldKey}` });
      return;
    }
    res.json(payload);
  }

  function sendRulesetFieldEvidence(req: express.Request, res: express.Response) {
    const storeId = routeParam(req, 'storeId');
    const fieldKey = routeParam(req, 'fieldKey');
    const payload = buildRulesetFieldEvidence(repos, storeId, fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${fieldKey}` });
      return;
    }
    res.json(payload);
  }

  router.post('/import-place', async (req, res, next) => {
    try {
      const body = ImportPlaceBodySchema.parse(req.body);
      const imported = await importNaverPlaceUrl(body.naverPlaceUrl, env);
      const store = repos.stores.upsert({
        ...imported.store,
        metadata: imported.store.metadata
      });
      const channel = upsertPlaceChannel(repos, store, imported.provider, env);
      upsertDetectedExternalChannels(repos, store, env);
      res.json({ store, channel, provider: imported.provider });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', (req, res, next) => {
    try {
      const body = StoreBodySchema.parse(req.body);
      const store = repos.stores.upsert({
        id: generatedStoreId(body),
        name: body.name,
        naverPlaceUrl: body.naverPlaceUrl ?? null,
        naverPlaceId: body.naverPlaceId ?? parseNaverPlaceUrl(body.naverPlaceUrl ?? '')?.candidateId ?? null,
        category: body.category ?? null,
        address: body.address ?? null,
        phone: body.phone ?? null,
        description: body.description ?? null,
        metadata: toJsonRecord(body.metadata)
      });
      const channel = upsertPlaceChannel(repos, store, null, env);
      upsertDetectedExternalChannels(repos, store, env);
      res.json({ store, channel });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:storeId', (req, res) => {
    const payload = serializeStore(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/latest-analysis', (req, res) => {
    const store = repos.stores.findById(req.params.storeId);
    if (!store) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }

    const artifacts = getLatestAnalysisArtifacts(repos, store.id);
    if (!artifacts) {
      res.status(404).json({ error: `Latest analysis not found for store: ${store.id}` });
      return;
    }

    res.json(artifacts);
  });

  router.get('/:storeId/learning-status', (req, res) => {
    const payload = buildLearningStatus(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/learning-status/blog', (req, res) => {
    const payload = buildBlogLearningStatus(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/learning-status/place', (req, res) => {
    const payload = buildPlaceLearningStatus(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/learning-status/instagram', (req, res) => {
    const payload = buildInstagramLearningStatus(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/strategy-ruleset', sendRuleset);
  router.get('/:storeId/ruleset', sendRuleset);

  router.get('/:storeId/strategy-ruleset/versions', sendRulesetVersions);
  router.get('/:storeId/strategy-ruleset/versions/:rulesetId', sendRulesetVersion);
  router.post('/:storeId/strategy-ruleset/versions/:rulesetId/restore', restoreRulesetVersion);

  router.patch('/:storeId/strategy-ruleset/fields/:fieldKey', patchRulesetField);
  router.patch('/:storeId/ruleset/fields/:fieldKey', patchRulesetField);

  router.post('/:storeId/strategy-ruleset/fields/:fieldKey/reset', resetRulesetField);
  router.post('/:storeId/ruleset/fields/:fieldKey/reset', resetRulesetField);

  router.get('/:storeId/strategy-ruleset/fields/:fieldKey/evidence', sendRulesetFieldEvidence);
  router.get('/:storeId/ruleset/fields/:fieldKey/evidence', sendRulesetFieldEvidence);

  router.get('/:storeId/strategy-ruleset/benchmark-evidence', (req, res) => {
    const storeId = routeParam(req, 'storeId');
    const store = repos.stores.findById(storeId);
    if (!store) {
      res.status(404).json({ error: `Store not found: ${storeId}` });
      return;
    }
    res.json(buildRulesetBenchmarkPayload(storeId));
  });

  router.post('/:storeId/strategy-ruleset/regenerate-preview', (req, res, next) => {
    try {
      const storeId = routeParam(req, 'storeId');
      const store = repos.stores.findById(storeId);
      if (!store) {
        res.status(404).json({ error: `Store not found: ${storeId}` });
        return;
      }
      const body = RulesetPreviewRequestSchema.parse(req.body);
      res.json(
        buildRulesetPreviewPayload({
          storeName: store.name,
          channel: body.channel,
          topic: body.topic,
          variantIndex: body.variantIndex
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/:storeId/blog-posts/generate', async (req, res, next) => {
    try {
      const payload = await generateApprovalPendingBlogPost(repos, req.params.storeId, selectedBlogProvider);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:storeId/blog-posts/v2-batch-candidates', (req, res, next) => {
    try {
      const query = BlogFormulaV2BatchCandidateQuerySchema.parse(req.query);
      res.json({ topicBriefSets: selectTopicBriefSetsForV2Batch(repos, req.params.storeId, query.limit) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:storeId/blog-posts/generate-from-v2-formula', async (req, res, next) => {
    try {
      const body = BlogFormulaV2GeneratePostBodySchema.parse(req.body ?? {});
      const providerMode = body.providerMode ?? 'openai';
      const provider = createBlogDraftV2ProviderForMode(providerMode, {
        env,
        ...(blogDraftV2ProviderOptions ?? {})
      });
      const payload = await generateApprovalPendingBlogPostFromV2Formula(repos, req.params.storeId, {
        formulaSetId: body.formulaSetId,
        topicBriefSetId: body.topicBriefSetId,
        providerMode,
        provider
      });
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:storeId/blog-posts', (req, res) => {
    const source = req.query.source === 'blog_formula_v2' ? 'blog_formula_v2' : undefined;
    const payload = listBlogPostsForStore(repos, req.params.storeId, { source });
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.patch('/:storeId', (req, res, next) => {
    try {
      const body = StorePatchSchema.parse(req.body);
      const existing = repos.stores.findById(req.params.storeId);
      if (!existing) {
        res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
        return;
      }

      const nextNaverPlaceUrl = body.naverPlaceUrl !== undefined ? body.naverPlaceUrl : existing.naverPlaceUrl;
      const store = repos.stores.update(existing.id, {
        name: body.name ?? existing.name,
        naverPlaceUrl: nextNaverPlaceUrl,
        naverPlaceId:
          body.naverPlaceId !== undefined
            ? body.naverPlaceId
            : existing.naverPlaceId ?? parseNaverPlaceUrl(nextNaverPlaceUrl ?? '')?.candidateId ?? null,
        category: body.category !== undefined ? body.category : existing.category,
        address: body.address !== undefined ? body.address : existing.address,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        description: body.description !== undefined ? body.description : existing.description,
        metadata: mergeMetadata(existing.metadata, body.metadata)
      });
      const channel = upsertPlaceChannel(repos, store, null, env);
      upsertDetectedExternalChannels(repos, store, env);
      res.json({ store, channel, channels: repos.storeChannels.listByStoreId(store.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:storeId/training-settings', (req, res) => {
    const store = repos.stores.findById(req.params.storeId);
    if (!store) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }

    const existing = latestByUpdatedAt(repos.trainingSettings.listByStoreId(store.id));
    if (!existing) {
      res.json({
        settings: {
          id: trainingSettingsId(store.id),
          storeId: store.id,
          status: 'draft',
          settings: defaultTrainingSettings()
        }
      });
      return;
    }

    res.json({ settings: existing });
  });

  router.put('/:storeId/training-settings', (req, res, next) => {
    try {
      const store = repos.stores.findById(req.params.storeId);
      if (!store) {
        res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
        return;
      }

      const body = normalizeTrainingSettings(req.body);
      const existing = latestByUpdatedAt(repos.trainingSettings.listByStoreId(store.id));
      const settings = repos.trainingSettings.upsert({
        id: existing?.id ?? trainingSettingsId(store.id),
        storeId: store.id,
        status: 'ready',
        settings: body
      });
      syncTrainingSourceChannels(repos, store, body, env);
      res.json({ settings });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:storeId/collection-runs', (req, res, next) => {
    try {
      const store = repos.stores.findById(req.params.storeId);
      if (!store) {
        res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
        return;
      }

      const existing = latestByUpdatedAt(repos.trainingSettings.listByStoreId(store.id));
      const settings = normalizeTrainingSettings(existing?.settings ?? defaultTrainingSettings());
      const storeChannels = repos.storeChannels.listByStoreId(store.id);
      const run = repos.collectionRuns.create({
        id: collectionRunId(store.id),
        storeId: store.id,
        status: 'queued',
        mode: 'mock',
        startedAt: null,
        completedAt: null,
        summary: collectionPlanFromSettings(settings, env, storeChannels)
      });

      res.json({ collectionRunId: run.id, collectionRun: run });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
