import { describe, expect, it } from 'vitest';
import { buildHeuristicTopicBriefSets } from '../src/storeLearning/blogFormulaV2/topicBriefSetHeuristic.js';
import { createSafeMockTopicBriefSetProvider } from '../src/storeLearning/blogFormulaV2/providers/safeMockTopicBriefSetProvider.js';
import { TopicBriefSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string, title: string, body: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title,
    sourceUrl: null,
    bodyText: body,
    charCount: body.length,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

const store = {
  id: 's1',
  name: '테라스의원',
  category: '피부과',
  representativeKeywords: ['리팟레이저', '흑자', '울쎄라']
};

describe('buildHeuristicTopicBriefSets', () => {
  it('derives topic from representative keywords and fills generic interpretive defaults', () => {
    const sets = buildHeuristicTopicBriefSets(store, [
      post('p1', '리팟레이저 부작용 걱정', '흑자 제거 후 색소침착 걱정'),
      post('p2', '울쎄라 600샷 가격', '샷 수와 피부 상태를 함께 판단')
    ]);

    expect(sets).toHaveLength(2);
    expect(sets[0].topic).toBe('리팟레이저');
    expect(sets[0].sourcePostIds).toEqual(['p1']);
    expect(sets[0].secondaryKeywords).toContain('흑자');
    expect(sets[0].mustInclude).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(sets[0].status).toBe('candidate');
    expect(sets[0].confidence).toBe(0.4);
    expect(sets[1].topic).toBe('울쎄라');
    expect(() => TopicBriefSetV2Schema.parse({ ...sets[0], id: 'tbs_1' })).not.toThrow();
  });

  it('falls back to the first representative keyword when none match', () => {
    const sets = buildHeuristicTopicBriefSets(store, [post('p3', '일반 피부 관리', '계절별 보습 팁')]);
    expect(sets[0].topic).toBe('리팟레이저');
  });
});

describe('safe_mock topic brief set provider', () => {
  it('returns heuristic sets with safe_mock provenance', async () => {
    const provider = createSafeMockTopicBriefSetProvider();
    const result = await provider.extractTopicBriefSets({
      store,
      posts: [post('p1', '리팟레이저 부작용', '흑자 제거')]
    });
    expect(result.provider.mode).toBe('safe_mock');
    expect(result.provider.noExternalCalls).toBe(true);
    expect(result.sets[0].topic).toBe('리팟레이저');
  });
});
