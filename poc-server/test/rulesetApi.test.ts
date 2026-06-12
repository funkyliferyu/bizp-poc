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

function createRulesetVersion(
  repos: ReturnType<typeof createStoreLearningRepositories>,
  input: {
    version: number;
    fieldValue: string;
    source?: string;
    userValue?: string | null;
    locked?: number;
  }
) {
  const timestamp = `2026-06-11T00:00:${String(input.version).padStart(2, '0')}.000Z`;
  const collectionRunId = `collection_run_ruleset_version_${input.version}`;
  const analysisRunId = `analysis_run_ruleset_version_${input.version}`;
  const learningSnapshotId = `learning_snapshot_ruleset_version_${input.version}`;
  const rulesetId = `marketing_ruleset_version_${input.version}`;
  repos.collectionRuns.create({
    id: collectionRunId,
    storeId: 'store_demo_cake',
    status: 'completed',
    mode: 'mock',
    startedAt: timestamp,
    completedAt: timestamp,
    summary: {}
  });
  repos.analysisRuns.create({
    id: analysisRunId,
    storeId: 'store_demo_cake',
    collectionRunId,
    status: 'completed',
    startedAt: timestamp,
    completedAt: timestamp,
    result: {},
    error: null
  });
  repos.learningSnapshots.create({
    id: learningSnapshotId,
    storeId: 'store_demo_cake',
    analysisRunId,
    status: 'active',
    snapshot: {},
    createdAt: timestamp,
    updatedAt: timestamp
  });
  repos.marketingRulesets.create({
    id: rulesetId,
    storeId: 'store_demo_cake',
    learningSnapshotId,
    status: 'draft',
    version: input.version,
    ruleset: {
      generatedBy: `test_version_${input.version}`
    },
    createdAt: timestamp,
    updatedAt: timestamp
  });
  repos.rulesetFields.create({
    id: `ruleset_field_version_${input.version}_storePositioning`,
    rulesetId,
    fieldKey: 'storePositioning',
    fieldValue: input.fieldValue,
    aiValue: input.fieldValue,
    userValue: input.userValue ?? null,
    finalValue: input.userValue ?? input.fieldValue,
    source: input.source ?? 'openai_analysis',
    locked: input.locked ?? 0,
    evidenceItemIds: ['collection_item_demo_blog'],
    confidence: 0.7,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return {
    collectionRunId,
    analysisRunId,
    learningSnapshotId,
    rulesetId
  };
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

  it('lists ruleset versions in descending version order with summary metadata', async () => {
    const repos = createStoreLearningRepositories(connection);
    const v2 = createRulesetVersion(repos, {
      version: 2,
      fieldValue: 'v2 포지셔닝',
      source: 'openai_analysis'
    });
    const v3 = createRulesetVersion(repos, {
      version: 3,
      fieldValue: 'v3 포지셔닝',
      source: 'analysis_backfill'
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/versions`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeId).toBe('store_demo_cake');
    expect(body.versions.map((version: { version: number }) => version.version)).toEqual([3, 2, 1]);
    expect(body.versions[0]).toMatchObject({
      id: v3.rulesetId,
      version: 3,
      status: 'draft',
      learningSnapshotId: v3.learningSnapshotId,
      analysisRunId: v3.analysisRunId,
      fieldCount: 1,
      sourceCounts: {
        analysis_backfill: 1
      },
      isCurrent: true
    });
    expect(body.versions[1]).toMatchObject({
      id: v2.rulesetId,
      version: 2,
      sourceCounts: {
        openai_analysis: 1
      },
      isCurrent: false
    });
  });

  it('fetches a historical ruleset version without returning latest fields', async () => {
    const repos = createStoreLearningRepositories(connection);
    const v2 = createRulesetVersion(repos, {
      version: 2,
      fieldValue: 'v2 복원 후보 포지셔닝',
      source: 'openai_analysis'
    });
    createRulesetVersion(repos, {
      version: 3,
      fieldValue: 'v3 최신 포지셔닝',
      source: 'openai_analysis'
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/versions/${v2.rulesetId}`);
    const body = await readJson(response);
    const positioningField = body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'storePositioning');

    expect(response.status).toBe(200);
    expect(body.ruleset).toMatchObject({
      id: v2.rulesetId,
      version: 2,
      isCurrent: false
    });
    expect(body.analysis).toMatchObject({
      id: v2.analysisRunId
    });
    expect(positioningField).toMatchObject({
      fieldKey: 'storePositioning',
      finalValue: 'v2 복원 후보 포지셔닝'
    });
    expect(positioningField.finalValue).not.toBe('v3 최신 포지셔닝');
  });

  it('restores a historical ruleset as a new latest version without analysis or LLM audit rows', async () => {
    const repos = createStoreLearningRepositories(connection);
    const v2 = createRulesetVersion(repos, {
      version: 2,
      fieldValue: 'v2 원복 포지셔닝',
      source: 'openai_analysis',
      userValue: 'v2 사용자 수정 포지셔닝',
      locked: 1
    });
    createRulesetVersion(repos, {
      version: 3,
      fieldValue: 'v3 포지셔닝',
      source: 'analysis_backfill'
    });
    createRulesetVersion(repos, {
      version: 4,
      fieldValue: 'v4 최신 포지셔닝',
      source: 'openai_analysis'
    });
    const analysisRunCountBefore = repos.analysisRuns.listByStoreId('store_demo_cake').length;
    const auditLogCountBefore = repos.llmAuditLogs.all().length;

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset/versions/${v2.rulesetId}/restore`, {
      method: 'POST'
    });
    const restored = await readJson(response);

    const latestResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const latest = await readJson(latestResponse);
    const latestField = latest.fields.find((field: { fieldKey: string }) => field.fieldKey === 'storePositioning');
    const historicalField = repos.rulesetFields.findById('ruleset_field_version_2_storePositioning');

    expect(response.status).toBe(200);
    expect(restored.ruleset).toMatchObject({
      version: 5,
      status: 'draft',
      restoredFromRulesetId: v2.rulesetId,
      restoredFromVersion: 2,
      isCurrent: true
    });
    expect(restored.fields.find((field: { fieldKey: string }) => field.fieldKey === 'storePositioning')).toMatchObject({
      finalValue: 'v2 사용자 수정 포지셔닝',
      userValue: 'v2 사용자 수정 포지셔닝',
      source: 'openai_analysis',
      locked: true
    });
    expect(latestResponse.status).toBe(200);
    expect(latest.ruleset).toMatchObject({
      id: restored.ruleset.id,
      version: 5
    });
    expect(latestField).toMatchObject({
      finalValue: 'v2 사용자 수정 포지셔닝',
      locked: true
    });
    expect(historicalField).toMatchObject({
      finalValue: 'v2 사용자 수정 포지셔닝',
      locked: 1
    });
    expect(repos.analysisRuns.listByStoreId('store_demo_cake')).toHaveLength(analysisRunCountBefore);
    expect(repos.llmAuditLogs.all()).toHaveLength(auditLogCountBefore);
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
          sourceTier: 'ai_processing',
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
          sourceTier: 'blog_parser',
          requiresAi: false,
          automationStatus: 'parser_ready'
        })
      ])
    );
    expect(body.sourceMatrix.map((row: { fieldKey: string }) => row.fieldKey)).not.toEqual(
      expect.arrayContaining(['instagramPurpose', 'imageDirection', 'blogImageFormat'])
    );
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'reviewWeakness')).toMatchObject({
      currentImplementation: expect.stringContaining('Generated by analyzer'),
      futureSuggestion: expect.stringContaining('Place')
    });
    expect(body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'positioning')).toMatchObject({
      sourceMatrix: expect.objectContaining({
        fieldKey: 'storePositioning',
        sourceTier: 'ai_processing'
      })
    });
  });

  it('serializes sourceStatus for computed and insufficient-evidence ruleset fields', async () => {
    const repos = createStoreLearningRepositories(connection);
    const v9 = createRulesetVersion(repos, {
      version: 9,
      fieldValue: 'source status test positioning',
      source: 'openai_analysis'
    });
    const timestamp = '2026-06-11T00:09:01.000Z';
    repos.rulesetFields.create({
      id: 'ruleset_field_source_status_blogPreferredLength',
      rulesetId: v9.rulesetId,
      fieldKey: 'blogPreferredLength',
      fieldValue: '중앙값 900자 기반 700~1,100자',
      aiValue: '중앙값 900자 기반 700~1,100자',
      userValue: null,
      finalValue: '중앙값 900자 기반 700~1,100자',
      source: 'analysis_computed',
      locked: 0,
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_source_status_reviewWeakness',
      rulesetId: v9.rulesetId,
      fieldKey: 'reviewWeakness',
      fieldValue: '리뷰 데이터가 부족해 추론하지 않음',
      aiValue: '리뷰 데이터가 부족해 추론하지 않음',
      userValue: null,
      finalValue: '리뷰 데이터가 부족해 추론하지 않음',
      source: 'input_blocked',
      locked: 0,
      evidenceItemIds: [],
      confidence: null,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'blogPreferredLength')).toMatchObject({
      fieldKey: 'blogPreferredLength',
      source: 'analysis_computed',
      sourceStatus: 'computed',
      confidence: 1
    });
    expect(body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'reviewWeakness')).toMatchObject({
      fieldKey: 'reviewWeakness',
      source: 'input_blocked',
      sourceStatus: 'insufficient_evidence',
      confidence: null
    });
  });

  it('returns server-derived writing style field insights with calculation logic and suggestions', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/strategy-ruleset`);
    const body = await readJson(response);
    const requiredFieldKeys = [
      'blogPurpose',
      'keywordMap',
      'titlePatterns',
      'introPattern',
      'bodyOutlinePattern',
      'headingPattern',
      'blogWritingStyle',
      'blogPreferredLength',
      'blogHashtags',
      'blogEmojiPolicy',
      'seoKeywords',
      'seoPlacementPolicy',
      'ctaStyle',
      'humorLevel',
      'trendSensitivity',
      'industryCommonRules',
      'blogRequiredIntroCopy',
      'blogRequiredFooterCopy'
    ];
    const insightsByKey = new Map(
      body.writingStyleInsights.map((insight: { fieldKey: string }) => [insight.fieldKey, insight])
    );

    expect(response.status).toBe(200);
    expect(body.writingStyleInsights).toEqual(expect.any(Array));
    for (const fieldKey of requiredFieldKeys) {
      const insight = insightsByKey.get(fieldKey) as {
        fieldKey: string;
        currentValue: string | null;
        currentValueStatus: string;
        calculationLogic: string;
        aiSuggestion: {
          value: string;
          judgment: string;
          evidence: string;
          inputSignals: string[];
        };
      };

      expect(insight).toMatchObject({
        fieldKey,
        currentValueStatus: expect.stringMatching(/^(inferred|user_edited|placeholder|empty)$/),
        calculationLogic: expect.any(String),
        aiSuggestion: expect.objectContaining({
          value: expect.any(String),
          judgment: expect.stringMatching(/^(maintain|improve)$/),
          evidence: expect.any(String),
          inputSignals: expect.arrayContaining([expect.any(String)])
        })
      });
      expect(insight.calculationLogic.length).toBeGreaterThan(20);
      expect(insight.aiSuggestion.evidence.length).toBeGreaterThan(20);
    }
    expect(insightsByKey.get('blogRequiredIntroCopy')).toMatchObject({
      currentValueStatus: 'placeholder',
      placeholderText: expect.stringContaining('반복')
    });
    expect(insightsByKey.get('blogWritingStyle')).toMatchObject({
      currentValueStatus: 'inferred',
      aiSuggestion: expect.objectContaining({ judgment: 'maintain' })
    });
    expect(insightsByKey.get('blogPreferredLength')).toMatchObject({
      currentValue: '본문 700-1,000자, 소제목 3-5개, CTA 포함 권장'
    });
    expect((insightsByKey.get('blogPreferredLength') as { currentValue: string }).currentValue).not.toContain('사진');
    expect(insightsByKey.get('blogPurpose')).toMatchObject({
      aiSuggestion: expect.objectContaining({ judgment: 'improve' })
    });
  });

  it('uses the current healthcare store name in required blog footer copy defaults and legacy AI values', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_healthcare_footer_copy',
      name: '서구연세정형외과의원',
      naverPlaceUrl: 'https://m.place.naver.com/place/12841526/home',
      naverPlaceId: '12841526',
      category: '의료/건강 > 병원/클리닉 > 정형외과',
      address: '인천 서구 가정로394번길 1 백천빌딩',
      phone: '032-582-7582',
      description: null,
      metadata: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_healthcare_footer_copy',
      storeId: 'store_healthcare_footer_copy',
      learningSnapshotId: null,
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_healthcare_footer_copy',
      rulesetId: 'marketing_ruleset_healthcare_footer_copy',
      fieldKey: 'blogRequiredFooterCopy',
      fieldValue: '*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
      aiValue: '*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
      userValue: null,
      finalValue: '*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
      source: 'ai_generated',
      locked: 0,
      evidenceItemIds: [],
      confidence: 0.84
    });

    const response = await fetch(`${baseUrl}/api/stores/store_healthcare_footer_copy/strategy-ruleset`);
    const body = await readJson(response);
    const footerField = body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'blogRequiredFooterCopy');
    const footerInsight = body.writingStyleInsights.find(
      (insight: { fieldKey: string }) => insight.fieldKey === 'blogRequiredFooterCopy'
    );

    expect(response.status).toBe(200);
    expect(footerField).toMatchObject({
      aiValue: expect.stringContaining('서구연세정형외과의원'),
      finalValue: expect.stringContaining('서구연세정형외과의원')
    });
    expect(footerField.aiValue).not.toContain('테라스의원');
    expect(footerField.finalValue).not.toContain('테라스의원');
    expect(footerInsight).toMatchObject({
      currentValue: expect.stringContaining('서구연세정형외과의원'),
      currentValueStatus: 'inferred'
    });
    expect(footerInsight.currentValue).not.toContain('테라스의원');
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
        'industryCommonRules',
        'blogRequiredIntroCopy',
        'blogRequiredFooterCopy',
        'blogPurpose',
        'blogPreferredLength',
        'blogHashtags'
      ])
    );
    expect(fieldKeys).not.toEqual(
      expect.arrayContaining(['instagramPurpose', 'imageDirection', 'blogImageFormat'])
    );
  });

  it('backfills review weakness from collected review evidence for legacy rulesets', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_legacy_review_weakness',
      name: '레거시 리뷰 약점 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: '의료/건강 > 병원/클리닉 > 피부과',
      address: '서울 종로구',
      phone: null,
      description: null,
      metadata: {}
    });
    repos.collectionRuns.create({
      id: 'collection_run_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      status: 'completed',
      mode: 'real',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_legacy_review_pain',
      runId: 'collection_run_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      channel: 'place',
      sourceType: 'review',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/place/legacy/review/visitor#pain',
      title: '방문자 리뷰 - 통증 걱정',
      bodyText: '리쥬란은 예전에 너무 아파서 겁냈는데 마취크림을 꼼꼼히 발라주셔서 편하게 받았어요.',
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_legacy_review_crowded',
      runId: 'collection_run_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      channel: 'place',
      sourceType: 'review',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/place/legacy/review/visitor#crowded',
      title: '방문자 리뷰 - 혼잡',
      bodyText: '효과가 좋아서 다시 방문했는데 유명해서 그런지 사람이 많더라구요.',
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.analysisRuns.create({
      id: 'analysis_run_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      collectionRunId: 'collection_run_legacy_review_weakness',
      status: 'completed',
      startedAt: '2026-06-10T00:00:01.000Z',
      completedAt: '2026-06-10T00:00:02.000Z',
      result: {},
      error: null
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      analysisRunId: 'analysis_run_legacy_review_weakness',
      status: 'active',
      snapshot: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_legacy_review_weakness',
      storeId: 'store_legacy_review_weakness',
      learningSnapshotId: 'learning_snapshot_legacy_review_weakness',
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_legacy_review_weakness_positioning',
      rulesetId: 'marketing_ruleset_legacy_review_weakness',
      fieldKey: 'storePositioning',
      fieldValue: '서울 종로구 피부과 상담형 클리닉',
      aiValue: '서울 종로구 피부과 상담형 클리닉',
      userValue: null,
      finalValue: '서울 종로구 피부과 상담형 클리닉',
      source: 'analysis',
      locked: 0,
      evidenceItemIds: ['collection_item_legacy_review_pain'],
      confidence: 0.8
    });

    const response = await fetch(`${baseUrl}/api/stores/store_legacy_review_weakness/strategy-ruleset`);
    const body = await readJson(response);
    const weaknessField = body.fields.find((field: { fieldKey: string }) => field.fieldKey === 'reviewWeakness');

    expect(response.status).toBe(200);
    expect(weaknessField).toMatchObject({
      fieldKey: 'reviewWeakness',
      finalValue: expect.stringContaining('통증 걱정'),
      source: 'analysis_backfill',
      locked: false,
      evidenceItemIds: expect.arrayContaining(['collection_item_legacy_review_pain'])
    });
    expect(weaknessField.finalValue).not.toContain('주차 공간 협소');
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'reviewWeakness')).toMatchObject({
      currentValue: weaknessField.finalValue
    });

    const evidenceResponse = await fetch(`${baseUrl}/api/stores/store_legacy_review_weakness/strategy-ruleset/fields/reviewWeakness/evidence`);
    const evidence = await readJson(evidenceResponse);

    expect(evidenceResponse.status).toBe(200);
    expect(evidence.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionItemId: 'collection_item_legacy_review_pain',
          excerpt: expect.stringContaining('아파서 겁')
        })
      ])
    );

    const patchResponse = await fetch(`${baseUrl}/api/stores/store_legacy_review_weakness/strategy-ruleset/fields/reviewWeakness`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userValue: '상담 전 통증 걱정을 먼저 낮추는 안내가 필요함' })
    });
    const patched = await readJson(patchResponse);
    expect(patchResponse.status).toBe(200);
    expect(patched.field).toMatchObject({
      fieldKey: 'reviewWeakness',
      finalValue: '상담 전 통증 걱정을 먼저 낮추는 안내가 필요함',
      source: 'user_edited',
      locked: true
    });

    const resetResponse = await fetch(`${baseUrl}/api/stores/store_legacy_review_weakness/strategy-ruleset/fields/reviewWeakness/reset`, {
      method: 'POST'
    });
    const reset = await readJson(resetResponse);
    expect(resetResponse.status).toBe(200);
    expect(reset.field).toMatchObject({
      fieldKey: 'reviewWeakness',
      finalValue: expect.stringContaining('통증 걱정'),
      locked: false
    });
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

  it('returns newly imported store Place facts without requiring an existing ruleset', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_real_place_without_ruleset',
      name: '테라스의원',
      naverPlaceUrl: 'https://m.place.naver.com/hospital/1020864025/home',
      naverPlaceId: '1020864025',
      category: '의료,건강 > 병원 > 피부과',
      address: '서울 종로구 송월길 99 경희궁자이2단지 205동상가 2층',
      phone: '02-6105-0010',
      description: null,
      metadata: {
        naverPlaceParsed: {
          businessHours: ['월-금 10:00-19:00', '토 10:00-14:00'],
          closedDays: '일요일',
          parking: 'near',
          parkingNote: '경희궁자이2단지아파트 후문 상가 주차장 이용 가능',
          placeIntro: '대표원장 직접 상담으로 차별화된 피부과 진료를 제공합니다.'
        }
      }
    });

    const response = await fetch(`${baseUrl}/api/stores/store_real_place_without_ruleset/strategy-ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.store).toMatchObject({
      id: 'store_real_place_without_ruleset',
      name: '테라스의원'
    });
    expect(body.ruleset).toBeNull();
    expect(body.learningSnapshot).toBeNull();
    expect(body.analysis).toBeNull();
    expect(body.fields).toEqual([]);
    expect(body.storeFacts).toMatchObject({
      name: '테라스의원',
      category: '의료,건강 > 병원 > 피부과',
      address: '서울 종로구 송월길 99 경희궁자이2단지 205동상가 2층',
      phone: '02-6105-0010',
      operatingHours: '월-금 10:00-19:00, 토 10:00-14:00',
      closedDays: '일요일',
      parking: '경희궁자이2단지아파트 후문 상가 주차장 이용 가능',
      storeIntro: '대표원장 직접 상담으로 차별화된 피부과 진료를 제공합니다.'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'operatingHours')).toMatchObject({
      currentValue: '월-금 10:00-19:00, 토 10:00-14:00'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'parking')).toMatchObject({
      currentValue: '경희궁자이2단지아파트 후문 상가 주차장 이용 가능'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'storeIntro')).toMatchObject({
      currentValue: '대표원장 직접 상담으로 차별화된 피부과 진료를 제공합니다.'
    });
  });

  it('returns real healthcare representative treatment subjects before mock menu values', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_healthcare_subjects',
      name: '서구연세정형외과의원',
      naverPlaceUrl: 'https://m.place.naver.com/place/12841526/home',
      naverPlaceId: '12841526',
      category: '의료/건강 > 병원/클리닉 > 정형외과',
      address: '인천 서구 가정로394번길 1 백천빌딩',
      phone: '032-582-7582',
      description: null,
      metadata: {
        naverPlaceParsed: {
          hospitalInfo: {
            subjects: ['정형외과', '내과', '신경외과', '재활의학과']
          }
        }
      }
    });
    repos.collectionRuns.create({
      id: 'collection_run_healthcare_subjects',
      storeId: 'store_healthcare_subjects',
      status: 'completed',
      mode: 'mock',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {}
    });
    repos.analysisRuns.create({
      id: 'analysis_run_healthcare_subjects',
      storeId: 'store_healthcare_subjects',
      collectionRunId: 'collection_run_healthcare_subjects',
      status: 'completed',
      startedAt: '2026-06-10T00:00:01.000Z',
      completedAt: '2026-06-10T00:00:02.000Z',
      result: {},
      error: null
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_healthcare_subjects',
      storeId: 'store_healthcare_subjects',
      analysisRunId: 'analysis_run_healthcare_subjects',
      status: 'active',
      snapshot: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_healthcare_subjects',
      storeId: 'store_healthcare_subjects',
      learningSnapshotId: 'learning_snapshot_healthcare_subjects',
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_healthcare_mock_menu',
      rulesetId: 'marketing_ruleset_healthcare_subjects',
      fieldKey: 'representativeMenu',
      fieldValue: '커스텀 레터링 케이크, 딸기 생크림 케이크',
      aiValue: '커스텀 레터링 케이크, 딸기 생크림 케이크',
      userValue: null,
      finalValue: '커스텀 레터링 케이크, 딸기 생크림 케이크',
      source: 'mock_analyzer',
      locked: 0,
      evidenceItemIds: [],
      confidence: 0.5
    });

    const response = await fetch(`${baseUrl}/api/stores/store_healthcare_subjects/strategy-ruleset`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.storeFacts).toMatchObject({
      representativeTreatmentSubjects: '정형외과, 내과, 신경외과, 재활의학과'
    });
    expect(body.sourceMatrix.find((row: { fieldKey: string }) => row.fieldKey === 'representativeTreatmentSubjects')).toMatchObject({
      label: '대표 진료과목',
      currentValue: '정형외과, 내과, 신경외과, 재활의학과'
    });
    expect(body.storeFacts.representativeTreatmentSubjects).not.toContain('커스텀 레터링 케이크');
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

  it('returns source-scoped evidence with short collection item excerpts', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset/fields/positioning/evidence`);
    const body = await readJson(response);
    const weaknessResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/ruleset/fields/reviewWeakness/evidence`);
    const weaknessBody = await readJson(weaknessResponse);

    expect(response.status).toBe(200);
    expect(weaknessResponse.status).toBe(200);
    expect(body.evidenceSourceMode).toBe('blog');
    expect(weaknessBody.evidenceSourceMode).toBe('review');
    expect(body.field).toMatchObject({
      fieldKey: 'positioning'
    });
    expect(body.evidence.every((item: { channel: string; sourceType: string }) => item.channel === 'blog' && item.sourceType === 'post')).toBe(true);
    expect(body.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionItemId: 'collection_item_demo_blog',
          channel: 'blog',
          sourceType: 'post',
          title: '분당 레터링 케이크 후기',
          excerpt: expect.stringContaining('당일 제작')
        })
      ])
    );
    expect(body.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'review'
        })
      ])
    );
    expect(weaknessBody.evidence.every((item: { channel: string; sourceType: string }) => item.channel === 'place' && item.sourceType === 'review')).toBe(true);
    expect(weaknessBody.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionItemId: 'collection_item_demo_place_review',
          analysisSummary: expect.stringContaining('리뷰 약점')
        })
      ])
    );
    expect(weaknessBody.evidence[0].analysisSummary).not.toBe(body.evidence[0].analysisSummary);
    expect(body.evidence[0]).not.toHaveProperty('bodyText');
  });

  it('synthesizes field-specific evidence copy for legacy evidence without field metadata', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_legacy_evidence',
      name: '레거시 근거 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: 'bakery',
      address: '서울 중구',
      phone: null,
      description: null,
      metadata: {}
    });
    repos.collectionRuns.create({
      id: 'collection_run_legacy_evidence',
      storeId: 'store_legacy_evidence',
      status: 'completed',
      mode: 'mock',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_legacy_shared',
      runId: 'collection_run_legacy_evidence',
      storeId: 'store_legacy_evidence',
      channel: 'place',
      sourceType: 'review',
      status: 'collected',
      sourceUrl: null,
      title: '공통 리뷰 근거',
      bodyText: '상담은 친절하지만 주차 안내가 부족하다는 리뷰가 함께 존재합니다.',
      selectedForAnalysis: 1,
      selectionReason: 'shared legacy evidence',
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_legacy_blog',
      runId: 'collection_run_legacy_evidence',
      storeId: 'store_legacy_evidence',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: null,
      title: '블로그 포지셔닝 근거',
      bodyText: '서울 중구 예약 상담형 케이크 전문점으로 소개하며 상담 동선을 자세히 안내합니다.',
      selectedForAnalysis: 1,
      selectionReason: 'legacy blog evidence',
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.analysisRuns.create({
      id: 'analysis_run_legacy_evidence',
      storeId: 'store_legacy_evidence',
      collectionRunId: 'collection_run_legacy_evidence',
      status: 'completed',
      startedAt: '2026-06-10T00:00:01.000Z',
      completedAt: '2026-06-10T00:00:02.000Z',
      result: {},
      error: null
    });
    repos.analysisEvidence.create({
      id: 'analysis_evidence_legacy_shared',
      analysisRunId: 'analysis_run_legacy_evidence',
      collectionItemId: 'collection_item_legacy_shared',
      evidenceType: 'review',
      summary: '상담 친절도와 주차 안내 이슈가 함께 언급됩니다.',
      score: 0.81,
      metadata: {}
    });
    repos.analysisEvidence.create({
      id: 'analysis_evidence_legacy_blog',
      analysisRunId: 'analysis_run_legacy_evidence',
      collectionItemId: 'collection_item_legacy_blog',
      evidenceType: 'blog',
      summary: '예약 상담형 전문점 포지션이 블로그에 설명됩니다.',
      score: 0.83,
      metadata: {}
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_legacy_evidence',
      storeId: 'store_legacy_evidence',
      analysisRunId: 'analysis_run_legacy_evidence',
      status: 'active',
      snapshot: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_legacy_evidence',
      storeId: 'store_legacy_evidence',
      learningSnapshotId: 'learning_snapshot_legacy_evidence',
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    for (const [fieldKey, value, evidenceItemIds] of [
      ['storePositioning', '서울 중구 예약 상담형 케이크 전문점', ['collection_item_legacy_blog']],
      ['reviewWeakness', '주차 안내를 더 명확히 제공해야 함', ['collection_item_legacy_shared']]
    ] as [string, string, string[]][]) {
      repos.rulesetFields.create({
        id: `ruleset_field_legacy_${fieldKey}`,
        rulesetId: 'marketing_ruleset_legacy_evidence',
        fieldKey,
        fieldValue: value,
        aiValue: value,
        userValue: null,
        finalValue: value,
        source: 'analysis',
        locked: 0,
        evidenceItemIds,
        confidence: 0.8
      });
    }

    const positioningResponse = await fetch(`${baseUrl}/api/stores/store_legacy_evidence/strategy-ruleset/fields/storePositioning/evidence`);
    const weaknessResponse = await fetch(`${baseUrl}/api/stores/store_legacy_evidence/strategy-ruleset/fields/reviewWeakness/evidence`);
    const positioning = await readJson(positioningResponse);
    const weakness = await readJson(weaknessResponse);

    expect(positioningResponse.status).toBe(200);
    expect(weaknessResponse.status).toBe(200);
    expect(positioning.evidence[0].analysisSummary).toContain('포지셔닝 산출 근거');
    expect(weakness.evidence[0].analysisSummary).toContain('리뷰 약점 산출 근거');
    expect(positioning.evidence[0].analysisSummary).not.toBe(weakness.evidence[0].analysisSummary);
  });

  it('falls back to same-run source-scoped evidence when linked field evidence uses the wrong source', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_wrong_source_evidence',
      name: '소스 보정 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: 'clinic',
      address: '서울 종로구',
      phone: null,
      description: null,
      metadata: {}
    });
    repos.collectionRuns.create({
      id: 'collection_run_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      status: 'completed',
      mode: 'mock',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_wrong_source_profile',
      runId: 'collection_run_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      channel: 'place',
      sourceType: 'profile',
      status: 'collected',
      sourceUrl: null,
      title: '소스 보정 매장',
      bodyText: '플레이스 프로필 설명입니다.',
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.collectionItems.create({
      id: 'collection_item_wrong_source_blog',
      runId: 'collection_run_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: null,
      title: '프라이빗 피부관리 블로그',
      bodyText: '프라이빗한 상담과 맞춤형 피부관리를 소개하는 블로그 본문입니다.',
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: '2026-06-10T00:00:01.000Z',
      metadata: {}
    });
    repos.analysisRuns.create({
      id: 'analysis_run_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      collectionRunId: 'collection_run_wrong_source_evidence',
      status: 'completed',
      startedAt: '2026-06-10T00:00:01.000Z',
      completedAt: '2026-06-10T00:00:02.000Z',
      result: {},
      error: null
    });
    repos.analysisEvidence.create({
      id: 'analysis_evidence_wrong_source_profile',
      analysisRunId: 'analysis_run_wrong_source_evidence',
      collectionItemId: 'collection_item_wrong_source_profile',
      evidenceType: 'profile',
      summary: '프로필 기반 요약입니다.',
      score: 0.7,
      metadata: {}
    });
    repos.analysisEvidence.create({
      id: 'analysis_evidence_wrong_source_blog',
      analysisRunId: 'analysis_run_wrong_source_evidence',
      collectionItemId: 'collection_item_wrong_source_blog',
      evidenceType: 'blog',
      summary: '프라이빗 상담과 맞춤 피부관리 블로그 근거입니다.',
      score: 0.82,
      metadata: {}
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      analysisRunId: 'analysis_run_wrong_source_evidence',
      status: 'active',
      snapshot: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_wrong_source_evidence',
      storeId: 'store_wrong_source_evidence',
      learningSnapshotId: 'learning_snapshot_wrong_source_evidence',
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_wrong_source_positioning',
      rulesetId: 'marketing_ruleset_wrong_source_evidence',
      fieldKey: 'storePositioning',
      fieldValue: '프라이빗 맞춤 피부관리 클리닉',
      aiValue: '프라이빗 맞춤 피부관리 클리닉',
      userValue: null,
      finalValue: '프라이빗 맞춤 피부관리 클리닉',
      source: 'analysis',
      locked: 0,
      evidenceItemIds: ['collection_item_wrong_source_profile'],
      confidence: 0.8
    });

    const response = await fetch(`${baseUrl}/api/stores/store_wrong_source_evidence/strategy-ruleset/fields/storePositioning/evidence`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.evidenceSourceMode).toBe('blog');
    expect(body.evidence).toEqual([
      expect.objectContaining({
        collectionItemId: 'collection_item_wrong_source_blog',
        channel: 'blog',
        sourceType: 'post',
        excerpt: expect.stringContaining('프라이빗한 상담')
      })
    ]);
  });

  it('prefers source-scoped collection evidence that matches the field rationale text', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.stores.create({
      id: 'store_relevant_review_evidence',
      name: '관련 리뷰 매장',
      naverPlaceUrl: null,
      naverPlaceId: null,
      category: 'clinic',
      address: '서울 종로구',
      phone: null,
      description: null,
      metadata: {}
    });
    repos.collectionRuns.create({
      id: 'collection_run_relevant_review_evidence',
      storeId: 'store_relevant_review_evidence',
      status: 'completed',
      mode: 'mock',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {}
    });
    for (const [id, title, bodyText] of [
      ['collection_item_irrelevant_review', '방문자 리뷰 - sun****', '아프지 않은 시술 경험이 좋았고 기대됩니다.'],
      ['collection_item_relevant_wait_review', '방문자 리뷰 - wait****', '토요일에는 대기시간이 길어서 꼭 예약해야 한다는 방문 후기입니다.']
    ] as [string, string, string][]) {
      repos.collectionItems.create({
        id,
        runId: 'collection_run_relevant_review_evidence',
        storeId: 'store_relevant_review_evidence',
        channel: 'place',
        sourceType: 'review',
        status: 'collected',
        sourceUrl: null,
        title,
        bodyText,
        selectedForAnalysis: 1,
        selectionReason: null,
        selectedAt: '2026-06-10T00:00:01.000Z',
        metadata: {}
      });
    }
    repos.analysisRuns.create({
      id: 'analysis_run_relevant_review_evidence',
      storeId: 'store_relevant_review_evidence',
      collectionRunId: 'collection_run_relevant_review_evidence',
      status: 'completed',
      startedAt: '2026-06-10T00:00:01.000Z',
      completedAt: '2026-06-10T00:00:02.000Z',
      result: {},
      error: null
    });
    repos.analysisEvidence.create({
      id: 'analysis_evidence_irrelevant_review',
      analysisRunId: 'analysis_run_relevant_review_evidence',
      collectionItemId: 'collection_item_irrelevant_review',
      evidenceType: 'review',
      summary: '아프지 않은 시술 경험과 기대감에 대한 긍정적 후기입니다.',
      score: 0.8,
      metadata: {
        fieldEvidence: {
          reviewWeakness: {
            summary: '리뷰 약점 산출 근거: 대기 시간이 길어질 수 있음. 수집 근거: 아프지 않은 시술 경험과 기대감에 대한 긍정적 후기입니다.'
          }
        }
      }
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_relevant_review_evidence',
      storeId: 'store_relevant_review_evidence',
      analysisRunId: 'analysis_run_relevant_review_evidence',
      status: 'active',
      snapshot: {}
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_relevant_review_evidence',
      storeId: 'store_relevant_review_evidence',
      learningSnapshotId: 'learning_snapshot_relevant_review_evidence',
      status: 'draft',
      version: 1,
      ruleset: {}
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_relevant_review_weakness',
      rulesetId: 'marketing_ruleset_relevant_review_evidence',
      fieldKey: 'reviewWeakness',
      fieldValue: '대기 시간이 길어질 수 있음',
      aiValue: '대기 시간이 길어질 수 있음',
      userValue: null,
      finalValue: '대기 시간이 길어질 수 있음',
      source: 'analysis',
      locked: 0,
      evidenceItemIds: ['collection_item_irrelevant_review'],
      confidence: 0.8
    });

    const response = await fetch(`${baseUrl}/api/stores/store_relevant_review_evidence/strategy-ruleset/fields/reviewWeakness/evidence`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.evidenceSourceMode).toBe('review');
    expect(body.evidence[0]).toMatchObject({
      collectionItemId: 'collection_item_relevant_wait_review',
      channel: 'place',
      sourceType: 'review',
      excerpt: expect.stringContaining('대기시간')
    });
    expect(body.evidence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionItemId: 'collection_item_irrelevant_review'
        })
      ])
    );
  });
});
