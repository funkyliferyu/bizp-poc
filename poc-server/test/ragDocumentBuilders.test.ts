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
      homepages: {
        repr: { type: '웹사이트', url: 'https://haehwaro.example.com' },
        items: [
          { type: '블로그', url: 'https://blog.naver.com/haehwaro' },
          { type: '유튜브', url: 'https://www.youtube.com/@haehwaro' }
        ]
      },
      externalLinks: [{ type: '다이닝코드', url: 'https://diningcode.com/profile/haehwaro' }],
      externalChannelLinks: [
        { channel: 'instagram', label: '인스타그램', url: 'https://www.instagram.com/forebus_jubong' },
        { channel: 'tiktok', label: '틱톡', url: 'https://www.tiktok.com/@haehwaro' }
      ],
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
      ordinal: Number(id.replace('review_', '')),
      reviewKeywords: ['예약 후 이용', '10분이내']
    },
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z'
  };
}

describe('RAG document builders', () => {
  it('builds static store information from persisted Naver Place metadata', () => {
    const document = buildStoreInfoRagDocument(store);

    expect(document.title).toBe('해화로in수산 정보');
    expect(document.title).not.toContain('식당');
    expect(document.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['기본 정보', '오시는 길 및 주차', '영업시간', '편의시설 및 서비스', '사장님 소개', '메뉴판'])
    );
    expect(document.sections.flatMap((section) => section.lines)).toEqual(
      expect.arrayContaining([
        '상호명: 해화로in수산',
        '업종: 음식점 > 일식 > 생선회',
        '예약정보: https://booking.naver.com/booking/6/bizes/123',
        '대표 키워드: 숙성회, 군자횟집',
        '외부채널 링크(블로그): https://blog.naver.com/haehwaro',
        '외부채널 링크(유튜브): https://www.youtube.com/@haehwaro',
        '외부채널 링크(인스타그램): https://www.instagram.com/forebus_jubong',
        '외부채널 링크(틱톡): https://www.tiktok.com/@haehwaro',
        '외부채널 링크(다이닝코드): https://diningcode.com/profile/haehwaro',
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

  it('uses edited weekly business hours before imported Place summary hours in the info RAG document', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      metadata: {
        weeklyBusinessHours: [
          {
            day: 'mon',
            dayLabel: '월',
            closed: false,
            openTime: '10:00',
            closeTime: '19:00',
            breakStart: '13:00',
            breakEnd: '14:00',
            description: ''
          },
          {
            day: 'tue',
            dayLabel: '화',
            closed: false,
            openTime: '11:00',
            closeTime: '20:00',
            breakStart: '',
            breakEnd: '',
            description: ''
          },
          {
            day: 'sun',
            dayLabel: '일',
            closed: true,
            openTime: '',
            closeTime: '',
            breakStart: '',
            breakEnd: '',
            description: '정기휴무 (매주 일요일)'
          }
        ],
        naverPlaceParsed: {
          openTime: '10:00',
          closeTime: '19:00',
          businessHours: ['영업 중', '19:00에 접수마감']
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(lines).toEqual(
      expect.arrayContaining([
        '월: 10:00~19:00 / 브레이크타임 13:00~14:00',
        '화: 11:00~20:00',
        '일: 정기휴무 (매주 일요일)'
      ])
    );
    expect(lines).not.toContain('운영시간: 10:00 ~ 19:00');
    expect(lines.join('\n')).not.toContain('영업 중');
  });

  it('uses imported Place weekly business hours when edited weekly hours are unavailable', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      metadata: {
        naverPlaceParsed: {
          openTime: '08:30',
          closeTime: '19:00',
          closedDays: ['sun'],
          weeklyBusinessHours: [
            {
              day: 'fri',
              dayLabel: '금',
              closed: false,
              openTime: '08:30',
              closeTime: '20:00',
              breakStart: '',
              breakEnd: '',
              description: ''
            },
            {
              day: 'sun',
              dayLabel: '일',
              closed: true,
              openTime: '',
              closeTime: '',
              breakStart: '',
              breakEnd: '',
              description: '휴진'
            }
          ]
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(lines).toEqual(expect.arrayContaining(['금: 08:30~20:00', '일: 휴진']));
    expect(lines).not.toContain('운영시간: 08:30 ~ 19:00');
    expect(lines).not.toContain('정기휴무: sun');
  });

  it('fills missing weekly business-hour days from persisted Place business hour lines', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      metadata: {
        weeklyBusinessHours: [
          {
            day: 'tue',
            dayLabel: '화',
            closed: false,
            openTime: '10:00',
            closeTime: '19:00',
            breakStart: '13:00',
            breakEnd: '14:00',
            description: ''
          },
          {
            day: 'sun',
            dayLabel: '일',
            closed: true,
            openTime: '',
            closeTime: '',
            breakStart: '',
            breakEnd: '',
            description: '정기휴무 (매주 일요일)'
          }
        ],
        naverPlaceParsed: {
          businessHours: [
            '화 10:00 - 19:00 / 브레이크타임 13:00 - 14:00',
            '수(6/17) 10:00 - 19:00 / 브레이크타임 13:00 - 14:00',
            '일 정기휴무 (매주 일요일)'
          ],
          closedDays: ['sun']
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(lines).toEqual(
      expect.arrayContaining([
        '화: 10:00~19:00 / 브레이크타임 13:00~14:00',
        '수: 10:00~19:00 / 브레이크타임 13:00~14:00',
        '일: 정기휴무 (매주 일요일)'
      ])
    );
    expect(lines).not.toContain('정기휴무: sun');
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

  it('removes empty, meaningless, repeated owner replies and review-only metadata from review RAG entries', () => {
    const document = buildStoreReviewRagDocument({
      store,
      collectionItems: [
        reviewItem('review_1', '회가 신선하고 직원분들이 친절했어요.', '사장님 답글 없음'),
        reviewItem('review_2', '대방어가 맛있고 재방문하고 싶어요.', '소중한 리뷰 감사합니다.'),
        reviewItem('review_3', '매장이 깨끗하고 예약도 편했어요.', '감사합니다. 감사합니다.'),
        reviewItem('review_4', '직원 안내가 자세해서 좋았어요.', '방문해 주셔서 감사합니다. 다음에도 정성껏 준비하겠습니다.'),
        reviewItem('review_5', '가족 식사로 만족했습니다.', '방문해 주셔서 감사합니다. 다음에도 정성껏 준비하겠습니다.'),
        reviewItem('review_6', '설명이 친절했고 음식도 좋았습니다.', '신선도 유지를 위해 당일 손질한 재료만 사용하고 있습니다. 다음 방문에도 같은 품질로 준비하겠습니다.')
      ],
      latestRunId: 'collection_run_haehwaro'
    });

    expect(document.entries.map((entry) => entry.ownerReplyText)).toEqual([null, null, null, null, null, '신선도 유지를 위해 당일 손질한 재료만 사용하고 있습니다. 다음 방문에도 같은 품질로 준비하겠습니다.']);
    expect(document.entries.every((entry) => entry.replyStatus === (entry.ownerReplyText ? 'replied' : 'not_replied'))).toBe(true);
    expect(document.entries.every((entry) => entry.keywords.length === 0)).toBe(true);
    expect(document.entries.every((entry) => entry.sourceUrl === null)).toBe(true);
  });

  it('includes hospital Place fields such as treatment subjects in the info RAG document', () => {
    const document = buildStoreInfoRagDocument({
      ...store,
      name: '테라스의원',
      category: '피부과',
      metadata: {
        naverPlaceParsed: {
          name: '테라스의원',
          category: '피부과',
          hospitalInfo: {
            sourceName: '건강보험심사평가원',
            sourceUrl: 'https://www.hira.or.kr/example',
            subjects: ['피부과', '가정의학과'],
            specialistSubjects: [{ name: '피부과', count: 2 }],
            specialEquipments: [{ name: '초음파영상진단기', count: 1 }],
            specialOperations: [{ name: '레이저치료', count: null }],
            specialSubjects: [{ name: '아토피', count: null }]
          }
        }
      }
    });
    const lines = document.sections.flatMap((section) => section.lines);

    expect(document.sections.map((section) => section.title)).toContain('병원 정보');
    expect(lines).toEqual(
      expect.arrayContaining([
        '진료과목: 피부과, 가정의학과',
        '진료과목별 전문의: 피부과 2명',
        '특수진료장비: 초음파영상진단기 1개',
        '특수진료: 레이저치료',
        '특수진료과목: 아토피'
      ])
    );
    expect(lines.join('\n')).not.toContain('hira.or.kr');
    expect(lines.join('\n')).not.toContain('출처');
  });
});
