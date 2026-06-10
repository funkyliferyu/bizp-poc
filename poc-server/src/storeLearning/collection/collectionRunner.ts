import type { JsonValue } from '../../repositories/base.js';
import type { CollectionRun } from '../../repositories/collection_runs.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import { configuredPlaceProvider, sourceMetadata, type SourceKind } from '../providers/ownerSourcePolicy.js';
import {
  canUseRealNaverCollection,
  type CollectionPlan,
  type CollectionProvider,
  type CollectionProviderItemDraft
} from './collectionProviders.js';
import { collectionItemIdentity, collectionProfileFingerprint } from './collectionItemIdentity.js';
import { createMockCollectionProvider } from './mockCollectionProvider.js';
import { createNaverBlogRenderedCollectionProvider, isRenderedBlogCollectionProvider } from './naverBlogRenderedCollectionProvider.js';
import { createNaverPlaceRenderedCollectionProvider } from './naverPlaceRenderedCollectionProvider.js';
import { createNaverSearchCollectionProvider } from './naverSearchCollectionProvider.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;
type CollectionDeltaState = 'new' | 'duplicate' | 'unchanged' | 'changed';
type CollectionDeltaSummary = {
  counts: Record<CollectionDeltaState, number>;
  byChannel: Record<string, Record<CollectionDeltaState, number>>;
  hasMeaningfulChanges: boolean;
};

export type CollectionRunnerOptions = {
  env?: ProviderEnv;
  stepDelayMs?: number;
};

const activeRuns = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asLimit(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function readPlan(run: CollectionRun): CollectionPlan {
  const summary = asRecord(run.summary);
  const requestedLimits = asRecord(summary.requestedLimits);
  const channelPlan = asRecord(summary.channelPlan);
  const naverBlog = asRecord(channelPlan.naverBlog);
  const naverPlace = asRecord(channelPlan.naverPlace);

  return {
    blogPostLimit: asBoolean(naverBlog.enabled, true) ? asLimit(requestedLimits.blogPostLimit) : 0,
    placeReviewLimit: asBoolean(naverPlace.enabled, true) ? asLimit(requestedLimits.placeReviewLimit) : 0,
    includePlaceProfile: asBoolean(naverPlace.enabled, true)
  };
}

function collectionProvider(env: ProviderEnv): CollectionProvider {
  if (configuredPlaceProvider(env) === 'rendered') return createNaverPlaceRenderedCollectionProvider();
  if (isRenderedBlogCollectionProvider(env)) return createNaverBlogRenderedCollectionProvider();
  if (canUseRealNaverCollection(env)) return createNaverSearchCollectionProvider();
  return createMockCollectionProvider();
}

function itemId(runId: string, sourceType: string, index: number) {
  return `collection_item_${runId}_${sourceType}_${index}`;
}

function sourceKindForDraft(draft: CollectionProviderItemDraft): SourceKind {
  if (draft.channel === 'place' && draft.sourceType === 'profile') return 'place_profile';
  if (draft.channel === 'place' && draft.sourceType === 'review') return 'place_visitor_review';
  return 'owner_blog_post';
}

function defaultBodyAvailability(draft: CollectionProviderItemDraft, provider: CollectionProvider) {
  if (draft.bodyText) return provider.mode === 'mock' ? 'mock_body' : 'provider_body';
  if (draft.status === 'failed') return 'unavailable';
  return 'metadata_only';
}

function enrichItemMetadata(
  draft: CollectionProviderItemDraft,
  provider: CollectionProvider,
  env: ProviderEnv,
  deltaState: CollectionDeltaState,
  profileFingerprint: string | null
): JsonRecord {
  return {
    bodyAvailability: defaultBodyAvailability(draft, provider),
    ...draft.metadata,
    ...sourceMetadata(sourceKindForDraft(draft), env),
    collectionDelta: deltaState,
    ...(profileFingerprint ? { profileFingerprint } : {})
  };
}

function emptyDeltaSummary(): CollectionDeltaSummary {
  return {
    counts: { new: 0, duplicate: 0, unchanged: 0, changed: 0 },
    byChannel: {},
    hasMeaningfulChanges: false
  };
}

function incrementDelta(summary: CollectionDeltaSummary, channel: string, state: CollectionDeltaState) {
  summary.counts[state] += 1;
  summary.byChannel[channel] ??= { new: 0, duplicate: 0, unchanged: 0, changed: 0 };
  summary.byChannel[channel][state] += 1;
  if (state === 'new' || state === 'changed') summary.hasMeaningfulChanges = true;
}

function latestByCreatedAt<T extends { createdAt: string }>(records: T[]) {
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1) ?? null;
}

