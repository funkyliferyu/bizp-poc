import type { OwnerBlogPostV2 } from './sourcePosts.js';
import type { TopicBriefSetPromptStore } from './topicBriefSetPrompt.js';
import type { TopicBriefSetCandidate } from './types.js';

const HEURISTIC_REQUIRED_DISCLOSURES = ['개인차', '부작용 가능성', '의료진 상담'];
const HEURISTIC_CORE_CONCERN = '부작용·재발 등 시술 전 걱정';
const HEURISTIC_MAIN_ANGLE = '걱정 해소와 정보 제공 중심 전개';
const HEURISTIC_CTA_DIRECTION = '상담을 통해 본인에게 맞는 계획을 확인하도록 안내';
const HEURISTIC_FALLBACK_TOPIC = '주제 미상';

function firstTitleToken(title: string | null): string | undefined {
  if (!title) return undefined;
  return title.toLowerCase().match(/[0-9a-z가-힣]+/g)?.find((token) => token.length >= 2);
}

function pickTopic(post: OwnerBlogPostV2, representativeKeywords: string[]): string {
  const haystack = `${post.title ?? ''} ${post.bodyText}`;
  const matched = representativeKeywords.find((keyword) => haystack.includes(keyword));
  if (matched) return matched;
  if (representativeKeywords.length > 0) return representativeKeywords[0];
  return firstTitleToken(post.title) ?? HEURISTIC_FALLBACK_TOPIC;
}

export function buildHeuristicTopicBriefSets(
  store: TopicBriefSetPromptStore,
  posts: OwnerBlogPostV2[]
): TopicBriefSetCandidate[] {
  return posts.map((post) => {
    const topic = pickTopic(post, store.representativeKeywords);
    const haystack = `${post.title ?? ''} ${post.bodyText}`;
    const secondaryKeywords = store.representativeKeywords.filter(
      (keyword) => keyword !== topic && haystack.includes(keyword)
    );
    return {
      sourcePostIds: [post.collectionItemId],
      confidence: 0.4,
      status: 'candidate' as const,
      topic,
      mainKeyword: topic,
      secondaryKeywords,
      targetReader: `${topic} 정보를 찾는 잠재 고객`,
      coreConcern: HEURISTIC_CORE_CONCERN,
      mainAngle: HEURISTIC_MAIN_ANGLE,
      mustInclude: [...HEURISTIC_REQUIRED_DISCLOSURES],
      mustAvoid: [],
      ctaDirection: HEURISTIC_CTA_DIRECTION
    };
  });
}
