import { describe, expect, it } from 'vitest';
import { collectionProfileFingerprint } from '../src/storeLearning/collection/collectionItemIdentity.js';

describe('collection item identity', () => {
  it('fingerprints Place profiles with non-string store metadata safely', () => {
    expect(() =>
      collectionProfileFingerprint({
        channel: 'place',
        sourceType: 'profile',
        sourceUrl: 'https://m.place.naver.com/place/12841526/home',
        title: '서구연세정형외과의원',
        bodyText: '인천 서구 정형외과',
        metadata: {
          storeMetadata: {
            category: ['의료/건강', '정형외과'],
            closedDays: ['매주 월요일'],
            parking: { available: false, note: null },
            reviewStats: { visitor: 61 },
            hospitalInfo: {
              subjects: ['정형외과', '내과']
            }
          }
        }
      })
    ).not.toThrow();
  });
});
