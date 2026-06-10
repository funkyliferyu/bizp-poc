import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('marketing ruleset API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

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

  it('returns the latest ruleset with editable field values', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.store).toMatchObject({
      id: 'store_demo_cake',
      name: '분당 케이크하우스'
    });
    expect(body.ruleset).toMatchObject({
      id: 'marketing_ruleset_demo_v1',
      status: 'draft',
      version: 1
    });
    expect(body.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'positioning',
          aiValue: '분당 당일 제작 커스텀 케이크 전문점',
          userValue: null,
          finalValue: '분당 당일 제작 커스텀 케이크 전문점',
          locked: false,
          evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_review']
        })
      ])
    );
    expect(body.fields[0]).not.toHaveProperty('fieldValue');
  });

  it('returns a field source matrix for direct Place/manual rows and AI ruleset rows', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.sourceMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'operatingHours',
          label: '운영시간',
          section: 'store',
          sourceTier: 'place_direct',
          requiresAi: false,
          automationStatus: 'available_now'
        }),
        expect.objectContaining({
          fieldKey: 'representativeMenu',
          label: '대표 메뉴',
          section: 'brand',
          sourceTier: 'place_then_ai',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'reviewWeakness',
          label: '리뷰 약점',
          section: 'brand',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'blogPreferredLength',
          label: '선호 길이',
          section: 'write_blog',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        }),
        expect.objectContaining({
          fieldKey: 'blogImageFormat',
          label: '비율·포맷',
          section: 'image_blog',
          sourceTier: 'ai_processing',
          requiresAi: true,
          automationStatus: 'ai_processing'
        })
      ])
    );
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'reviewWeakness')).toMatchObject({
      currentImplementation: expect.stringContaining('static'),
      futureSuggestion: expect.stringContaining('Place')
    });
    expect(body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'positioning')).toMatchObject({
      sourceMatrix: expect.objectContaining({
        fieldKey: 'storePositioning',
        sourceTier: 'ai_processing'
      })
    });
  });

  it('seeds ruleset fields used by the UI source matrix rows', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const body = await readJson(response);
    const fieldKeys = body.fields.map((field: { fieldKey: string }) => field.fieldKey);

    expect(response.status).toBe(200);
    expect(fieldKeys).toEqual(
      expect.arrayContaining([
        'representativeMenu',
        'reviewStrength',
        'reviewWeakness',
        'catchphrase',
        'blogPurpose',
        'blogPreferredLength',
        'blogImageFormat',
        'blogImageStyle',
        'blogOverlayPolicy'
      ])
    );
  });

  it('serves the same ruleset payload from canonical strategy-ruleset and legacy ruleset routes', async () => {
    const canonicalResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const legacyResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const canonical = await readJson(canonicalResponse);
    const legacy = await readJson(legacyResponse);

    expect(canonicalResponse.status).toBe(200);
    expect(legacyResponse.status).toBe(200);
    expect(canonical.store).toEqual(legacy.store);
    expect(canonical.ruleset).toEqual(legacy.ruleset);
    expect(canonical.fields).toEqual(legacy.fields);
    expect(canonical.sourceMatrix).toEqual(legacy.sourceMatrix);
  });

  it('edits, resets, and reads evidence through canonical strategy-ruleset field routes', async () => {
    const editedValue = '분당 기념일 케이크 전략 포지셔닝';
    const editResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue: editedValue })
    });
    const edited = await readJson(editResponse);

    expect(editResponse.status).toBe(200);
    expect(edited.field).toMatchObject({
      fieldKey: 'storePositioning',
      finalValue: editedValue,
      source: 'user_edited',
      locked: true
    });

    const evidenceResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning/evidence`);
    const evidence = await readJson(evidenceResponse);

    expect(evidenceResponse.status).toBe(200);
    expect(evidence.field).toMatchObject({ fieldKey: 'storePositioning' });
    expect(evidence.evidence.length).toBeGreaterThan(0);

    const resetResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/fields/storePositioning/reset`, {
      method: 'POST'
    });
    const reset = await readJson(resetResponse);

    expect(resetResponse.status).toBe(200);
    expect(reset.field).toMatchObject({
      fieldKey: 'storePositioning',
      userValue: null,
      source: 'ai_generated',
      locked: false
    });
  });

  it('returns benchmark evidence through the canonical strategy-ruleset API', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/benchmark-evidence`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeId).toBe('store_demo_cake');
    expect(body.defaultType).toBe('recommended');
    expect(body.benchmarkTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recommended',
          label: expect.any(String),
          candidates: expect.any(Array),
          comparison: expect.any(Array)
        })
      ])
    );
    expect(body.provider).toMatchObject({
      mode: 'mock',
      name: 'mockRulesetBenchmarkProvider'
    });
  });

  it('regenerates a writing preview without changing saved ruleset fields', async () => {
    const beforeResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const before = await readJson(beforeResponse);
    const beforeFields = before.fields;

    const previewResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/regenerate-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'blog', topic: '딸기 생크림 케이크 예약 안내', variantIndex: 1 })
    });
    const preview = await readJson(previewResponse);

    const afterResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const after = await readJson(afterResponse);

    expect(previewResponse.status).toBe(200);
    expect(preview).toMatchObject({
      channel: 'blog',
      topic: '딸기 생크림 케이크 예약 안내',
      provider: { mode: 'mock', name: 'mockRulesetPreviewProvider' },
      preview: {
        meta: expect.any(String),
        body: expect.stringContaining('딸기 생크림 케이크'),
        tags: expect.any(Array)
      }
    });
    expect(after.fields).toEqual(beforeFields);
  });

  it('returns direct store facts for ruleset rows that do not require AI', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeFacts).toMatchObject({
      name: '분당 케이크하우스',
      category: 'bakery',
      address: '경기도 성남시 분당구 정자동',
      phone: '031-000-0000',
      storeIntro: expect.stringContaining('당일 제작'),
      operatingHours: '월-금 10:00-20:00, 토 11:00-19:00',
      closedDays: '매주 일요일',
      parking: '건물 지하 주차장 1시간 지원'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'phone')).toMatchObject({
      currentValue: '031-000-0000'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'storeIntro')).toMatchObject({
      currentValue: expect.stringContaining('당일 제작')
    });
  });

  it('persists user edits, locks the field, and can reset to the AI value', async () => {
    const editedValue = '분당 기념일 레터링 케이크 예약 전문점';
    const editResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset/fields/positioning`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue: editedValue })
    });
    const edited = await readJson(editResponse);
    const repos = createStoreLearningRepositories(connection);
    const persistedEdit = repos.rulesetFields.findById('ruleset_field_demo_positioning');

    expect(editResponse.status).toBe(200);
    expect(edited.field).toMatchObject({
      fieldKey: 'positioning',
      aiValue: '분당 당일 제작 커스텀 케이크 전문점',
      userValue: editedValue,
      finalValue: editedValue,
      source: 'user_edited',
      locked: true
    });
    expect(persistedEdit).toMatchObject({
      userValue: editedValue,
      finalValue: editedValue,
      fieldValue: editedValue,
      source: 'user_edited',
      locked: 1
    });

    const reloadResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset`);
    const reloaded = await readJson(reloadResponse);
    expect(reloaded.fields.find((field: { fieldKey: string }) => field.fieldKey === 'positioning')).toMatchObject({
      finalValue: editedValue,
      source: 'user_edited',
      locked: true
    });

    const resetResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset/fields/positioning/reset`, {
      method: 'POST'
    });
    const reset = await readJson(resetResponse);
    const persistedReset = repos.rulesetFields.findById('ruleset_field_demo_positioning');

    expect(resetResponse.status).toBe(200);
    expect(reset.field).toMatchObject({
      fieldKey: 'positioning',
      userValue: null,
      finalValue: '분당 당일 제작 커스텀 케이크 전문점',
      source: 'ai_generated',
      locked: false
    });
    expect(persistedReset).toMatchObject({
      userValue: null,
      finalValue: '분당 당일 제작 커스텀 케이크 전문점',
      fieldValue: '분당 당일 제작 커스텀 케이크 전문점',
      source: 'ai_generated',
      locked: 0
    });
  });

  it('returns linked evidence with short collection item excerpts', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset/fields/positioning/evidence`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.field).toMatchObject({
      fieldKey: 'positioning'
    });
    expect(body.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionItemId: 'collection_item_demo_blog',
          channel: 'blog',
          sourceType: 'post',
          title: '분당 레터링 케이크 후기',
          excerpt: expect.stringContaining('당일 제작')
        }),
        expect.objectContaining({
          collectionItemId: 'collection_item_demo_place_review',
          channel: 'place',
          sourceType: 'review',
          title: '플레이스 리뷰 요약',
          analysisSummary: expect.stringContaining('친절한 상담')
        })
      ])
    );
    expect(body.evidence[0]).not.toHaveProperty('bodyText');
  });
});