function existingProfileMatch(repos: Repositories, storeId: string, draft: CollectionProviderItemDraft) {
  const key = collectionItemIdentity(draft);
  if (!key) return null;
  return latestByCreatedAt(
    repos.collectionItems
      .listByStoreId(storeId)
      .filter((item) => item.status !== 'failed' && item.runId && collectionItemIdentity(item) === key)
  );
}

async function ensureProviderItems(
  repos: Repositories,
  run: CollectionRun,
  provider: CollectionProvider,
  env: ProviderEnv
) {
  const store = repos.stores.findById(run.storeId);
  if (!store) {
    throw new Error(`Store not found for collection run: ${run.storeId}`);
  }

  const drafts = await provider.collect({
    env,
    plan: readPlan(run),
    store,
    storeChannels: repos.storeChannels.listByStoreId(store.id)
  });
  const existingKeys = new Set(
    repos.collectionItems
      .listByStoreId(run.storeId)
      .filter((item) => item.runId !== run.id && item.status !== 'failed' && item.sourceType !== 'profile')
      .map(collectionItemIdentity)
      .filter((key): key is string => Boolean(key))
  );
  const currentRunKeys = new Set<string>();
  const deltaSummary = emptyDeltaSummary();
  const uniqueDrafts = drafts.flatMap((draft) => {
    if (draft.status === 'failed') {
      incrementDelta(deltaSummary, draft.channel, 'new');
      return [{ draft, deltaState: 'new' as CollectionDeltaState, profileFingerprint: null }];
    }

    if (draft.channel === 'place' && draft.sourceType === 'profile') {
      const profileFingerprint = collectionProfileFingerprint(draft);
      const existingProfile = existingProfileMatch(repos, run.storeId, draft);
      if (!existingProfile) {
        incrementDelta(deltaSummary, draft.channel, 'new');
        return [{ draft, deltaState: 'new' as CollectionDeltaState, profileFingerprint }];
      }
      const existingFingerprint = collectionProfileFingerprint(existingProfile);
      if (existingFingerprint && existingFingerprint === profileFingerprint) {
        incrementDelta(deltaSummary, draft.channel, 'unchanged');
        return [];
      }
      incrementDelta(deltaSummary, draft.channel, 'changed');
      return [{ draft, deltaState: 'changed' as CollectionDeltaState, profileFingerprint }];
    }

    const key = collectionItemIdentity(draft);
    if (!key) {
      incrementDelta(deltaSummary, draft.channel, 'new');
      return [{ draft, deltaState: 'new' as CollectionDeltaState, profileFingerprint: null }];
    }
    if (existingKeys.has(key) || currentRunKeys.has(key)) {
      incrementDelta(deltaSummary, draft.channel, 'duplicate');
      return [];
    }
    currentRunKeys.add(key);
    incrementDelta(deltaSummary, draft.channel, 'new');
    return [{ draft, deltaState: 'new' as CollectionDeltaState, profileFingerprint: null }];
  });

  const items = uniqueDrafts.map(({ draft, deltaState, profileFingerprint }, index) =>
    repos.collectionItems.upsert({
      id: itemId(run.id, draft.sourceType, index + 1),
      runId: run.id,
      storeId: run.storeId,
      channel: draft.channel,
      sourceType: draft.sourceType,
      status: draft.status ?? 'pending',
      sourceUrl: draft.sourceUrl,
      title: draft.title,
      bodyText: draft.bodyText,
      selectedForAnalysis: 0,
      selectionReason: null,
      selectedAt: null,
      metadata: enrichItemMetadata(draft, provider, env, deltaState, profileFingerprint)
    })
  );

  return { items, deltaSummary };
}

