import express from 'express';
import { readFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import {
  extractRenderedPlaceProfile,
  importWithNaverPlaceRenderedProvider,
  renderNaverPlacePageWithRenderers,
  shouldUseInteractiveNaverReviewRendering
} from '../src/storeLearning/providers/naverPlaceRenderedProvider.js';
import { parseNaverPlaceUrl } from '../src/storeLearning/providers/naverPlaceUrlParser.js';

const fixturePath = fileURLToPath(new URL('./fixtures/naver-place-rendered-home.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf8');
const placeUrl = 'https://m.place.naver.com/restaurant/1838952735/home';
const apolloPlaceHtml = `<html><head><meta property="og:image" content="https://example.test/og.jpg" /></head><body>
<script>
window.__APOLLO_STATE__ = ${JSON.stringify({
  'PlaceDetailBase:1838952735': {
    __typename: 'PlaceDetailBase',
    id: '1838952735',
    name: '해방식당',
    category: '한식',
    roadAddress: '서울 용산구 신흥로22길 5 1층 해방식당',
    address: '서울 용산구 용산동2가 1-555',
    road: '남영역 1번 출구에서 마을버스 이용',
    conveniences: ['예약', '포장', '무선 인터넷'],
    paymentInfo: ['제로페이'],
    virtualPhone: '0507-1382-7050',
    visitorReviewsTotal: 1680,
    visitorReviewsTextReviewTotal: 1200,
    visitorReviewsScore: 4.69,
    cafeBlogReviewsTotal: 1509,
    microReviews: ['고등어돌솥밥으로 전하는 따뜻한 한 끼']
  },
  ROOT_QUERY: {
    __typename: 'Query',
    'placeDetail({"input":{"deviceType":"mobile","id":"1838952735","isNx":false}})': {
      __typename: 'PlaceDetail',
      base: { __ref: 'PlaceDetailBase:1838952735' },
      'description({"source":["shopWindow"]})': '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.',
      'newBusinessHours({"format":"restaurant"})': [
        {
          __typename: 'NewBusinessHour',
          businessHours: [
            {
              __typename: 'WorkingHoursInfo',
              day: '월',
              businessHours: { start: '11:20', end: '22:00' },
              breakHours: [{ start: '15:00', end: '17:00' }]
            }
          ],
          comingRegularClosedDays: '화'
        }
      ],
      'informationTab({"providerSource":["pbp"]})': {
        __typename: 'InformationTab',
        parkingInfo: {
          __typename: 'InformationParking',
          description: '광진광장공영주차장에 주차 가능합니다.',
          basicParking: null,
          valetParking: null
        },
        facilities: [{ __ref: 'InformationFacilities:13' }],
        keywordList: ['숙성회', '군자횟집']
      },
      homepages: {
        __typename: 'Homepage',
        repr: {
          __typename: 'HomepageRepr',
          url: 'https://www.instagram.com/forebus_jubong',
          type: '인스타그램'
        }
      },
      menuImages: [{ __typename: 'MenuImage', imageUrl: 'https://ldb-phinf.pstatic.net/menu.png' }],
      'menus({"source":["tpirates"]})': [{ __ref: 'Menu:1838952735_0' }],
      broadcastInfos: [
        { __typename: 'BroadcastInfo', channel: 'KBS2', program: '2TV생생정보', date: '26.01.09.', menu: '해물조림' }
      ],
      'naverBooking({"bookingType":"restaurant"})': {
        __typename: 'PlaceDetailNaverBooking',
        naverBookingUrl: 'https://m.booking.naver.com/booking/6/bizes/1352276'
      },
      images: {
        __typename: 'PlaceDetailImages',
        images: [
          { __typename: 'Image', origin: 'https://ldb-phinf.pstatic.net/place-image.jpg' },
          { __typename: 'Image', origin: 'https://g-place.pstatic.net/assets/shared/images/icon_default_profile.png' },
          { __typename: 'Image', thumbnail: 'https://m.blog.naver.com/noise/12345' },
          {
            __typename: 'Image',
            thumbnail:
              'https://search.pstatic.net/common/?autoRotate=true&type=w278_sharpen&src=https%3A%2F%2Fldb-phinf.pstatic.net%2Fplace-image.jpg'
          }
        ]
      }
    }
  },
  'InformationFacilities:13': {
    __typename: 'InformationFacilities',
    name: '예약'
  },
  'Menu:1838952735_0': {
    __typename: 'Menu',
    name: '고등어돌솥밥',
    price: '12000',
    description: '대표 메뉴'
  }
})};
</script>
</body></html>`;
const naverMeShortUrl = 'https://naver.me/xUwCQUxv';
const naverMeAppLinkUrl =
  'https://m.map.naver.com/appLink.naver?pinId=1824807602&pinType=site&menu=location&appTargetPage=place&appSchemeName=nmap&mode=half&id=1824807602&app=Y&appmarket=N';
const naverMeResolvedPlaceUrl = 'https://m.place.naver.com/place/1824807602/home';
const shortPlaceApolloHtml = `<html><head><meta property="og:image" content="https://example.test/seafood.jpg" /></head><body>
<script>
window.__APOLLO_STATE__ = ${JSON.stringify({
  'PlaceDetailBase:1824807602': {
    __typename: 'PlaceDetailBase',
    id: '1824807602',
    name: '해화로in수산',
    category: '생선회',
    roadAddress: '서울 광진구 광나루로 383 1,2층',
    address: '서울 광진구 군자동 361-24',
    road: '어린이대공원역 5번출구에서 도보 1분',
    conveniences: ['단체 이용 가능', '예약', '무선 인터넷'],
    virtualPhone: '0507-1418-8295',
    visitorReviewsTotal: 1852,
    visitorReviewsScore: 0,
    cafeBlogReviewsTotal: 430,
    microReviews: ['신선한 수산물을 편하게 즐기는 매장']
  },
  ROOT_QUERY: {
    __typename: 'Query',
    'placeDetail({"input":{"deviceType":"mobile","id":"1824807602","isNx":false}})': {
      __typename: 'PlaceDetail',
      base: { __ref: 'PlaceDetailBase:1824807602' },
      images: {
        __typename: 'PlaceDetailImages',
        images: [{ __typename: 'Image', origin: 'https://ldb-phinf.pstatic.net/seafood.jpg' }]
      }
    }
  }
})};
</script>
</body></html>`;
const hospitalPlaceApolloHtml = `<html><body>
<script>
window.__APOLLO_STATE__ = ${JSON.stringify({
  'PlaceDetailBase:36372611': {
    __typename: 'PlaceDetailBase',
    id: '36372611',
    name: '남대문명동정형외과의원',
    category: '정형외과',
    roadAddress: '서울 중구 퇴계로 36 삼선빌딩 2층 201호 남대문명동정형외과의원',
    virtualPhone: '0507-1332-8176'
  },
  ROOT_QUERY: {
    __typename: 'Query',
    'placeDetail({"input":{"deviceType":"mobile","id":"36372611","isNx":false}})': {
      __typename: 'PlaceDetail',
      base: { __ref: 'PlaceDetailBase:36372611' },
      'newBusinessHours({"format":"hospital"})': [
        {
          __typename: 'NewBusinessHour',
          name: '기본',
          comingRegularClosedDays: '',
          businessHours: [
            {
              __typename: 'WorkingHoursInfo',
              day: '화',
              businessHours: { __typename: 'StartEndTime', start: '08:30', end: '19:00' },
              breakHours: [{ __typename: 'StartEndTime', start: '13:30', end: '14:30' }],
              description: null
            },
            {
              __typename: 'WorkingHoursInfo',
              day: '목',
              businessHours: { __typename: 'StartEndTime', start: '08:30', end: '20:00' },
              breakHours: [{ __typename: 'StartEndTime', start: '13:30', end: '14:30' }],
              description: null
            },
            {
              __typename: 'WorkingHoursInfo',
              day: '토',
              businessHours: { __typename: 'StartEndTime', start: '08:30', end: '13:00' },
              breakHours: [],
              description: null
            },
            {
              __typename: 'WorkingHoursInfo',
              day: '일',
              businessHours: null,
              breakHours: null,
              description: '정기휴무 (매주 일요일)'
            }
          ]
        }
      ],
      hospitalInfo: {
        __typename: 'HospitalInfo',
        sortedSubjects: [
          { __typename: 'NameCount', count: 2, name: '정형외과', code: 5 },
          { __typename: 'NameCount', count: 0, name: '가정의학과', code: 23 },
          { __typename: 'NameCount', count: 0, name: '마취통증의학과', code: 9 },
          { __typename: 'NameCount', count: 0, name: '신경과', code: 2 },
          { __typename: 'NameCount', count: 0, name: '신경외과', code: 6 },
          { __typename: 'NameCount', count: 0, name: '외과', code: 4 },
          { __typename: 'NameCount', count: 0, name: '재활의학과', code: 21 }
        ],
        specialEquipments: [
          { __typename: 'NameCount', count: 1, name: '초음파영상진단기', code: null },
          { __typename: 'NameCount', count: 1, name: '골밀도검사기', code: null },
          { __typename: 'NameCount', count: 1, name: '콘빔CT', code: null },
          { __typename: 'NameCount', count: 1, name: '일반엑스선촬영장치', code: null }
        ],
        specialOperations: [],
        specialSubjects: [],
        ext_key: 'JDQ4MTg4MSM1MSMkMiMkNCMkMDAkNDgxMTkxIzUxIyQxIyQ1IyQ5OSQyNjE0ODEjODEjJDEjJDYjJDgz'
      }
    }
  }
})};
</script>
</body></html>`;
const restaurantExpandedHomeApolloHtml = `<html><body>
<script>
window.__APOLLO_STATE__ = ${JSON.stringify({
  'PlaceDetailBase:1665751392': {
    __typename: 'PlaceDetailBase',
    id: '1665751392',
    name: '남대문바지락칼국수',
    category: '한식',
    roadAddress: '서울 중구 퇴계로2길 15 1층',
    phone: '02-318-7080',
    routeUrl: 'https://m.search.naver.com/search.naver?query=%EB%B9%A0%EB%A5%B8%EA%B8%B8%EC%B0%BE%EA%B8%B0',
    coordinate: {
      __typename: 'Coordinate',
      x: '126.9773987',
      y: '37.5569661',
      mapZoomLevel: 12
    },
    conveniences: ['무선 인터넷'],
    paymentInfo: ['제로페이']
  },
  ROOT_QUERY: {
    __typename: 'Query',
    'placeDetail({"input":{"deviceType":"mobile","id":"1665751392","isNx":false}})': {
      __typename: 'PlaceDetail',
      base: { __ref: 'PlaceDetailBase:1665751392' },
      'newBusinessHours({"format":"restaurant"})': [
        {
          __typename: 'NewBusinessHour',
          comingRegularClosedDays: '',
          businessHours: [
            {
              __typename: 'WorkingHoursInfo',
              day: '화',
              businessHours: { __typename: 'StartEndTime', start: '11:00', end: '21:30' },
              breakHours: [{ __typename: 'StartEndTime', start: '15:00', end: '17:00' }],
              description: null
            },
            {
              __typename: 'WorkingHoursInfo',
              day: '토',
              businessHours: null,
              breakHours: null,
              description: '정기휴무 (매주 토요일)'
            },
            {
              __typename: 'WorkingHoursInfo',
              day: '일',
              businessHours: null,
              breakHours: null,
              description: '정기휴무 (매주 일요일)'
            }
          ]
        }
      ],
      'informationTab({"providerSource":["pbp"]})': {
        __typename: 'InformationTab',
        parkingInfo: null,
        facilities: [{ __ref: 'InformationFacilities:7' }],
        keywordList: null
      },
      relatedLinks: [
        {
          __typename: 'RelatedLink',
          name: '다이닝코드',
          iconName: 'diningcode',
          url: 'https://diningcode.com/profile.php?rid=e3Pm5Ui6Px2S'
        }
      ],
      themes: ['조용한 분위기', '단체회식'],
      subwayStations: [
        {
          __typename: 'SubwayStation',
          no: '4호선',
          typeDesc: '회현역 4호선',
          station: { __ref: 'SubwayStationInfo:425' }
        }
      ]
    }
  },
  'InformationFacilities:7': {
    __typename: 'InformationFacilities',
    name: '무선 인터넷'
  },
  'SubwayStationInfo:425': {
    __typename: 'SubwayStationInfo',
    name: '회현'
  }
})};
</script>
</body></html>`;

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('Naver Place rendered provider', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']> | null = null;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
    connection.close();
  });

  it('extracts owner Place profile fields from rendered Naver Place HTML', () => {
    const profile = extractRenderedPlaceProfile({
      html: fixtureHtml,
      bodyText: null,
      finalUrl: placeUrl,
      naverPlaceId: '1838952735'
    });

    expect(profile).toEqual(
      expect.objectContaining({
        name: '해방식당',
        category: '한식',
        address: '서울 용산구 신흥로22길 5 1층 해방식당',
        phone: '0507-1382-7050',
        homepage: 'https://www.instagram.com/hbc.restaurant/',
        rating: 4.69,
        visitorReviewCount: 1680,
        blogReviewCount: 1509
      })
    );
    expect(profile.businessHours).toEqual(expect.arrayContaining(['영업 중', '20:40에 라스트오더']));
    expect(profile.convenience).toBe('예약, 포장, 무선 인터넷, 방문접수/출장');
    expect(profile.imageUrls).toEqual(['https://ldb-phinf.pstatic.net/place-image.jpg']);
  });

  it('extracts Place profile fields from Naver mobile Apollo state snapshots', () => {
    const profile = extractRenderedPlaceProfile({
      html: apolloPlaceHtml,
      bodyText: null,
      finalUrl: placeUrl,
      naverPlaceId: '1838952735'
    });

    expect(profile).toEqual(
      expect.objectContaining({
        name: '해방식당',
        category: '한식',
        address: '서울 용산구 신흥로22길 5 1층 해방식당',
        phone: '0507-1382-7050',
        description: '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.\n\n(AI요약정보) 고등어돌솥밥으로 전하는 따뜻한 한 끼',
        placeIntro: '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.',
        aiSummary: '고등어돌솥밥으로 전하는 따뜻한 한 끼',
        directions: '남영역 1번 출구에서 마을버스 이용',
        convenience: '예약, 포장, 무선 인터넷',
        openTime: '11:20',
        closeTime: '22:00',
        breakStart: '15:00',
        breakEnd: '17:00',
        closedDays: ['tue'],
        parking: 'near',
        parkingNote: '광진광장공영주차장에 주차 가능합니다.',
        homepageUrl: 'https://www.instagram.com/forebus_jubong',
        homepageType: '인스타그램',
        facilities: ['예약', '포장', '무선 인터넷'],
        paymentInfo: ['제로페이'],
        menuItems: [{ name: '고등어돌솥밥', price: '12000', description: '대표 메뉴' }],
        menuImageUrls: ['https://ldb-phinf.pstatic.net/menu.png'],
        reviewStats: {
          rating: 4.69,
          visitorReviewCount: 1680,
          blogReviewCount: 1509,
          visitorTextReviewCount: 1200
        },
        broadcastInfos: [{ channel: 'KBS2', program: '2TV생생정보', date: '26.01.09.', menu: '해물조림' }],
        keywords: ['숙성회', '군자횟집'],
        bookingUrl: 'https://m.booking.naver.com/booking/6/bizes/1352276',
        rating: 4.69,
        visitorReviewCount: 1680,
        blogReviewCount: 1509
      })
    );
    expect(profile.imageUrls).toEqual([
      'https://ldb-phinf.pstatic.net/place-image.jpg',
      'https://example.test/og.jpg'
    ]);
    expect(profile.imageUrls).not.toEqual(expect.arrayContaining(['https://g-place.pstatic.net/assets/shared/images/icon_default_profile.png']));
    expect(profile.imageUrls.some((url) => url.includes('m.blog.naver.com'))).toBe(false);
  });

  it('extracts hospital closed days and detailed business hour lines from Apollo business hour rows', () => {
    const profile = extractRenderedPlaceProfile({
      html: hospitalPlaceApolloHtml,
      bodyText: null,
      finalUrl: 'https://m.place.naver.com/place/36372611/home',
      naverPlaceId: '36372611'
    });

    expect(profile).toEqual(
      expect.objectContaining({
        name: '남대문명동정형외과의원',
        category: '정형외과',
        openTime: '08:30',
        closeTime: '19:00',
        breakStart: '13:30',
        breakEnd: '14:30',
        closedDays: ['sun']
      })
    );
    expect(profile.weeklyBusinessHours).toEqual([
      {
        day: 'tue',
        dayLabel: '화',
        closed: false,
        openTime: '08:30',
        closeTime: '19:00',
        breakStart: '13:30',
        breakEnd: '14:30',
        description: null
      },
      {
        day: 'thu',
        dayLabel: '목',
        closed: false,
        openTime: '08:30',
        closeTime: '20:00',
        breakStart: '13:30',
        breakEnd: '14:30',
        description: null
      },
      {
        day: 'sat',
        dayLabel: '토',
        closed: false,
        openTime: '08:30',
        closeTime: '13:00',
        breakStart: null,
        breakEnd: null,
        description: null
      },
      {
        day: 'sun',
        dayLabel: '일',
        closed: true,
        openTime: null,
        closeTime: null,
        breakStart: null,
        breakEnd: null,
        description: '정기휴무 (매주 일요일)'
      }
    ]);
    expect(profile.businessHours).toEqual([
      '화 08:30 - 19:00 / 브레이크타임 13:30 - 14:30',
      '목 08:30 - 20:00 / 브레이크타임 13:30 - 14:30',
      '토 08:30 - 13:00',
      '일 정기휴무 (매주 일요일)'
    ]);
    expect(profile.hospitalInfo).toEqual({
      sourceName: '건강보험심사평가원',
      sourceUrl:
        'https://www.hira.or.kr/ra/hosp/hospInfoAjax.do?isNewWindow=Y&ykiho=JDQ4MTg4MSM1MSMkMiMkNCMkMDAkNDgxMTkxIzUxIyQxIyQ1IyQ5OSQyNjE0ODEjODEjJDEjJDYjJDgz&isPopupYn=Y',
      subjects: ['정형외과', '가정의학과', '마취통증의학과', '신경과', '신경외과', '외과', '재활의학과'],
      specialistSubjects: [{ name: '정형외과', count: 2 }],
      specialEquipments: [
        { name: '초음파영상진단기', count: 1 },
        { name: '골밀도검사기', count: 1 },
        { name: '콘빔CT', count: 1 },
        { name: '일반엑스선촬영장치', count: 1 }
      ],
      specialOperations: [],
      specialSubjects: []
    });
  });

  it('extracts expanded restaurant home metadata from Apollo state', async () => {
    const profile = extractRenderedPlaceProfile({
      html: restaurantExpandedHomeApolloHtml,
      bodyText: null,
      finalUrl: 'https://m.place.naver.com/restaurant/1665751392/home',
      naverPlaceId: '1665751392'
    });

    expect(profile).toEqual(
      expect.objectContaining({
        name: '남대문바지락칼국수',
        category: '한식',
        openTime: '11:00',
        closeTime: '21:30',
        breakStart: '15:00',
        breakEnd: '17:00',
        closedDays: ['sat', 'sun'],
        keywords: ['조용한 분위기', '단체회식'],
        externalLinks: [{ type: '다이닝코드', url: 'https://diningcode.com/profile.php?rid=e3Pm5Ui6Px2S' }],
        routeUrl: 'https://m.search.naver.com/search.naver?query=%EB%B9%A0%EB%A5%B8%EA%B8%B8%EC%B0%BE%EA%B8%B0',
        coordinates: { x: '126.9773987', y: '37.5569661', mapZoomLevel: 12 },
        transitInfo: ['회현역 4호선']
      })
    );
    expect(profile.businessHours).toEqual([
      '화 11:00 - 21:30 / 브레이크타임 15:00 - 17:00',
      '토 정기휴무 (매주 토요일)',
      '일 정기휴무 (매주 일요일)'
    ]);

    const parsed = parseNaverPlaceUrl('https://m.place.naver.com/place/1665751392/home');
    if (!parsed) throw new Error('fixture place URL should parse');
    const imported = await importWithNaverPlaceRenderedProvider(
      parsed,
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      },
      async () => ({
        finalUrl: 'https://m.place.naver.com/restaurant/1665751392/home',
        html: restaurantExpandedHomeApolloHtml,
        bodyText: null
      })
    );

    expect(imported?.store.metadata.naverPlaceParsed).toEqual(
      expect.objectContaining({
        businessHours: profile.businessHours,
        weeklyBusinessHours: profile.weeklyBusinessHours,
        keywords: ['조용한 분위기', '단체회식'],
        externalLinks: [{ type: '다이닝코드', url: 'https://diningcode.com/profile.php?rid=e3Pm5Ui6Px2S' }],
        routeUrl: 'https://m.search.naver.com/search.naver?query=%EB%B9%A0%EB%A5%B8%EA%B8%B8%EC%B0%BE%EA%B8%B0',
        coordinates: { x: '126.9773987', y: '37.5569661', mapZoomLevel: 12 },
        transitInfo: ['회현역 4호선']
      })
    );
  });

  it('imports a Place URL with an injected rendered snapshot renderer', async () => {
    const parsed = parseNaverPlaceUrl(placeUrl);
    if (!parsed) throw new Error('fixture place URL should parse');

    const imported = await importWithNaverPlaceRenderedProvider(
      parsed,
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      },
      async () => ({
        finalUrl: placeUrl,
        html: fixtureHtml,
        bodyText: null
      })
    );

    expect(imported).not.toBeNull();
    if (!imported) throw new Error('rendered fixture import should return a profile');
    expect(imported).toEqual(
      expect.objectContaining({
        provider: { name: 'naverPlaceRenderedProvider', mode: 'real' },
        store: expect.objectContaining({
          id: 'store_1838952735',
          name: '해방식당',
          naverPlaceId: '1838952735',
          category: '한식',
          address: '서울 용산구 신흥로22길 5 1층 해방식당',
          phone: '0507-1382-7050',
          description: expect.stringContaining('남영역 1번 출구')
        })
      })
    );
    expect(imported.store.metadata).toEqual(
      expect.objectContaining({
        provider: 'naverPlaceRenderedProvider',
        importMode: 'real',
        bodyAvailability: 'rendered_place_profile',
        ownerAuthorized: true,
        sourceKind: 'place_profile',
        sourceOwnership: 'owner_managed',
        configuredPlaceProvider: 'rendered',
        homepage: 'https://www.instagram.com/hbc.restaurant/',
        rating: 4.69,
        visitorReviewCount: 1680,
        blogReviewCount: 1509
      })
    );
  });

  it('stores Place intro and labeled AI summary metadata from Apollo state imports', async () => {
    const parsed = parseNaverPlaceUrl(placeUrl);
    if (!parsed) throw new Error('fixture place URL should parse');

    const imported = await importWithNaverPlaceRenderedProvider(
      parsed,
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      },
      async () => ({
        finalUrl: placeUrl,
        html: apolloPlaceHtml,
        bodyText: null
      })
    );

    expect(imported).not.toBeNull();
    if (!imported) throw new Error('rendered Apollo import should return a profile');
    expect(imported.store.description).toBe(
      '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.\n\n(AI요약정보) 고등어돌솥밥으로 전하는 따뜻한 한 끼'
    );
    expect(imported.store.metadata).toEqual(
      expect.objectContaining({
        placeIntro: '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.',
        aiSummary: '고등어돌솥밥으로 전하는 따뜻한 한 끼',
        descriptionSource: 'place_intro_with_ai_summary',
        naverPlaceImportedAt: expect.any(String),
        naverPlaceSnapshot: expect.objectContaining({
          finalUrl: placeUrl,
          apolloStateAvailable: true,
          bodyTextAvailable: false,
          htmlHash: expect.any(String),
          apolloState: expect.objectContaining({
            base: expect.objectContaining({ name: '해방식당' }),
            detail: expect.objectContaining({
              'description({"source":["shopWindow"]})':
                '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.'
            })
          })
        }),
        naverPlaceParsed: expect.objectContaining({
          openTime: '11:20',
          closeTime: '22:00',
          breakStart: '15:00',
          breakEnd: '17:00',
          closedDays: ['tue'],
          parking: 'near',
          parkingNote: '광진광장공영주차장에 주차 가능합니다.',
          homepageUrl: 'https://www.instagram.com/forebus_jubong',
          homepageType: '인스타그램',
          facilities: ['예약', '포장', '무선 인터넷'],
          paymentInfo: ['제로페이'],
          menuItems: [{ name: '고등어돌솥밥', price: '12000', description: '대표 메뉴' }],
          menuImageUrls: ['https://ldb-phinf.pstatic.net/menu.png'],
          placeImageUrls: expect.arrayContaining(['https://ldb-phinf.pstatic.net/place-image.jpg']),
          reviewStats: {
            rating: 4.69,
            visitorReviewCount: 1680,
            blogReviewCount: 1509,
            visitorTextReviewCount: 1200
          },
          broadcastInfos: [{ channel: 'KBS2', program: '2TV생생정보', date: '26.01.09.', menu: '해물조림' }],
          keywords: ['숙성회', '군자횟집'],
          bookingUrl: 'https://m.booking.naver.com/booking/6/bizes/1352276'
        })
      })
    );
  });

  it('resolves naver.me app links to the real mobile Place detail before importing', async () => {
    const parsed = parseNaverPlaceUrl(naverMeShortUrl);
    if (!parsed) throw new Error('fixture short URL should parse');
    const calls: string[] = [];

    const imported = await importWithNaverPlaceRenderedProvider(
      parsed,
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      },
      async (url) => {
        calls.push(url);
        if (url === naverMeShortUrl) {
          return {
            finalUrl: naverMeAppLinkUrl,
            html: '<html><head><title>네이버지도</title></head><body>네이버지도</body></html>',
            bodyText: null
          };
        }
        if (url === naverMeResolvedPlaceUrl) {
          return {
            finalUrl: 'https://m.place.naver.com/restaurant/1824807602/home',
            html: shortPlaceApolloHtml,
            bodyText: null
          };
        }
        throw new Error(`Unexpected renderer URL: ${url}`);
      }
    );

    expect(calls).toEqual([naverMeShortUrl, naverMeResolvedPlaceUrl]);
    expect(imported).not.toBeNull();
    if (!imported) throw new Error('resolved short URL import should return a profile');
    expect(imported.store).toEqual(
      expect.objectContaining({
        id: 'store_1824807602',
        name: '해화로in수산',
        naverPlaceId: '1824807602',
        naverPlaceUrl: naverMeResolvedPlaceUrl,
        category: '생선회',
        address: '서울 광진구 광나루로 383 1,2층',
        phone: '0507-1418-8295'
      })
    );
    expect(imported.store.metadata).toEqual(
      expect.objectContaining({
        originalUrl: naverMeShortUrl,
        initialFinalUrl: naverMeAppLinkUrl,
        resolvedPlaceUrl: naverMeResolvedPlaceUrl
      })
    );
  });

  it('rejects Naver restriction pages instead of saving partial metadata as a successful import', async () => {
    const parsed = parseNaverPlaceUrl(placeUrl);
    if (!parsed) throw new Error('fixture place URL should parse');

    await expect(
      importWithNaverPlaceRenderedProvider(
        parsed,
        {
          NAVER_OWNER_AUTHORIZED: 'true',
          NAVER_PLACE_PROVIDER: 'rendered'
        },
        async () => ({
          finalUrl: placeUrl,
          html: '<html><head><meta property="og:title" content="해방식당 : 네이버" /></head><body></body></html>',
          bodyText: '서비스 이용이 제한되었습니다.\n과도한 접근 요청으로 서비스 이용이 제한되었습니다.'
        })
      )
    ).rejects.toThrow('restricted');
  });

  it('tries the next render layer when a previous layer returns a Naver restriction page', async () => {
    const calls: string[] = [];

    const snapshot = await renderNaverPlacePageWithRenderers(
      placeUrl,
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      },
      [
        {
          name: 'direct_http',
          render: async (url) => {
            calls.push(`restricted:${url}`);
            return {
              finalUrl: url,
              html: '<html><head><meta property="og:title" content="해방식당 : 네이버" /></head><body></body></html>',
              bodyText: '서비스 이용이 제한되었습니다.\n과도한 접근 요청으로 서비스 이용이 제한되었습니다.'
            };
          }
        },
        {
          name: 'playwright',
          render: async (url) => {
            calls.push(`success:${url}`);
            return {
              finalUrl: url,
              html: apolloPlaceHtml,
              bodyText: null
            };
          }
        }
      ]
    );

    expect(calls).toEqual([`restricted:${placeUrl}`, `success:${placeUrl}`]);
    expect(snapshot.html).toBe(apolloPlaceHtml);
  });

  it('prefers interactive rendering for Naver Place visitor review pages', () => {
    expect(shouldUseInteractiveNaverReviewRendering('https://m.place.naver.com/restaurant/1824807602/review/visitor')).toBe(
      true
    );
    expect(
      shouldUseInteractiveNaverReviewRendering('https://m.place.naver.com/place/1824807602/review/visitor?entry=pll')
    ).toBe(true);
    expect(shouldUseInteractiveNaverReviewRendering('https://m.place.naver.com/restaurant/1824807602/home')).toBe(
      false
    );
  });

  it('serves rendered Place import through the store registration API using a server-side renderer endpoint', async () => {
    const app = express();
    const providerEnv = {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_PROVIDER: 'rendered',
      NAVER_PLACE_RENDERER_ENDPOINT: ''
    };
    app.use(express.json());
    app.get('/fake-renderer', (req, res) => {
      expect(req.query.url).toBe(placeUrl);
      res.json({
        finalUrl: placeUrl,
        html: fixtureHtml,
        bodyText: null
      });
    });
    app.use(
      '/api/stores',
      createStoreRoutes({
        connection,
        env: providerEnv
      })
    );
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    providerEnv.NAVER_PLACE_RENDERER_ENDPOINT = `${baseUrl}/fake-renderer`;

    const response = await fetch(`${baseUrl}/api/stores/import-place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naverPlaceUrl: placeUrl })
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.provider).toEqual({ name: 'naverPlaceRenderedProvider', mode: 'real' });
    expect(body.store).toEqual(
      expect.objectContaining({
        id: 'store_1838952735',
        name: '해방식당',
        category: '한식',
        address: '서울 용산구 신흥로22길 5 1층 해방식당',
        phone: '0507-1382-7050'
      })
    );
    expect(body.channel.settings).toEqual(
      expect.objectContaining({
        providerName: 'naverPlaceRenderedProvider',
        configuredPlaceProvider: 'rendered',
        sourceKind: 'place_profile',
        sourceOwnership: 'owner_managed',
        ownerAuthorized: true
      })
    );
  });
});
