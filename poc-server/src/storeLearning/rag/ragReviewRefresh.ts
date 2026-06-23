import type { JsonRecord, ProviderEnv } from '../providers/placeImportTypes.js';
import type { DbConnection } from '../../db/connection.js';
import type { CollectionProvider, CollectionProviderItemDraft } from '../collection/collectionProviders.js';
import { createMockCollectionProvider } from '../collection/mockCollectionProvider.js';
import { createNaverPlaceRenderedCollectionProvider } from '../collection/naverPlaceRenderedCollectionProvider.js';
import { configuredPlaceProvider, sourceMetadata, type SourceKind } from '../providers/ownerSourcePolicy.js';
import { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { RAG_REVIEW_LIMIT } from './ragReviewPolicy.js';

type RefreshPlaceReviewsOptions = {
  connection: DbConnection;
  storeId: string;
  reviewLimit: number;
  env?: ProviderEnv;
};

function nowIso() {
  return new Date().toISOString();
}

function collectionRunId(storeId: string) {
  return `collection_run_${storeId}_rag_${Date.now()}`;
}

function providerForRagRefresh(env: ProviderEnv): CollectionProvider {
  const provider = configuredPlaceProvider(env);
  if (provider === 'rendered') return createNaverPlaceRenderedCollectionProvider();
  if (provider === 'mock') return createMockCollectionProvider();
  throw new Error('RAG Place review refresh requires NAVER_PLACE_PROVIDER=rendered or mock.');
}

function sourceKindForDraft(draft: CollectionProviderItemDraft): SourceKind {
  if (draft.channel === 'place' && draft.sourceType === 'profile') return 'place_profile';
  return 'place_visitor_review';
}

function defaultBodyAvailability(draft: CollectionProviderItemDraft, provider: CollectionProvider) {
  if (typeof draft.metadata.bodyAvailability === 'string') return draft.metadata.bodyAvailability;
  if (draft.bodyText) return provider.mode === 'mock' ? 'mock_body' : 'provider_body';
  if (draft.status === 'failed') return 'unavailable';
  return 'metadata_only';
}

function enrichedMetadata(draft: CollectionProviderItemDraft, provider: CollectionProvider, env: ProviderEnv): JsonRecord {
  return {
    bodyAvailability: defaultBodyAvailability(draft, provider),
    ...draft.metadata,
    ...sourceMetadata(sourceKindForDraft(draft), env),
    ragRefresh: true
  };
}

function itemId(runId: string, sourceType: string, index: number) {
  return `collection_item_${runId}_${sourceType}_${index}`;
}

function summarizeItems(items: Array<{ sourceType: string; status: string }>) {
  return {
    totalItems: items.length,
    completedItems: items.filter((item) => item.status === 'collected').length,
    failedItems: items.filter((item) => item.status === 'failed').length,
    collectedCounts: {
      blogPosts: items.filter((item) => item.sourceType === 'post' && item.status === 'collected').length,
      placeProfiles: items.filter((item) => item.sourceType === 'profile' && item.status === 'collected').length,
      placeReviews: items.filter((item) => item.sourceType === 'review' && item.status === 'collected').length
    }
  };
}

function finalStatus(items: Array<{ status: string }>) {
  const collected = items.filter((item) => item.status === 'collected').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  if (failed > 0 && collected > 0) return 'partial_completed';
  if (failed > 0) return 'failed';
  return 'completed';
}

export async function refreshPlaceReviewsForRag(options: RefreshPlaceReviewsOptions): Promise<string> {
  const env = options.env ?? process.env;
  const reviewLimit = Math.max(1, Math.min(RAG_REVIEW_LIMIT, Math.floor(options.reviewLimit || RAG_REVIEW_LIMIT)));
  const repos = createStoreLearningRepositories(options.connection);
  const store = repos.stores.findById(options.storeId);
  if (!store) throw new Error(`Store not found: ${options.storeId}`);

  const provider = providerForRagRefresh(env);
  const runId = collectionRunId(options.storeId);
  const startedAt = nowIso();
  repos.collectionRuns.create({
    id: runId,
    storeId: options.storeId,
    status: 'collecting',
    mode: provider.mode,
    startedAt,
    completedAt: null,
    summary: {
      purpose: 'rag_document_refresh',
      requestedLimits: { blogPostLimit: 0, placeReviewLimit: reviewLimit, instagramPostLimit: 0, daangnPostLimit: 0 },
      channelPlan: {
        naverBlog: { enabled: false, limit: 0 },
        naverPlace: { enabled: true, limit: reviewLimit },
        instagram: { enabled: false, limit: 0 },
        daangn: { enabled: false, limit: 0 }
      },
      provider: { name: provider.name, mode: provider.mode }
    }
  });

  try {
    const drafts = await provider.collect({
      env,
      plan: { blogPostLimit: 0, includePlaceProfile: true, placeReviewLimit: reviewLimit },
      store,
      storeChannels: repos.storeChannels.listByStoreId(store.id)
    });
    const persisted = drafts.map((draft, index) =>
      repos.collectionItems.upsert({
        id: itemId(runId, draft.sourceType, index + 1),
        runId,
        storeId: store.id,
        channel: draft.channel,
        sourceType: draft.sourceType,
        status: draft.status ?? 'collected',
        sourceUrl: draft.sourceUrl,
        title: draft.title,
        bodyText: draft.bodyText,
        selectedForAnalysis: 0,
        selectionReason: null,
        selectedAt: null,
        metadata: enrichedMetadata(draft, provider, env)
      })
    );
    const summary = summarizeItems(persisted);
    repos.collectionRuns.update(runId, {
      status: finalStatus(persisted),
      completedAt: nowIso(),
      summary: {
        purpose: 'rag_document_refresh',
        requestedLimits: { blogPostLimit: 0, placeReviewLimit: reviewLimit, instagramPostLimit: 0, daangnPostLimit: 0 },
        channelPlan: {
          naverBlog: { enabled: false, limit: 0 },
          naverPlace: { enabled: true, limit: reviewLimit },
          instagram: { enabled: false, limit: 0 },
          daangn: { enabled: false, limit: 0 }
        },
        provider: { name: provider.name, mode: provider.mode },
        ...summary
      }
    });
    if (summary.collectedCounts.placeReviews === 0) {
      throw new Error('RAG review refresh did not collect any Place reviews.');
    }
    return runId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    repos.collectionRuns.update(runId, {
      status: 'failed',
      completedAt: nowIso(),
      summary: {
        purpose: 'rag_document_refresh',
        provider: { name: provider.name, mode: provider.mode },
        error: message
      }
    });
    throw new Error(`RAG review refresh failed: ${message}`);
  }
}