function summarizeItems(repos: Repositories, run: CollectionRun) {
  const items = repos.collectionItems.listByRunId(run.id);
  const summary = asRecord(run.summary);
  const requestedLimits = asRecord(summary.requestedLimits);
  const blogPostLimit = asLimit(requestedLimits.blogPostLimit);
  const placeReviewLimit = asLimit(requestedLimits.placeReviewLimit);
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const collectedCounts = {
    blogPosts: items.filter((item) => item.sourceType === 'post' && item.status === 'collected').length,
    placeProfiles: items.filter((item) => item.sourceType === 'profile' && item.status === 'collected').length,
    placeReviews: items.filter((item) => item.sourceType === 'review' && item.status === 'collected').length
  };
  const countFromMetadata = (sourceType: string, keys: string[], requestedLimit: number) => {
    const counts = items
      .filter((item) => item.sourceType === sourceType)
      .flatMap((item) => {
        const metadata = asRecord(item.metadata);
        return keys
          .map((key) => metadata[key])
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      });
    if (counts.length === 0 || requestedLimit <= 0) return null;
    return Math.max(0, Math.min(requestedLimit, Math.max(...counts)));
  };
  const availableCounts = {
    blogPosts: countFromMetadata('post', ['availableBlogPostCount', 'total'], blogPostLimit),
    placeReviews: countFromMetadata('review', ['availableReviewTotal'], placeReviewLimit)
  };
  return {
    ...summary,
    totalItems: items.length,
    completedItems: items.filter((item) => item.status === 'collected').length,
    itemStatusCounts: byStatus,
    collectedCounts,
    availableCounts,
    collectionDelta: (summary.collectionDelta ?? null) as JsonValue
  };
}

function updateRunSummary(repos: Repositories, runId: string) {
  const run = repos.collectionRuns.findById(runId);
  if (!run) return null;
  return repos.collectionRuns.update(runId, {
    summary: summarizeItems(repos, run)
  });
}

function finalStatus(repos: Repositories, runId: string) {
  const items = repos.collectionItems.listByRunId(runId);
  const collectedCount = items.filter((item) => item.status === 'collected').length;
  const failedCount = items.filter((item) => item.status === 'failed').length;
  if (failedCount > 0 && collectedCount > 0) return 'partial_completed';
  if (failedCount > 0 && collectedCount === 0) return 'failed';
  return 'completed';
}

async function collectItems(repos: Repositories, runId: string, stepDelayMs: number) {
  try {
    const items = repos.collectionItems.listByRunId(runId);

    for (const item of items) {
      if (item.status === 'failed') {
        updateRunSummary(repos, runId);
        continue;
      }
      repos.collectionItems.update(item.id, { status: 'collecting' });
      updateRunSummary(repos, runId);
      await delay(stepDelayMs);
      repos.collectionItems.update(item.id, { status: 'collected' });
      updateRunSummary(repos, runId);
    }

    const finalRun = repos.collectionRuns.findById(runId);
    if (!finalRun) return;
    repos.collectionRuns.update(runId, {
      status: finalStatus(repos, runId),
      completedAt: nowIso(),
      summary: summarizeItems(repos, finalRun)
    });
  } catch (error) {
    const run = repos.collectionRuns.findById(runId);
    if (run) {
      repos.collectionRuns.update(runId, {
        status: 'failed',
        completedAt: nowIso(),
        summary: {
          ...asRecord(run.summary),
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  } finally {
    activeRuns.delete(runId);
  }
}

export async function startCollectionRun(
  repos: Repositories,
  runId: string,
  options: CollectionRunnerOptions = {}
) {
  const run = repos.collectionRuns.findById(runId);
  if (!run) return null;
  if (run.status === 'completed' || run.status === 'partial_completed' || run.status === 'failed') return run;
  if (activeRuns.has(runId)) return run;

  const env = options.env ?? process.env;
  const provider = collectionProvider(env);

  activeRuns.add(runId);
  try {
    const { items, deltaSummary } = await ensureProviderItems(repos, run, provider, env);
    const collectingRun = repos.collectionRuns.update(runId, {
      status: 'collecting',
      mode: provider.mode,
      startedAt: run.startedAt ?? nowIso(),
      completedAt: null,
      summary: {
        ...asRecord(run.summary),
        provider: {
          name: provider.name,
          mode: provider.mode
        },
        totalItems: items.length,
        completedItems: 0,
        itemStatusCounts: items.reduce<Record<string, number>>((acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        }, {}),
        collectedCounts: { blogPosts: 0, placeProfiles: 0, placeReviews: 0 },
        collectionDelta: deltaSummary as unknown as JsonValue
      }
    });

    void collectItems(repos, runId, options.stepDelayMs ?? 120);
    return collectingRun;
  } catch (error) {
    activeRuns.delete(runId);
    return repos.collectionRuns.update(runId, {
      status: 'failed',
      mode: provider.mode,
      completedAt: nowIso(),
      summary: {
        ...asRecord(run.summary),
        provider: {
          name: provider.name,
          mode: provider.mode
        },
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}
