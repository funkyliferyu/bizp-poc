import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import {
  extendBlogFormulaV2TopicBriefSets,
  getBlogFormulaV2Payload,
  getTopicBriefSetProviderModeForStore
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import type { TopicBriefSetProvider } from '../src/storeLearning/blogFormulaV2/providers/topicBriefSetProvider.js';

// A stub provider that returns a topic-brief set for only a subset of the batch,
// to verify remainingCount reflects actually-covered posts (not batch size).
function stubProviderCovering(coveredPostIds: string[]): TopicBriefSetProvider {
  return {
    name: 'stub-topic-brief-set-provider',
    mode: 'safe_mock',
    model: 'stub',
    async extractTopicBriefSets(input) {
      const sets = input.posts
        .filter((post) => coveredPostIds.includes(post.collectionItemId))
        .map((post) => ({
          sourcePostIds: [post.collectionItemId],
          confidence: 0.7,
          status: 'candidate' as const,
          topic: '리팟레이저',
          mainKeyword: '리팟레이저',
          secondaryKeywords: [],
          targetReader: null,
          coreConcern: null,
          mainAngle: null,
          mustInclude: [],
          mustAvoid: [],
          ctaDirection: null
        }));
      return {
        sets,
        provider: {
          name: 'stub-topic-brief-set-provider',
          mode: 'safe_mock',
          model: 'stub',
          callId: 'SL-F2',
          promptShapeVersion: 'blog_topic_brief_set_v2_extraction_input.v1',
          noExternalCalls: true
        }
      };
    }
  };
}

const STORE_ID = 'store_topic_brief_sets';
const RUN_ID = 'run_topic_brief_sets';

function setup(postCount: number) {
  const connection = createDatabaseConnection({ filename: ':memory:' });
  migrateDatabase(connection);
  const repos = createStoreLearningRepositories(connection);
  repos.stores.create({
    id: STORE_ID,
    name: '테라스의원',
    naverPlaceUrl: null,
    naverPlaceId: null,
    category: '피부과',
    address: null,
    phone: null,
    description: null,
    metadata: { representativeKeywords: ['리팟레이저', '흑자', '울쎄라'] }
  });
  repos.collectionRuns.create({
    id: RUN_ID,
    storeId: STORE_ID,
    status: 'selection_ready',
    mode: 'mock',
    startedAt: null,
    completedAt: null,
    summary: {}
  });
  for (let index = 0; index < postCount; index += 1) {
    repos.collectionItems.create({
      id: `post_${index}`,
      runId: RUN_ID,
      storeId: STORE_ID,
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: null,
      title: `리팟레이저 부작용 ${index}`,
      bodyText: `흑자 제거 후 색소침착 걱정 ${index}`,
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        sourceKind: 'owner_blog_post',
        sourceOwnership: 'owned',
        bodyAvailability: 'available',
        isTruncated: false,
        publishedAt: `2026-05-${String(28 - index).padStart(2, '0')}T03:00:00.000Z`
      }
    });
  }
  const formulaSet = repos.v2BlogFormulaSets.create({
    id: 'formula_set_tbs',
    storeId: STORE_ID,
    version: 'formula_v2.1',
    status: 'generated',
    formula: {},
    sourcePostIds: [],
    model: 'deterministic-blog-formula-v2'
  });
  return { connection, repos, formulaSetId: formulaSet.id };
}

describe('extendBlogFormulaV2TopicBriefSets', () => {
  it('mines the first batch of 10 (heuristic) and reports the remaining count', async () => {
    const { repos, formulaSetId } = setup(12);
    const result = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });

    expect(result.added).toHaveLength(10);
    expect(result.topicBriefSets).toHaveLength(10);
    expect(result.remainingCount).toBe(2);
    expect(result.added[0].topic).toBe('리팟레이저');
    expect(result.added[0].sourcePostIds).toHaveLength(1);
  });

  it('appends the next batch without replacing and skips covered posts', async () => {
    const { repos, formulaSetId } = setup(12);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const second = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });

    expect(second.added).toHaveLength(2);
    expect(second.topicBriefSets).toHaveLength(12);
    expect(second.remainingCount).toBe(0);
    const sourceIds = second.topicBriefSets.map((set) => set.sourcePostIds[0]);
    expect(new Set(sourceIds).size).toBe(12);
  });

  it('returns an empty batch when all posts are covered', async () => {
    const { repos, formulaSetId } = setup(3);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const again = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    expect(again.added).toHaveLength(0);
    expect(again.remainingCount).toBe(0);
  });

  it('reports remainingCount from covered posts when a provider returns fewer sets than the batch', async () => {
    const { repos, formulaSetId } = setup(3);
    const provider = stubProviderCovering(['post_0', 'post_1']); // covers 2 of the 3 batched posts

    const result = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider });
    expect(result.added).toHaveLength(2);
    expect(result.topicBriefSets).toHaveLength(2);
    expect(result.remainingCount).toBe(1); // post_2 was batched but not returned, so still uncovered

    // a follow-up extend (heuristic) picks up the post the provider skipped
    const second = await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    expect(second.added).toHaveLength(1);
    expect(second.added[0].sourcePostIds[0]).toBe('post_2');
    expect(second.remainingCount).toBe(0);
  });
});

describe('getBlogFormulaV2Payload topic brief sets', () => {
  it('exposes topicBriefSets and the remaining count', async () => {
    const { repos, formulaSetId } = setup(12);
    await extendBlogFormulaV2TopicBriefSets(repos, STORE_ID, { formulaSetId, provider: null });
    const payload = getBlogFormulaV2Payload(repos, STORE_ID);
    expect(payload.topicBriefSets).toHaveLength(10);
    expect(payload.status.topicBriefSetRemainingCount).toBe(2);
  });
});

describe('getTopicBriefSetProviderModeForStore', () => {
  it('returns undefined when the formula run has no provider (deterministic)', () => {
    const { repos, formulaSetId } = setup(3);
    repos.v2BlogFormulaRuns.create({
      id: 'frun_1',
      storeId: STORE_ID,
      formulaSetId,
      input: {},
      output: { formulaSetId },
      validation: {},
      model: 'deterministic-blog-formula-v2',
      status: 'completed'
    });
    expect(getTopicBriefSetProviderModeForStore(repos, STORE_ID, formulaSetId)).toBeUndefined();
  });

  it('reads the provider mode from the formula run output', () => {
    const { repos, formulaSetId } = setup(3);
    repos.v2BlogFormulaRuns.create({
      id: 'frun_2',
      storeId: STORE_ID,
      formulaSetId,
      input: {},
      output: { formulaSetId, provider: { mode: 'openai' } },
      validation: {},
      model: 'gpt-4o-mini',
      status: 'completed'
    });
    expect(getTopicBriefSetProviderModeForStore(repos, STORE_ID, formulaSetId)).toBe('openai');
  });
});
