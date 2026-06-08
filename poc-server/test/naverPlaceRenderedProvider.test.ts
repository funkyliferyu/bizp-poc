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
  importWithNaverPlaceRenderedProvider
} from '../src/storeLearning/providers/naverPlaceRenderedProvider.js';
import { parseNaverPlaceUrl } from '../src/storeLearning/providers/naverPlaceUrlParser.js';

const fixturePath = fileURLToPath(new URL('./fixtures/naver-place-rendered-home.html', import.meta.url));
const fixtureHtml = readFileSync(fixturePath, 'utf8');
const placeUrl = 'https://m.place.naver.com/restaurant/1838952735/home';

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
    expect(profile.imageUrls).toEqual([
      'https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2Fplace-image.jpg'
    ]);
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
