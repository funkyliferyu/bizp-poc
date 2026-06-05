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

  return router;
}
