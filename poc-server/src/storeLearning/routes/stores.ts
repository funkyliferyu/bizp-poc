import express from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DbConnection } from '../../db/connection.js';
import type { JsonValue } from '../../repositories/base.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { Store } from '../../repositories/stores.js';
import { importNaverPlaceUrl } from '../providers/placeImportService.js';
import type { JsonRecord, PlaceImportProvider, ProviderEnv } from '../providers/placeImportTypes.js';
import { parseNaverPlaceUrl } from '../providers/naverPlaceUrlParser.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';
import {
  buildBlogLearningStatus,
  buildInstagramLearningStatus,
  buildLearningStatus,
  buildPlaceLearningStatus
} from '../learning/learningStatusService.js';
import {
  buildMarketingRulesetPayload,
  buildRulesetFieldEvidence,
  resetRulesetFieldValue,
  updateRulesetFieldValue
} from '../rulesets/rulesetService.js';

type StoreRoutesOptions = {
  connection: DbConnection;
  env?: ProviderEnv;
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
  blogPostLimit: z.number().int().min(0).max(1000).optional(),
  placeReviewLimit: z.number().int().min(0).max(1000).optional(),
  instagramPostLimit: z.number().int().min(0).max(1000).optional()
});

const TrainingSettingsBodySchema = z.object({
  channels: z.object({
    naverBlog: ChannelSettingsSchema,
    naverPlace: ChannelSettingsSchema,
    instagram: ChannelSettingsSchema
  })
});

const RulesetFieldPatchSchema = z.object({
  userValue: z.string().trim().min(1).max(4000)
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
      naverBlog: { enabled: true, blogPostLimit: 50 },
      naverPlace: { enabled: true, placeReviewLimit: 50 },
      instagram: { enabled: false, instagramPostLimit: 0 }
    }
  };
}

function numberFromLegacy(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanFromLegacy(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeTrainingSettings(value: unknown) {
  const settings = toJsonRecord(value);
  const channels = toJsonRecord(settings.channels);
  const naverBlog = toJsonRecord(channels.naverBlog);
  const naverPlace = toJsonRecord(channels.naverPlace);
  const instagram = toJsonRecord(channels.instagram);
  const legacyBlog = toJsonRecord(channels.blog);
  const legacyPlace = toJsonRecord(channels.place);

  return TrainingSettingsBodySchema.parse({
    channels: {
      naverBlog: {
        enabled: booleanFromLegacy(naverBlog.enabled, booleanFromLegacy(legacyBlog.enabled, true)),
        blogPostLimit: numberFromLegacy(naverBlog.blogPostLimit, numberFromLegacy(legacyBlog.postLimit, 50))
      },
      naverPlace: {
        enabled: booleanFromLegacy(naverPlace.enabled, booleanFromLegacy(legacyPlace.enabled, true)),
        placeReviewLimit: numberFromLegacy(
          naverPlace.placeReviewLimit,
          booleanFromLegacy(legacyPlace.includeReviews, true) ? 50 : 0
        )
      },
      instagram: {
        enabled: booleanFromLegacy(instagram.enabled, false),
        instagramPostLimit: numberFromLegacy(instagram.instagramPostLimit, 0)
      }
    }
  });
}

function collectionPlanFromSettings(settings: ReturnType<typeof normalizeTrainingSettings>) {
  const channels = settings.channels;
  return {
    requestedLimits: {
      blogPostLimit: channels.naverBlog.blogPostLimit ?? 0,
      placeReviewLimit: channels.naverPlace.placeReviewLimit ?? 0,
      instagramPostLimit: channels.instagram.instagramPostLimit ?? 0
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
      }
    }
  };
}

function upsertPlaceChannel(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  store: Store,
  provider: PlaceImportProvider | null
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
      naverPlaceId: store.naverPlaceId
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

export function createStoreRoutes({ connection, env = process.env }: StoreRoutesOptions) {
  const router = express.Router();
  const repos = createStoreLearningRepositories(connection);

  router.post('/import-place', async (req, res, next) => {
    try {
      const body = ImportPlaceBodySchema.parse(req.body);
      const imported = await importNaverPlaceUrl(body.naverPlaceUrl, env);
      const store = repos.stores.upsert({
        ...imported.store,
        metadata: imported.store.metadata
      });
      const channel = upsertPlaceChannel(repos, store, imported.provider);
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
      const channel = upsertPlaceChannel(repos, store, null);
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

  router.get('/:storeId/ruleset', (req, res) => {
    const payload = buildMarketingRulesetPayload(repos, req.params.storeId);
    if (!payload) {
      res.status(404).json({ error: `Store not found: ${req.params.storeId}` });
      return;
    }
    res.json(payload);
  });

  router.patch('/:storeId/ruleset/fields/:fieldKey', (req, res, next) => {
    try {
      const body = RulesetFieldPatchSchema.parse(req.body);
      const payload = updateRulesetFieldValue(repos, req.params.storeId, req.params.fieldKey, body.userValue);
      if (!payload) {
        res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
        return;
      }
      if (!payload.field) {
        res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
        return;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:storeId/ruleset/fields/:fieldKey/reset', (req, res) => {
    const payload = resetRulesetFieldValue(repos, req.params.storeId, req.params.fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
      return;
    }
    res.json(payload);
  });

  router.get('/:storeId/ruleset/fields/:fieldKey/evidence', (req, res) => {
    const payload = buildRulesetFieldEvidence(repos, req.params.storeId, req.params.fieldKey);
    if (!payload) {
      res.status(404).json({ error: `Store or ruleset not found: ${req.params.storeId}` });
      return;
    }
    if (!payload.field) {
      res.status(404).json({ error: `Ruleset field not found: ${req.params.fieldKey}` });
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
      const channel = upsertPlaceChannel(repos, store, null);
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

      const body = TrainingSettingsBodySchema.parse(req.body);
      const existing = latestByUpdatedAt(repos.trainingSettings.listByStoreId(store.id));
      const settings = repos.trainingSettings.upsert({
        id: existing?.id ?? trainingSettingsId(store.id),
        storeId: store.id,
        status: 'ready',
        settings: body
      });
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
      const run = repos.collectionRuns.create({
        id: collectionRunId(store.id),
        storeId: store.id,
        status: 'queued',
        mode: 'mock',
        startedAt: null,
        completedAt: null,
        summary: collectionPlanFromSettings(settings)
      });

      res.json({ collectionRunId: run.id, collectionRun: run });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
