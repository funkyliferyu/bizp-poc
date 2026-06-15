import { describe, expect, it } from 'vitest';
import { createOpenAITopicBriefSetProvider } from '../src/storeLearning/blogFormulaV2/providers/openAITopicBriefSetProvider.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title: `${id} 제목`,
    sourceUrl: null,
    bodyText: '본문',
    charCount: 2,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

function stubClient(items: unknown[]) {
  return {
    beta: {
      chat: {
        completions: {
          parse: async () => ({ choices: [{ message: { parsed: { topicBriefSets: items } } }] })
        }
      }
    }
  };
}

const store = { id: 's1', name: '테라스의원', category: '피부과', representativeKeywords: ['리팟레이저'] };

function modelItem(id: string) {
  return {
    id,
    topic: '리팟레이저',
    mainKeyword: '리팟레이저 부작용',
    secondaryKeywords: ['흑자 제거'],
    targetReader: '리팟레이저 정보를 찾는 고객',
    coreConcern: '부작용 걱정',
    mainAngle: '원리 설명',
    mustInclude: ['개인차'],
    mustAvoid: [],
    ctaDirection: '상담 안내'
  };
}

describe('OpenAI topic brief set provider (SL-F2)', () => {
  it('maps model items to candidates tagged by sourcePostId', async () => {
    const provider = createOpenAITopicBriefSetProvider({ client: stubClient([modelItem('p1')]), model: 'gpt-4o-mini' });
    const result = await provider.extractTopicBriefSets({ store, posts: [post('p1')] });

    expect(result.provider.mode).toBe('openai');
    expect(result.provider.noExternalCalls).toBe(false);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].sourcePostIds).toEqual(['p1']);
    expect(result.sets[0].confidence).toBe(0.7);
    expect(result.sets[0].status).toBe('candidate');
    expect(result.sets[0].coreConcern).toBe('부작용 걱정');
  });

  it('drops model items whose id is not in the provided batch', async () => {
    const provider = createOpenAITopicBriefSetProvider({
      client: stubClient([modelItem('p1'), modelItem('ghost')]),
      model: 'gpt-4o-mini'
    });
    const result = await provider.extractTopicBriefSets({ store, posts: [post('p1')] });
    expect(result.sets.map((set) => set.sourcePostIds[0])).toEqual(['p1']);
  });

  it('throws when no client is available', async () => {
    const provider = createOpenAITopicBriefSetProvider({ client: null });
    await expect(provider.extractTopicBriefSets({ store, posts: [post('p1')] })).rejects.toThrow(
      'OpenAI client is unavailable'
    );
  });
});
