import { describe, expect, it } from 'vitest';
import type { CollectionItem } from '../src/repositories/collection_items.js';
import type { Store } from '../src/repositories/stores.js';
import { buildStoreInfoRagDocument } from '../src/storeLearning/rag/storeInfoRagBuilder.js';
import { buildStoreReviewRagDocument } from '../src/storeLearning/rag/reviewRagBuilder.js';

const store: Store = {
  id: 'store_haehwaro',
  name: '해화로in수산',
  naverPlaceUrl: 'https://naver.me/xUwCQUxv',
  naverPlaceId: '1824807602',
  category: '음식점 > 일식 > 생선회',
  address: '서울 광진구 광나루로 383 1,2층',
  phone: '0507-1359-5863',
  description: '신선한 대방어의 겨울철 진미',
  metadata: {
    naverPlaceParsed: {
      name: '해화로in수산',
      category: '음식점 > 일식 > 생선회',
      roadAddress: '서울 광진구 광나루로 383 1,2층',
      phone: '0507-1359-5863',
      homepageLinks: [{ type: 'instagram', url: 'https://www.instagram.com/forebus_jubong' }],
      placeIntro: '회전문점 해화로in수산입니다. 회는 살아있는 원 재료의 맛을 그대로 느낀다는 점에서 사랑받고 있습니다.',
      aiSummary: '신선한 대방어의 겨울철 진미',
      parkingInfo: {
        description: '어린이대공원 정문 주차장 등 인근 유료 주차장을 안내합니다.'
      },
      businessHours: [
        { day: '월', open: '11:20', close: '23:30', breakHours: [{ start: '14:30', end: '16:30' }] }
      ],
      facilities: ['단체 이용 가능', '예약', '무선 인터넷'],
      bookingUrl: 'https://booking.naver.com/booking/6/bizes/123',
      reviewStats: { visitorReviewCount: 1173, blogReviewCount: 746, rating: 4.32 },
      broadcastInfos: [{ channel: 'KBS2', program: '2TV생생정보', menu: '해물조림' }],
      keywords: ['숙성회', '군자횟집'],
      menuItems: [
        { name: '통키로 계란 후라이', price: '10000', description: null },
        { name: '매운 통파게티', price: '17000', description: '매콤한 인기 메뉴' }
      ],
      menuImageUrls: ['https://ldb-phinf.pstatic.net/menu.png']
    }
  },
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z'
};

function reviewItem(id: string, bodyText: string, ownerReplyText: string | null): CollectionItem {
  return {
    id,
    runId: 'collection_run_haehwaro',
    storeId: store.id,
    channel: 'place',
    sourceType: 'review',
    status: 'collected',
    sourceUrl: 'https://m.place.naver.com/restaurant/1824807602/review/visitor',
    title: `방문자 리뷰 ${id}`,
    bodyText,
    selectedForAnalysis: 0,
    selectionReason: null,
    selectedAt: null,
    metadata: {
      reviewerName: 'yys****',
      reviewDate: '2026.06.01',
      ownerReplyText,
      replyStatus: ownerReplyText ? 'replied' : 'not_replied',
      ordinal: Number(id.replace('review_', ''))
    },
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z'
  };
}

describe('RAG document builders', () => {
  it('builds static store information from persisted Naver Place metadata', () => {
    const document = buildStoreInfoRagDocument(store);

    expect(document.title).toBe('해화로in수산 식당 정보');
    expect(document.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['기본 정보', '오시는 길 및 주차', '영업시간', '편의시설 및 서비스', '사장님 소개', '메뉴판'])
    );
    expect(document.sections.flatMap((section) => section.lines)).toEqual(
      expect.arrayContaining([
        '상호명: 해화로in수산',
        '업종: 음식점 > 일식 > 생선회',
        '예약정보: https://booking.naver.com/booking/6/bizes/123',
        '대표 키워드: 숙성회, 군자횟집',
        '메뉴 사진 수: 1개'
      ])
    );
  });

  it('does not stringify nested metadata objects into RAG document lines', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      metadata: {
        naverPlaceParsed: {
          name: '해화로in수산',
          parkingInfo: {},
          booking: { url: 'https://booking.naver.com/nested-booking' },
          paymentInfo: { methods: ['지역화폐'] }
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(lines.join('\n')).not.toContain('[object Object]');
    expect(lines).toContain('예약정보: https://booking.naver.com/nested-booking');
  });

  it('uses scalar Place metadata fields when detailed arrays are unavailable', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      metadata: {
        naverPlaceParsed: {
          openTime: '11:20',
          closeTime: '23:30',
          breakStart: '14:30',
          breakEnd: '16:30',
          closedDays: [],
          placeImageUrls: [
            'https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2Fplace-1.jpg',
            'https://g-place.pstatic.net/assets/shared/images/icon_default_profile.png',
            'https://blog.naver.com/example/123',
            'https://ldb.example/place-2.jpg'
          ],
          reviewStats: {
            visitorReviewCount: 1852,
            blogReviewCount: 430,
            visitorTextReviewCount: 1758
          }
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(lines).toEqual(
      expect.arrayContaining([
        '운영시간: 11:20 ~ 23:30',
        '브레이크타임: 14:30 ~ 16:30',
        '매장 사진 수: 2개',
        '텍스트 리뷰 수: 1758'
      ])
    );
    expect(lines.join('\n')).not.toContain('icon_default_profile');
    expect(lines.join('\n')).not.toContain('blog.naver.com/example');
  });

  it('builds review entries with owner replies attached to each review', () => {
    const document = buildStoreReviewRagDocument({
      store,
      collectionItems: [
        reviewItem('review_1', '회가 신선하고 직원분들이 친절했어요.', '소중한 리뷰 감사합니다. 더 신선하게 준비하겠습니다.'),
        reviewItem('review_2', '대방어가 맛있고 재방문하고 싶어요.', null)
      ],
      latestRunId: 'collection_run_haehwaro'
    });

    expect(document.title).toBe('해화로in수산 방문자 리뷰 모음');
    expect(document.entries).toHaveLength(2);
    expect(document.entries[0]).toEqual(
      expect.objectContaining({
        bodyText: '회가 신선하고 직원분들이 친절했어요.',
        ownerReplyText: '소중한 리뷰 감사합니다. 더 신선하게 준비하겠습니다.',
        replyStatus: 'replied'
      })
    );
    expect(document.entries[1]).toEqual(expect.objectContaining({ ownerReplyText: null, replyStatus: 'not_replied' }));
  });
});
