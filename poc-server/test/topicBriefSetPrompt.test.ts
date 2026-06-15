import { describe, expect, it } from 'vitest';
import {
  BLOG_TOPIC_BRIEF_SET_V2_CALL_ID,
  TOPIC_BRIEF_SET_BATCH_SIZE,
  buildTopicBriefSetV2PromptInput
} from '../src/storeLearning/blogFormulaV2/topicBriefSetPrompt.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

function post(id: string, body: string): OwnerBlogPostV2 {
  return {
    collectionItemId: id,
    title: `${id} 제목`,
    sourceUrl: null,
    bodyText: body,
    charCount: body.length,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: '2026-05-30T03:00:00.000Z',
    createdAt: '2026-05-30T03:00:00.000Z'
  };
}

describe('buildTopicBriefSetV2PromptInput (SL-F2)', () => {
  it('exposes each post by collectionItemId and truncates long bodies', () => {
    const longBody = '가'.repeat(5000);
    const result = buildTopicBriefSetV2PromptInput({
      store: { id: 's1', name: '테라스의원', category: '피부과', representativeKeywords: ['리팟레이저'] },
      posts: [post('p1', longBody), post('p2', '짧은 본문')]
    });

    expect(BLOG_TOPIC_BRIEF_SET_V2_CALL_ID).toBe('SL-F2');
    expect(TOPIC_BRIEF_SET_BATCH_SIZE).toBe(10);
    expect(result.sourcePostIds).toEqual(['p1', 'p2']);
    expect(result.promptInput.posts[0].id).toBe('p1');
    expect(result.promptInput.posts[0].bodyText.length).toBeLessThanOrEqual(2000);
    expect(result.promptInput.storeProfile.representativeKeywords).toEqual(['리팟레이저']);
  });
});
