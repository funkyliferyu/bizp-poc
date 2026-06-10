import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('Store registration API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    const app = express();
    app.use(express.json());
    app.use('/api/stores', createStoreRoutes({ connection, env: {} }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('imports a Naver Place URL through the mock provider and persists store/channel records', async () => {
    const response = await fetch(`${baseUrl}/api/stores/import-place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naverPlaceUrl: 'https://naver.me/demo-tteokbokki' })
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.provider.name).toBe('mockPlaceProvider');
    expect(body.store).toEqual(
      expect.objectContaining({
        id: 'store_demo_tteokbokki',
        name: '맛있는 떡볶이 홍대점',
        naverPlaceUrl: 'https://naver.me/demo-tteokbokki',
        naverPlaceId: 'demo-tteokbokki',
        category: '음식점 > 한식 > 분식',
        address: '서울 마포구 홍익로 5길 12',
        phone: '02-1234-5678',
        description: expect.stringContaining('홍대 대표 분식집')
      })
    );
    expect(body.channel).toEqual(
      expect.objectContaining({
        storeId: 'store_demo_tteokbokki',
        channel: 'place',
        sourceUrl: 'https://naver.me/demo-tteokbokki',
        status: 'connected',
        providerMode: 'mock'
      })
    );

    const repos = createStoreLearningRepositories(connection);
    expect(repos.stores.findById('store_demo_tteokbokki')?.name).toBe('맛있는 떡볶이 홍대점');
    expect(repos.storeChannels.listByStoreId('store_demo_tteokbokki')).toHaveLength(1);
  });

  it('imports a Naver Place URL through server-side Naver Local Search when mock mode is disabled', async () => {
    const providerEnv = {
      STORE_LEARNING_MOCK_MODE: 'false',
      NAVER_CLIENT_ID: 'test-client-id',
      NAVER_CLIENT_SECRET: 'test-client-secret',
      NAVER_LOCAL_SEARCH_ENDPOINT: ''
    };
    const app = express();
    app.use(express.json());
    app.get('/fake-naver/local', (req, res) => {
      expect(req.header('X-Naver-Client-Id')).toBe('test-client-id');
      expect(req.header('X-Naver-Client-Secret')).toBe('test-client-secret');
      expect(req.query.query).toBe('분당 케이크하우스');
      expect(req.query.display).toBe('1');
      expect(req.query.start).toBe('1');
      res.json({
        total: 1,
        start: 1,
        display: 1,
        items: [
          {
            title: '<b>분당</b> 케이크하우스',
            link: 'https://map.naver.com/p/entry/place/123456789',
            category: '음식점>카페,디저트',
            description: '정자동 레터링 케이크 예약 전문점입니다.',
            telephone: '',
            address: '경기도 성남시 분당구 정자동 1-1',
            roadAddress: '경기도 성남시 분당구 정자일로 1',
            mapx: '321000',
            mapy: '532000'
          }
        ]
      });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    const realServer = app.listen(0);
    const realAddress = realServer.address() as AddressInfo;
    const realBaseUrl = `http://127.0.0.1:${realAddress.port}`;
    providerEnv.NAVER_LOCAL_SEARCH_ENDPOINT = `${realBaseUrl}/fake-naver/local`;

    try {
      const response = await fetch(`${realBaseUrl}/api/stores/import-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naverPlaceUrl: 'https://map.naver.com/p/search/%EB%B6%84%EB%8B%B9%20%EC%BC%80%EC%9D%B4%ED%81%AC%ED%95%98%EC%9A%B0%EC%8A%A4/place/123456789'
        })
      });
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.provider).toEqual({ name: 'naverLocalSearchProvider', mode: 'real' });
      expect(body.store).toEqual(
        expect.objectContaining({
          id: 'store_123456789',
          name: '분당 케이크하우스',
          naverPlaceId: '123456789',
          category: '음식점>카페,디저트',
          address: '경기도 성남시 분당구 정자일로 1',
          phone: null,
          description: '정자동 레터링 케이크 예약 전문점입니다.'
        })
      );
      expect(body.store.metadata).toEqual(
        expect.objectContaining({
          provider: 'naverLocalSearchProvider',
          importMode: 'real',
          query: '분당 케이크하우스',
          bodyAvailability: 'official_local_search_metadata_only'
        })
      );
      expect(body.channel).toEqual(
        expect.objectContaining({
          storeId: 'store_123456789',
          channel: 'place',
          providerMode: 'real'
        })
      );
    } finally {
      await new Promise<void>((resolve) => realServer.close(() => resolve()));
    }
  });

  it('honors explicit official_search place provider routing and owner authorization metadata', async () => {
    const providerEnv = {
      NAVER_PLACE_PROVIDER: 'official_search',
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_CLIENT_ID: 'explicit-client-id',
      NAVER_CLIENT_SECRET: 'explicit-client-secret',
      NAVER_LOCAL_SEARCH_ENDPOINT: ''
    };
    const app = express();
    app.use(express.json());
    app.get('/fake-naver/local', (req, res) => {
      expect(req.header('X-Naver-Client-Id')).toBe('explicit-client-id');
      expect(req.header('X-Naver-Client-Secret')).toBe('explicit-client-secret');
      expect(req.query.query).toBe('분당 케이크하우스');
      res.json({
        total: 1,
        start: 1,
        display: 1,
        items: [
          {
            title: '<b>분당</b> 케이크하우스',
            link: 'https://map.naver.com/p/entry/place/123456789',
            category: '음식점>카페,디저트',
            description: '정자동 레터링 케이크 예약 전문점입니다.',
            roadAddress: '경기도 성남시 분당구 정자일로 1'
          }
        ]
      });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    const explicitServer = app.listen(0);
    const explicitAddress = explicitServer.address() as AddressInfo;
    const explicitBaseUrl = `http://127.0.0.1:${explicitAddress.port}`;
    providerEnv.NAVER_LOCAL_SEARCH_ENDPOINT = `${explicitBaseUrl}/fake-naver/local`;

    try {
      const response = await fetch(`${explicitBaseUrl}/api/stores/import-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naverPlaceUrl: 'https://map.naver.com/p/search/%EB%B6%84%EB%8B%B9%20%EC%BC%80%EC%9D%B4%ED%81%AC%ED%95%98%EC%9A%B0%EC%8A%A4/place/123456789'
        })
      });
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.provider).toEqual({ name: 'naverLocalSearchProvider', mode: 'real' });
      expect(body.store.name).toBe('분당 케이크하우스');
      expect(body.store.metadata).toEqual(
        expect.objectContaining({
          configuredPlaceProvider: 'official_search',
          ownerAuthorized: true,
          sourceKind: 'place_profile',
          sourceOwnership: 'owner_managed'
        })
      );
      expect(body.channel.settings).toEqual(
        expect.objectContaining({
          configuredPlaceProvider: 'official_search',
          ownerAuthorized: true,
          sourceKind: 'place_profile',
          sourceOwnership: 'owner_managed'
        })
      );
    } finally {
      await new Promise<void>((resolve) => explicitServer.close(() => resolve()));
    }
  });

  it('reuses the saved store data on read without calling the Naver renderer again', async () => {
    const providerEnv = {
      NAVER_PLACE_PROVIDER: 'rendered',
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_RENDERER_ENDPOINT: ''
    };
    const renderedPlaceUrl = 'https://m.place.naver.com/restaurant/1838952735/home';
    const renderedHtml = `<html><body><script>window.__APOLLO_STATE__ = ${JSON.stringify({
      'PlaceDetailBase:1838952735': {
        __typename: 'PlaceDetailBase',
        id: '1838952735',
        name: '해방식당',
        category: '한식',
        roadAddress: '서울 용산구 신흥로22길 5 1층 해방식당',
        virtualPhone: '0507-1382-7050',
        visitorReviewsTotal: 1680,
        cafeBlogReviewsTotal: 1509,
        microReviews: ['고등어돌솥밥으로 전하는 따뜻한 한 끼']
      },
      ROOT_QUERY: {
        __typename: 'Query',
        'placeDetail({"input":{"deviceType":"mobile","id":"1838952735","isNx":false}})': {
          __typename: 'PlaceDetail',
          base: { __ref: 'PlaceDetailBase:1838952735' },
          'description({"source":["shopWindow"]})': '해방촌 골목에서 고등어돌솥밥과 정갈한 한식을 준비하는 식당입니다.'
        }
      }
    })};</script></body></html>`;
    const app = express();
    const rendererCalls: string[] = [];
    app.use(express.json());
    app.get('/fake-renderer', (req, res) => {
      rendererCalls.push(String(req.query.url));
      res.json({
        finalUrl: renderedPlaceUrl,
        html: renderedHtml,
        bodyText: null
      });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    const renderedServer = app.listen(0);
    const renderedAddress = renderedServer.address() as AddressInfo;
    const renderedBaseUrl = `http://127.0.0.1:${renderedAddress.port}`;
    providerEnv.NAVER_PLACE_RENDERER_ENDPOINT = `${renderedBaseUrl}/fake-renderer`;

    try {
      const importResponse = await fetch(`${renderedBaseUrl}/api/stores/import-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naverPlaceUrl: renderedPlaceUrl })
      });
      expect(importResponse.status).toBe(200);

      const readResponse = await fetch(`${renderedBaseUrl}/api/stores/store_1838952735`);
      const loaded = await readJson(readResponse);

      expect(readResponse.status).toBe(200);
      expect(rendererCalls).toEqual([renderedPlaceUrl]);
      expect(loaded.store).toEqual(
        expect.objectContaining({
          id: 'store_1838952735',
          name: '해방식당',
          description: expect.stringContaining('(AI요약정보) 고등어돌솥밥으로 전하는 따뜻한 한 끼')
        })
      );
    } finally {
      await new Promise<void>((resolve) => renderedServer.close(() => resolve()));
    }
  });

  it('persists external channel links detected from rendered Naver Place imports', async () => {
    const providerEnv = {
      NAVER_PLACE_PROVIDER: 'rendered',
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_PLACE_RENDERER_ENDPOINT: ''
    };
    const renderedPlaceUrl = 'https://m.place.naver.com/place/1020864025/home';
    const renderedHtml = `<html><body><script>window.__APOLLO_STATE__ = ${JSON.stringify({
      'PlaceDetailBase:1020864025': {
        __typename: 'PlaceDetailBase',
        id: '1020864025',
        name: '테라스의원',
        category: '피부과',
        roadAddress: '서울 종로구 송월길 99 경희궁자이2단지 205동상가 2층',
        virtualPhone: '02-6105-0010'
      },
      ROOT_QUERY: {
        __typename: 'Query',
        'placeDetail({"input":{"deviceType":"mobile","id":"1020864025","isNx":false}})': {
          __typename: 'PlaceDetail',
          base: { __ref: 'PlaceDetailBase:1020864025' },
          homepages: {
            __typename: 'Homepage',
            repr: {
              __typename: 'HomepageRepr',
              url: 'https://terraceclinic.com',
              type: '웹사이트'
            },
            items: [
              { __typename: 'HomepageItem', url: 'https://blog.naver.com/terraceclinic', type: '블로그' },
              { __typename: 'HomepageItem', url: 'https://www.youtube.com/@terraceclinic', type: '유튜브' },
              { __typename: 'HomepageItem', url: 'https://www.instagram.com/terraceclinic', type: '인스타그램' },
              { __typename: 'HomepageItem', url: 'https://www.tiktok.com/@terraceclinic', type: '틱톡' }
            ]
          },
          relatedLinks: [
            {
              __typename: 'RelatedLink',
              name: '당근',
              url: 'https://www.daangn.com/kr/local-profile/terraceclinic'
            }
          ]
        }
      }
    })};</script></body></html>`;
    const app = express();
    app.use(express.json());
    app.get('/fake-renderer', (_req, res) => {
      res.json({
        finalUrl: renderedPlaceUrl,
        html: renderedHtml,
        bodyText: null
      });
    });
    app.use('/api/stores', createStoreRoutes({ connection, env: providerEnv }));
    const renderedServer = app.listen(0);
    const renderedAddress = renderedServer.address() as AddressInfo;
    const renderedBaseUrl = `http://127.0.0.1:${renderedAddress.port}`;
    providerEnv.NAVER_PLACE_RENDERER_ENDPOINT = `${renderedBaseUrl}/fake-renderer`;

    try {
      const response = await fetch(`${renderedBaseUrl}/api/stores/import-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naverPlaceUrl: renderedPlaceUrl })
      });
      const body = await readJson(response);
      const expectedLinks = [
        { channel: 'blog', label: '블로그', url: 'https://blog.naver.com/terraceclinic' },
        { channel: 'instagram', label: '인스타그램', url: 'https://www.instagram.com/terraceclinic' },
        { channel: 'youtube', label: '유튜브', url: 'https://www.youtube.com/@terraceclinic' },
        { channel: 'tiktok', label: '틱톡', url: 'https://www.tiktok.com/@terraceclinic' },
        { channel: 'daangn', label: '당근', url: 'https://www.daangn.com/kr/local-profile/terraceclinic' }
      ];

      expect(response.status).toBe(200);
      expect(body.store.metadata.externalChannelLinks).toEqual(expect.arrayContaining(expectedLinks));
      expect(body.store.metadata.naverPlaceParsed.externalChannelLinks).toEqual(expect.arrayContaining(expectedLinks));

      const repos = createStoreLearningRepositories(connection);
      const channelsByName = new Map(repos.storeChannels.listByStoreId('store_1020864025').map((channel) => [channel.channel, channel]));
      expect(channelsByName.get('blog')).toEqual(
        expect.objectContaining({
          sourceUrl: 'https://blog.naver.com/terraceclinic',
          status: 'connected'
        })
      );
      for (const channelName of ['instagram', 'youtube', 'tiktok', 'daangn']) {
        expect(channelsByName.get(channelName)).toEqual(
          expect.objectContaining({
            sourceUrl: expectedLinks.find((link) => link.channel === channelName)?.url,
            status: 'connected',
            providerMode: 'provider_ready',
            settings: expect.objectContaining({
              providerScope: 'not_implemented',
              detectedFrom: 'naver_place'
            })
          })
        );
      }
    } finally {
      await new Promise<void>((resolve) => renderedServer.close(() => resolve()));
    }
  });

  it('saves, reads, and patches a store through SQLite-backed repositories', async () => {
    const createResponse = await fetch(`${baseUrl}/api/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'store_manual_001',
        name: '수동 등록 매장',
        naverPlaceUrl: 'https://naver.me/manual-001',
        category: '음식점 > 한식 > 분식',
        address: '서울 마포구 테스트로 1',
        phone: '02-0000-0000',
        description: '수동 등록 설명',
        metadata: {
          businessNumber: '123-45-67890',
          openTime: '10:00',
          closeTime: '21:00'
        }
      })
    });
    const created = await readJson(createResponse);

    expect(createResponse.status).toBe(200);
    expect(created.store.id).toBe('store_manual_001');

    const patchResponse = await fetch(`${baseUrl}/api/stores/store_manual_001`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '수동 등록 매장 수정',
        metadata: {
          closeTime: '22:00',
          parking: 'near'
        }
      })
    });
    const patched = await readJson(patchResponse);

    expect(patchResponse.status).toBe(200);
    expect(patched.store.name).toBe('수동 등록 매장 수정');
    expect(patched.store.metadata).toEqual(
      expect.objectContaining({
        businessNumber: '123-45-67890',
        openTime: '10:00',
        closeTime: '22:00',
        parking: 'near'
      })
    );

    const getResponse = await fetch(`${baseUrl}/api/stores/store_manual_001`);
    const loaded = await readJson(getResponse);

    expect(getResponse.status).toBe(200);
    expect(loaded.store).toEqual(patched.store);
  });
});
