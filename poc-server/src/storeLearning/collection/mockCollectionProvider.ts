import type { CollectionProvider } from './collectionProviders.js';
import type { CollectionProviderItemDraft } from './collectionProviders.js';

export function createMockCollectionProvider(): CollectionProvider {
  return {
    name: 'mockCollectionProvider',
    mode: 'mock',
    async collect({ plan }) {
      const items: CollectionProviderItemDraft[] = [];

      for (let index = 1; index <= plan.blogPostLimit; index += 1) {
        items.push({
          channel: 'blog',
          sourceType: 'post',
          sourceUrl: `https://blog.naver.com/mock-store/${index}`,
          title: `수집된 블로그 글 ${index}`,
          bodyText: `mock provider가 생성한 블로그 본문 ${index}입니다.`,
          metadata: { provider: 'mock', ordinal: index }
        });
      }

      if (plan.includePlaceProfile) {
        items.push({
          channel: 'place',
          sourceType: 'profile',
          sourceUrl: 'https://naver.me/mock-place',
          title: '네이버 플레이스 기본정보',
          bodyText: 'mock provider가 생성한 플레이스 기본정보입니다.',
          metadata: { provider: 'mock', bodyAvailability: 'mock_profile' }
        });
      }

      for (let index = 1; index <= plan.placeReviewLimit; index += 1) {
        items.push({
          channel: 'place',
          sourceType: 'review',
          sourceUrl: `https://naver.me/mock-place/reviews/${index}`,
          title: `플레이스 리뷰 ${index}`,
          bodyText: `mock provider가 생성한 플레이스 리뷰 ${index}입니다.`,
          metadata: { provider: 'mock', ordinal: index }
        });
      }

      return items;
    }
  };
}
