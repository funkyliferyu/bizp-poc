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
import { createMockCollectionProvider } from './mockCollectionProvider.js';
import { createNaverBlogRenderedCollectionProvider, isRenderedBlogCollectionProvider } from './naverBlogRenderedCollectionProvider.js';
import { createNaverPlaceRenderedCollectionProvider } from './naverPlaceRenderedCollectionProvider.js';
import { createNaverSearchCollectionProvider } from './naverSearchCollectionProvider.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

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
  env: ProviderEnv
): JsonRecord {
  return {
    bodyAvailability: defaultBodyAvailability(draft, provider),
    ...draft.metadata,
    ...sourceMetadata(sourceKindForDraft(draft), env)
  };
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

  return drafts.map((draft: CollectionProviderItemDraft, index) =>
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
      metadata: enrichItemMetadata(draft, provider, env)
    })
  );
}

function summarizeItems(repos: Repositories, run: CollectionRun) {
  const items = repos.collectionItems.listByRunId(run.id);
  const byStatus = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const collectedCounts = {
    blogPosts: items.filter((item) => item.sourceType === 'post' && item.status === 'collected').length,
    placeProfiles: items.filter((item) => item.sourceType === 'profile' && item.status === 'collected').length,
    placeReviews: items.filter((item) => item.sourceType === 'review' && item.status === 'collected').length
  };
  return {
    ...asRecord(run.summary),
    totalItems: items.length,
    completedItems: items.filter((item) => item.status === 'collected').length,
    itemStatusCounts: byStatus,
    collectedCounts
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
    const items = await ensureProviderItems(repos, run, provider, env);
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
        collectedCounts: { blogPosts: 0, placeProfiles: 0, placeReviews: 0 }
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
