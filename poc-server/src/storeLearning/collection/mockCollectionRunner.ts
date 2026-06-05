import type { JsonValue } from '../../repositories/base.js';
import type { CollectionRun } from '../../repositories/collection_runs.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

export type MockCollectionRunnerOptions = {
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

function readPlan(run: CollectionRun) {
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

function itemId(runId: string, sourceType: string, index: number) {
  return `collection_item_${runId}_${sourceType}_${index}`;
}

function ensureMockItems(repos: Repositories, run: CollectionRun) {
  const plan = readPlan(run);
  const items = [];

  for (let index = 1; index <= plan.blogPostLimit; index += 1) {
    items.push(
      repos.collectionItems.upsert({
        id: itemId(run.id, 'blog_post', index),
        runId: run.id,
        storeId: run.storeId,
        channel: 'blog',
        sourceType: 'post',
        status: 'pending',
        sourceUrl: `https://blog.naver.com/mock-store/${index}`,
        title: `수집된 블로그 글 ${index}`,
        bodyText: `mock provider가 생성한 블로그 본문 ${index}입니다.`,
        selectedForAnalysis: 0,
        selectionReason: null,
        selectedAt: null,
        metadata: { provider: 'mock', ordinal: index }
      })
    );
  }

  if (plan.includePlaceProfile) {
    items.push(
      repos.collectionItems.upsert({
        id: itemId(run.id, 'place_profile', 1),
        runId: run.id,
        storeId: run.storeId,
        channel: 'place',
        sourceType: 'profile',
        status: 'pending',
        sourceUrl: 'https://naver.me/mock-place',
        title: '네이버 플레이스 기본정보',
        bodyText: 'mock provider가 생성한 플레이스 기본정보입니다.',
        selectedForAnalysis: 0,
        selectionReason: null,
        selectedAt: null,
        metadata: { provider: 'mock', bodyAvailability: 'mock_profile' }
      })
    );
  }

  for (let index = 1; index <= plan.placeReviewLimit; index += 1) {
    items.push(
      repos.collectionItems.upsert({
        id: itemId(run.id, 'place_review', index),
        runId: run.id,
        storeId: run.storeId,
        channel: 'place',
        sourceType: 'review',
        status: 'pending',
        sourceUrl: `https://naver.me/mock-place/reviews/${index}`,
        title: `플레이스 리뷰 ${index}`,
        bodyText: `mock provider가 생성한 플레이스 리뷰 ${index}입니다.`,
        selectedForAnalysis: 0,
        selectionReason: null,
        selectedAt: null,
        metadata: { provider: 'mock', ordinal: index }
      })
    );
  }

  return items;
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

async function collectItems(repos: Repositories, runId: string, stepDelayMs: number) {
  try {
    const run = repos.collectionRuns.findById(runId);
    if (!run) return;
    const items = repos.collectionItems.listByRunId(runId);

    for (const item of items) {
      repos.collectionItems.update(item.id, { status: 'collecting' });
      updateRunSummary(repos, runId);
      await delay(stepDelayMs);
      repos.collectionItems.update(item.id, { status: 'collected' });
      updateRunSummary(repos, runId);
    }

    const finalRun = repos.collectionRuns.findById(runId);
    if (!finalRun) return;
    repos.collectionRuns.update(runId, {
      status: 'completed',
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

export function startMockCollectionRun(
  repos: Repositories,
  runId: string,
  options: MockCollectionRunnerOptions = {}
) {
  const run = repos.collectionRuns.findById(runId);
  if (!run) return null;
  if (run.status === 'completed' || run.status === 'failed') return run;
  if (activeRuns.has(runId)) return run;

  const items = ensureMockItems(repos, run);
  const collectingRun = repos.collectionRuns.update(runId, {
    status: 'collecting',
    startedAt: run.startedAt ?? nowIso(),
    completedAt: null,
    summary: {
      ...asRecord(run.summary),
      totalItems: items.length,
      completedItems: 0,
      itemStatusCounts: { pending: items.length },
      collectedCounts: { blogPosts: 0, placeProfiles: 0, placeReviews: 0 }
    }
  });

  activeRuns.add(runId);
  void collectItems(repos, runId, options.stepDelayMs ?? 120);
  return collectingRun;
}
