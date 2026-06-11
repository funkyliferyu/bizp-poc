import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import type { AnalyzerOutput } from '../src/storeLearning/analysis/analyzer.js';
import { createMockAnalysisProvider } from '../src/storeLearning/analysis/analyzer.js';
import { createAnalysisRunRoutes } from '../src/storeLearning/routes/analysisRuns.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import { startAnalysisRun } from '../src/storeLearning/analysis/analysisExecutionService.js';
import { createOpenAIAnalysisProvider } from '../src/storeLearning/analysis/openAIAnalysisProvider.js';
import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../src/storeLearning/rulesets/rulesetSourceMatrix.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function analyzerRulesetField(
  fieldKey: string,
  overrides: Partial<AnalyzerOutput['rulesetFields'][number]> = {}
): AnalyzerOutput['rulesetFields'][number] {
  const value = `${fieldKey} 산출 값`;
  return {
    fieldKey,
    aiValue: value,
    userValue: null,
    finalValue: value,
    source: 'openai_analysis',
    locked: false,
    evidenceItemIds: ['collection_item_demo_blog'],
    confidence: 0.8,
    ...overrides
  };
}

function fullAnalyzerRulesetFields(
  overridesByFieldKey: Record<string, Partial<AnalyzerOutput['rulesetFields'][number]>> = {}
) {
  return REQUIRED_ANALYZER_RULESET_FIELD_KEYS.map((fieldKey) =>
    analyzerRulesetField(fieldKey, overridesByFieldKey[fieldKey])
  );
}

function openAIParsedRulesetFieldsByKey(
  overridesByFieldKey: Record<string, Partial<AnalyzerOutput['rulesetFields'][number]>> = {}
) {
  return Object.fromEntries(
    fullAnalyzerRulesetFields(overridesByFieldKey).map((field) => [
      field.fieldKey,
      {
        aiValue: field.aiValue,
        finalValue: field.finalValue,
        evidenceItemIds: field.evidenceItemIds,
        confidence: field.confidence
      }
    ])
  );
}

describe('analysis execution API', () => {
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
    app.use('/api/analysis-runs', createAnalysisRunRoutes({ connection, env: {} }));
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

  it('generates a learning snapshot, marketing ruleset, editable fields, and item-linked evidence', async () => {
    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_demo_store_learning',
        selectedItemIds: [
          'collection_item_demo_blog',
          'collection_item_demo_place_profile',
          'collection_item_demo_place_review'
        ]
      })
    });
    const created = await readJson(createResponse);

    const startResponse = await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, {
      method: 'POST'
    });
    const started = await readJson(startResponse);
    const repos = createStoreLearningRepositories(connection);
    const persistedRun = repos.analysisRuns.findById(created.analysisRunId);
    const snapshots = repos.learningSnapshots.listByAnalysisRunId(created.analysisRunId);
    const evidence = repos.analysisEvidence.listByAnalysisRunId(created.analysisRunId);
    const rulesets = repos.marketingRulesets.listByStoreId('store_demo_cake');
    const generatedRuleset = rulesets.find((ruleset) => ruleset.learningSnapshotId === snapshots[0]?.id);
    const fields = generatedRuleset ? repos.rulesetFields.listByRulesetId(generatedRuleset.id) : [];

    expect(startResponse.status).toBe(200);
    expect(started.analysisRun.status).toBe('completed');
    expect(persistedRun?.status).toBe('completed');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].snapshot).toMatchObject({
      storePositioning: expect.any(String),
      keyStrengths: expect.any(Array),
      targetCustomers: expect.any(Array),
      toneAndManner: expect.any(String),
      blogWritingStyle: expect.any(String),
      seoKeywords: expect.any(Array),
      ctaStyle: expect.any(String),
      imageDirection: expect.any(String),
      negativeExpressions: expect.any(Array)
    });
    expect(generatedRuleset).toBeTruthy();
    expect(generatedRuleset?.status).toBe('draft');
    expect(evidence.length).toBeGreaterThanOrEqual(3);
    expect(evidence.map((item) => item.collectionItemId)).toEqual(
      expect.arrayContaining([
        'collection_item_demo_blog',
        'collection_item_demo_place_profile',
        'collection_item_demo_place_review'
      ])
    );
    expect(evidence.find((item) => item.collectionItemId === 'collection_item_demo_place_review')?.metadata).toMatchObject({
      fieldEvidence: {
        reviewWeakness: {
          summary: expect.stringContaining('리뷰 약점')
        },
        storePositioning: {
          summary: expect.stringContaining('포지셔닝')
        }
      }
    });
    expect(fields.map((field) => field.fieldKey)).toEqual(
      expect.arrayContaining([
        'storePositioning',
        'keyStrengths',
        'representativeMenu',
        'targetCustomers',
        'reviewStrength',
        'reviewWeakness',
        'catchphrase',
        'humorLevel',
        'trendSensitivity',
        'instagramPurpose',
        'instagramWritingStyle',
        'instagramPreferredLength',
        'instagramHashtags',
        'instagramEmojiPolicy',
        'blogPurpose',
        'toneAndManner',
        'blogWritingStyle',
        'blogPreferredLength',
        'blogEmojiPolicy',
        'seoKeywords',
        'ctaStyle',
        'primaryColors',
        'accentColors',
        'imageDirection',
        'imageStyle',
        'imageAvoidStyle',
        'instagramImageFormat',
        'instagramImageStyle',
        'instagramOverlayPolicy',
        'blogImageFormat',
        'blogImageStyle',
        'blogOverlayPolicy',
        'negativeExpressions'
      ])
    );
    expect(fields.find((field) => field.fieldKey === 'storePositioning')).toMatchObject({
      aiValue: expect.any(String),
      userValue: null,
      finalValue: expect.any(String),
      source: 'mock_analyzer',
      locked: 0,
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_profile'])
    });
    expect(fields.find((field) => field.fieldKey === 'reviewWeakness')).toMatchObject({
      aiValue: expect.stringContaining('주차'),
      source: 'mock_analyzer',
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_review'])
    });
  });

  it('returns the latest completed analysis artifacts for a store', async () => {
    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_demo_store_learning',
        selectedItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_place_review']
      })
    });
    const created = await readJson(createResponse);
    await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, { method: 'POST' });

    const latestResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/latest-analysis`);
    const latest = await readJson(latestResponse);

    expect(latestResponse.status).toBe(200);
    expect(latest.analysisRun.id).toBe(created.analysisRunId);
    expect(latest.analysisRun.status).toBe('completed');
    expect(latest.learningSnapshot.status).toBe('active');
    expect(latest.marketingRuleset.status).toBe('draft');
    expect(latest.rulesetFields.length).toBeGreaterThanOrEqual(30);
    expect(latest.analysisEvidence.length).toBeGreaterThanOrEqual(2);
  });

  it('persists user-visible analysis progress while the analyzer is running', async () => {
    const repos = createStoreLearningRepositories(connection);
    const analysisRun = repos.analysisRuns.create({
      id: 'analysis_run_progress_test',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      result: {
        selectedItemIds: [
          'collection_item_demo_blog',
          'collection_item_demo_place_profile',
          'collection_item_demo_place_review'
        ]
      },
      error: null
    });
    const mockProvider = createMockAnalysisProvider();
    let progressDuringAnalyze: Record<string, unknown> | null = null;

    const artifacts = await startAnalysisRun(repos, analysisRun.id, {
      name: 'progressAwareProvider',
      mode: 'mock',
      async analyze(input) {
        const runningRun = repos.analysisRuns.findById(analysisRun.id);
        progressDuringAnalyze = (runningRun?.result as Record<string, unknown>)?.analysisProgress as Record<string, unknown>;
        return mockProvider.analyze(input);
      }
    });
    const persistedRun = repos.analysisRuns.findById(analysisRun.id);
    const finalProgress = (persistedRun?.result as Record<string, unknown>)?.analysisProgress as Record<string, unknown>;
    const timeline = finalProgress?.timeline as Array<Record<string, unknown>>;

    expect(artifacts?.analysisRun.status).toBe('completed');
    expect(progressDuringAnalyze).toEqual(
      expect.objectContaining({
        step: 'analyzing',
        label: 'AI 분석',
        state: 'running'
      })
    );
    expect(finalProgress).toEqual(
      expect.objectContaining({
        step: 'completed',
        label: '분석 완료',
        state: 'done'
      })
    );
    expect(timeline.map((entry) => entry.step)).toEqual(
      expect.arrayContaining(['preparing', 'analyzing', 'validating', 'snapshot', 'ruleset', 'completed'])
    );
  });

  it('reuses latest learning artifacts when a collection run has no meaningful changes', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.collectionRuns.upsert({
      id: 'collection_run_no_meaningful_changes',
      storeId: 'store_demo_cake',
      status: 'completed',
      mode: 'mock',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {
        collectionDelta: {
          hasMeaningfulChanges: false,
          counts: { new: 0, duplicate: 2, unchanged: 1, changed: 0 }
        }
      },
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:01.000Z'
    });

    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_no_meaningful_changes',
        selectedItemIds: []
      })
    });
    const created = await readJson(createResponse);

    expect(createResponse.status).toBe(200);
    expect(created.analysisRun.status).toBe('completed');
    expect(created.analysisRun.result).toEqual(
      expect.objectContaining({
        skippedReason: 'no_meaningful_collection_changes',
        reusedAnalysisRunId: 'analysis_run_demo_store_learning',
        learningSnapshotId: 'learning_snapshot_demo_store_learning',
        marketingRulesetId: 'marketing_ruleset_demo_v1'
      })
    );

    const startResponse = await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, {
      method: 'POST'
    });
    const started = await readJson(startResponse);

    expect(startResponse.status).toBe(200);
    expect(started.analysisRun.id).toBe(created.analysisRunId);
    expect(started.analysisRun.status).toBe('completed');
    expect(started.learningSnapshot.id).toBe('learning_snapshot_demo_store_learning');
    expect(started.marketingRuleset.id).toBe('marketing_ruleset_demo_v1');
    expect(started.rulesetFields.length).toBeGreaterThan(0);
  });

  it('reuses latest learning artifacts when only Place profile facts changed', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.analysisRuns.create({
      id: 'analysis_run_latest_complete_ruleset',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'completed',
      startedAt: '2026-06-11T00:00:02.000Z',
      completedAt: '2026-06-11T00:00:03.000Z',
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z',
      result: {},
      error: null
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_latest_complete_ruleset',
      storeId: 'store_demo_cake',
      analysisRunId: 'analysis_run_latest_complete_ruleset',
      status: 'active',
      snapshot: {},
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z'
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_latest_complete_v99',
      storeId: 'store_demo_cake',
      learningSnapshotId: 'learning_snapshot_latest_complete_ruleset',
      status: 'draft',
      version: 99,
      ruleset: {},
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z'
    });
    for (const field of fullAnalyzerRulesetFields()) {
      repos.rulesetFields.create({
        id: `ruleset_field_latest_complete_${field.fieldKey}`,
        rulesetId: 'marketing_ruleset_latest_complete_v99',
        fieldKey: field.fieldKey,
        fieldValue: field.finalValue,
        aiValue: field.aiValue,
        userValue: field.userValue,
        finalValue: field.finalValue,
        source: field.source,
        locked: field.locked ? 1 : 0,
        evidenceItemIds: field.evidenceItemIds,
        confidence: field.confidence,
        createdAt: '2026-06-11T00:00:02.000Z',
        updatedAt: '2026-06-11T00:00:03.000Z'
      });
    }
    repos.collectionRuns.upsert({
      id: 'collection_run_profile_fact_change_only',
      storeId: 'store_demo_cake',
      status: 'completed',
      mode: 'real',
      startedAt: '2026-06-10T00:00:00.000Z',
      completedAt: '2026-06-10T00:00:01.000Z',
      summary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 0, duplicate: 50, unchanged: 0, changed: 1 },
          byChannel: {
            place: { new: 0, duplicate: 50, unchanged: 0, changed: 1 }
          }
        },
        collectedCounts: { blogPosts: 0, placeProfiles: 1, placeReviews: 0 }
      }
    });
    repos.collectionItems.upsert({
      id: 'collection_item_profile_fact_change_only',
      runId: 'collection_run_profile_fact_change_only',
      storeId: 'store_demo_cake',
      channel: 'place',
      sourceType: 'profile',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/place/1020864025/home',
      title: '분당 케이크하우스',
      bodyText: null,
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        collectionDelta: 'changed',
        profileFingerprint: 'profile-fingerprint-after-hours-change'
      }
    });

    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_profile_fact_change_only',
        selectedItemIds: ['collection_item_profile_fact_change_only']
      })
    });
    const created = await readJson(createResponse);

    expect(createResponse.status).toBe(200);
    expect(created.analysisRun.status).toBe('completed');
    expect(created.analysisRun.result).toEqual(
      expect.objectContaining({
        skippedReason: 'place_profile_fact_change_only',
        reusedAnalysisRunId: 'analysis_run_latest_complete_ruleset',
        learningSnapshotId: 'learning_snapshot_latest_complete_ruleset',
        marketingRulesetId: 'marketing_ruleset_latest_complete_v99',
        pendingRulesetBackfill: false,
        analysisDecision: expect.objectContaining({
          action: 'reuse_latest_learning',
          reason: 'place_profile_fact_change_only'
        })
      })
    );
    expect(created.analysisRun.result.selectedItemIds).toEqual(['collection_item_profile_fact_change_only']);

    const startResponse = await fetch(`${baseUrl}/api/analysis-runs/${created.analysisRunId}/start`, {
      method: 'POST'
    });
    const started = await readJson(startResponse);

    expect(startResponse.status).toBe(200);
    expect(started.analysisRun.id).toBe(created.analysisRunId);
    expect(started.analysisRun.status).toBe('completed');
    expect(started.learningSnapshot.id).toBe('learning_snapshot_latest_complete_ruleset');
    expect(started.marketingRuleset.id).toBe('marketing_ruleset_latest_complete_v99');
  });

  it('backfills missing required ruleset fields before reusing profile-only changes', async () => {
    const repos = createStoreLearningRepositories(connection);
    repos.collectionRuns.upsert({
      id: 'collection_run_profile_fact_change_incomplete_ruleset',
      storeId: 'store_demo_cake',
      status: 'completed',
      mode: 'real',
      startedAt: '2026-06-11T00:00:00.000Z',
      completedAt: '2026-06-11T00:00:01.000Z',
      summary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 0, duplicate: 50, unchanged: 0, changed: 1 }
        },
        collectedCounts: { blogPosts: 0, placeProfiles: 1, placeReviews: 0 }
      }
    });
    repos.collectionItems.upsert({
      id: 'collection_item_profile_fact_change_incomplete_ruleset',
      runId: 'collection_run_profile_fact_change_incomplete_ruleset',
      storeId: 'store_demo_cake',
      channel: 'place',
      sourceType: 'profile',
      status: 'collected',
      sourceUrl: 'https://m.place.naver.com/place/1020864025/home',
      title: '분당 케이크하우스',
      bodyText: null,
      selectedForAnalysis: 1,
      selectionReason: null,
      selectedAt: null,
      metadata: {
        collectionDelta: 'changed',
        profileFingerprint: 'profile-fingerprint-after-hours-change'
      }
    });
    repos.analysisRuns.create({
      id: 'analysis_run_latest_incomplete_ruleset',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'completed',
      startedAt: '2026-06-11T00:00:02.000Z',
      completedAt: '2026-06-11T00:00:03.000Z',
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z',
      result: {},
      error: null
    });
    repos.learningSnapshots.create({
      id: 'learning_snapshot_latest_incomplete_ruleset',
      storeId: 'store_demo_cake',
      analysisRunId: 'analysis_run_latest_incomplete_ruleset',
      status: 'active',
      snapshot: {},
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z'
    });
    repos.marketingRulesets.create({
      id: 'marketing_ruleset_latest_incomplete_v99',
      storeId: 'store_demo_cake',
      learningSnapshotId: 'learning_snapshot_latest_incomplete_ruleset',
      status: 'draft',
      version: 99,
      ruleset: {},
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z'
    });
    repos.rulesetFields.create({
      id: 'ruleset_field_latest_incomplete_storePositioning',
      rulesetId: 'marketing_ruleset_latest_incomplete_v99',
      fieldKey: 'storePositioning',
      fieldValue: '분당 케이크하우스 포지셔닝',
      aiValue: '분당 케이크하우스 포지셔닝',
      userValue: null,
      finalValue: '분당 케이크하우스 포지셔닝',
      source: 'openai_analysis',
      locked: 0,
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.8,
      createdAt: '2026-06-11T00:00:02.000Z',
      updatedAt: '2026-06-11T00:00:03.000Z'
    });

    const createResponse = await fetch(`${baseUrl}/api/analysis-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store_demo_cake',
        collectionRunId: 'collection_run_profile_fact_change_incomplete_ruleset',
        selectedItemIds: ['collection_item_profile_fact_change_incomplete_ruleset']
      })
    });
    const created = await readJson(createResponse);

    expect(createResponse.status).toBe(200);
    expect(created.analysisRun.status).toBe('completed');
    expect(created.analysisRun.result).toEqual(
      expect.objectContaining({
        skippedReason: 'place_profile_fact_change_only',
        pendingRulesetBackfill: false,
        rulesetBackfillApplied: true,
        rulesetBackfillMissingFieldKeys: expect.arrayContaining(['reviewWeakness']),
        reusedAnalysisRunId: 'analysis_run_latest_incomplete_ruleset',
        learningSnapshotId: 'learning_snapshot_latest_incomplete_ruleset',
        marketingRulesetId: 'marketing_ruleset_latest_incomplete_v99',
        analysisDecision: expect.objectContaining({
          action: 'backfill_latest_ruleset',
          reason: 'latest_ruleset_contract_incomplete',
          missingRulesetFieldKeys: expect.arrayContaining(['reviewWeakness'])
        })
      })
    );
    const backfilledFields = repos.rulesetFields.listByRulesetId('marketing_ruleset_latest_incomplete_v99');
    const backfilledFieldKeys = backfilledFields.map((field) => field.fieldKey);
    expect(backfilledFieldKeys).toEqual(expect.arrayContaining(REQUIRED_ANALYZER_RULESET_FIELD_KEYS));
    expect(backfilledFields.find((field) => field.fieldKey === 'reviewWeakness')).toMatchObject({
      source: 'ruleset_contract_backfill',
      evidenceItemIds: ['collection_item_profile_fact_change_incomplete_ruleset'],
      confidence: 0.35
    });
  });

  it('persists OpenAI analyzer output with validated evidence links', async () => {
    const repos = createStoreLearningRepositories(connection);
    const analysisRun = repos.analysisRuns.create({
      id: 'analysis_run_openai_test',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      result: {
        selectedItemIds: [
          'collection_item_demo_blog',
          'collection_item_demo_place_profile',
          'collection_item_demo_place_review'
        ]
      },
      error: null
    });
    repos.stores.update('store_demo_cake', {
      metadata: {
        rawRenderedHtml: '<html>'.repeat(1000),
        storeMetadata: {
          parking: '건물 뒤편 2대 주차 가능',
          businessHours: '화-일 11:00-20:00'
        }
      }
    });
    repos.collectionItems.update('collection_item_demo_blog', {
      bodyText: 'OpenAI 분석 입력 예산 테스트용 블로그 본문입니다. '.repeat(600),
      metadata: {
        publishedAt: '2026-06-01',
        blogId: 'blogger_test',
        logNo: 'log_test',
        tags: ['분당 케이크', '레터링 케이크'],
        imageUrls: Array.from({ length: 100 }, (_, index) => `https://cdn.example.com/${index}.jpg`),
        rawProviderPayload: {
          duplicatedBody: 'OpenAI 분석 입력 예산 테스트용 블로그 본문입니다. '.repeat(600)
        }
      }
    });
    const parsedOutput = {
      storePositioning: '분당 레터링 케이크 예약 전문점',
      keyStrengths: ['상담형 주문 제작', '정자동 픽업 동선', '기념일 케이크 후기'],
      targetCustomers: ['기념일 케이크 고객', '레터링 케이크 예약 고객'],
      toneAndManner: '친절하고 구체적인 예약 안내형',
      blogWritingStyle: '후기 근거를 먼저 제시하고 예약 방법을 자연스럽게 연결',
      seoKeywords: ['분당 케이크', '레터링 케이크', '정자동 케이크'],
      ctaStyle: '예약 가능 여부와 픽업 시간을 확인하도록 유도',
      imageDirection: '케이크 디테일과 포장 상태를 함께 보여주는 이미지 구성',
      negativeExpressions: ['전국 최고', '무조건 가능'],
      evidence: [
        {
          collectionItemId: 'collection_item_demo_blog',
          evidenceType: 'blog_post',
          summary: '예약 후기 검색 snippet이 반복적으로 확인됨',
          score: 0.91
        },
        {
          collectionItemId: 'collection_item_demo_place_profile',
          evidenceType: 'store_profile',
          summary: '플레이스 기본정보에서 정자동 케이크 전문점 정보 확인',
          score: 0.89
        }
      ],
      rulesetFieldsByKey: openAIParsedRulesetFieldsByKey({
        storePositioning: {
          aiValue: '분당 레터링 케이크 예약 전문점',
          finalValue: '분당 레터링 케이크 예약 전문점',
          evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile'],
          confidence: 0.9
        },
        seoKeywords: {
          aiValue: '분당 케이크, 레터링 케이크, 정자동 케이크',
          finalValue: '분당 케이크, 레터링 케이크, 정자동 케이크',
          evidenceItemIds: ['collection_item_demo_blog'],
          confidence: 0.88
        }
      })
    };
    const parseCalls: unknown[] = [];
    const provider = createOpenAIAnalysisProvider({
      model: 'test-openai-model',
      client: {
        beta: {
          chat: {
            completions: {
              parse: async (params: unknown) => {
                parseCalls.push(params);
                return { choices: [{ message: { parsed: parsedOutput } }] };
              }
            }
          }
        }
      }
    });

    const artifacts = await startAnalysisRun(repos, analysisRun.id, provider);
    const persistedRun = repos.analysisRuns.findById(analysisRun.id);
    const snapshot = repos.learningSnapshots.listByAnalysisRunId(analysisRun.id)[0];
    const evidence = repos.analysisEvidence.listByAnalysisRunId(analysisRun.id);
    const ruleset = artifacts?.marketingRuleset;
    const fields = ruleset ? repos.rulesetFields.listByRulesetId(ruleset.id) : [];

    expect(parseCalls).toHaveLength(1);
    const parsePayload = JSON.stringify(parseCalls[0]);
    expect(parsePayload).toContain('test-openai-model');
    expect(parsePayload).toContain('collection_item_demo_blog');
    expect(parsePayload).toContain('rulesetFieldsByKey');
    expect(parsePayload).toContain('reviewWeakness');
    expect(parsePayload).toContain('blogImageFormat');
    expect(parsePayload).toContain('representativeMenu');
    expect(parsePayload).toContain('blogger_test');
    expect(parsePayload).toContain('건물 뒤편 2대 주차 가능');
    expect(parsePayload).not.toContain('rawProviderPayload');
    expect(parsePayload).not.toContain('https://cdn.example.com');

    const parseCall = asRecord(parseCalls[0]);
    const responseFormat = asRecord(parseCall.response_format);
    const jsonSchema = asRecord(responseFormat.json_schema);
    const schema = asRecord(jsonSchema.schema);
    const schemaProperties = asRecord(schema.properties);
    const schemaRequired = asStringArray(schema.required);
    const rulesetFieldsByKeySchema = asRecord(schemaProperties.rulesetFieldsByKey);
    const rulesetFieldProperties = asRecord(rulesetFieldsByKeySchema.properties);
    const rulesetFieldRequired = asStringArray(rulesetFieldsByKeySchema.required);
    const evidenceSchema = asRecord(schemaProperties.evidence);
    const evidenceItemSchema = asRecord(evidenceSchema.items);
    const evidenceProperties = asRecord(evidenceItemSchema.properties);
    const evidenceItemIdSchema = asRecord(evidenceProperties.collectionItemId);
    const messages = Array.isArray(parseCall.messages) ? parseCall.messages : [];
    const userMessage = messages.find((message) => asRecord(message).role === 'user');
    const promptInput = JSON.parse(String(asRecord(userMessage).content));

    expect(responseFormat.type).toBe('json_schema');
    expect(jsonSchema).toEqual(
      expect.objectContaining({
        name: 'store_learning_analysis',
        strict: true
      })
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schemaRequired).toContain('rulesetFieldsByKey');
    expect(schemaRequired).not.toContain('rulesetFields');
    expect(schemaProperties.rulesetFields).toBeUndefined();
    expect(rulesetFieldsByKeySchema.additionalProperties).toBe(false);
    expect(rulesetFieldRequired).toHaveLength(REQUIRED_ANALYZER_RULESET_FIELD_KEYS.length);
    expect(rulesetFieldRequired).toEqual(expect.arrayContaining(REQUIRED_ANALYZER_RULESET_FIELD_KEYS));
    expect(Object.keys(rulesetFieldProperties)).toEqual(expect.arrayContaining(REQUIRED_ANALYZER_RULESET_FIELD_KEYS));
    expect(evidenceItemIdSchema.enum).toEqual(
      expect.arrayContaining([
        'collection_item_demo_blog',
        'collection_item_demo_place_profile',
        'collection_item_demo_place_review'
      ])
    );
    expect(promptInput.promptItemIds).toEqual([
      'collection_item_demo_place_profile',
      'collection_item_demo_place_review',
      'collection_item_demo_blog'
    ]);
    expect(promptInput.requiredRulesetFields).toHaveLength(REQUIRED_ANALYZER_RULESET_FIELD_KEYS.length);

    expect(persistedRun?.status).toBe('completed');
    expect(persistedRun?.result).toEqual(
      expect.objectContaining({
        analyzerMode: 'openai',
        analyzerProvider: 'openAIAnalysisProvider',
        analyzerModel: 'test-openai-model',
        selectedItemCount: 3,
        promptItemCount: 3,
        omittedItemCount: 0,
        blogItemLimit: 3,
        selectedBlogItemCount: 1,
        promptBlogItemCount: 1,
        omittedBlogItemCount: 0,
        reviewItemLimit: 10,
        selectedReviewItemCount: 1,
        promptReviewItemCount: 1,
        omittedReviewItemCount: 0,
        promptCharacterCount: expect.any(Number),
        promptBudgetReason: 'body_truncated_to_budget'
      })
    );
    expect(snapshot.snapshot).toEqual(
      expect.objectContaining({
        mode: 'openai',
        provider: 'openAIAnalysisProvider',
        model: 'test-openai-model',
        storePositioning: '분당 레터링 케이크 예약 전문점'
      })
    );
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      collectionItemId: 'collection_item_demo_blog',
      evidenceType: 'blog_post',
      metadata: {
        provider: 'openAIAnalysisProvider',
        mode: 'openai',
        model: 'test-openai-model'
      }
    });
    expect(fields.find((field) => field.fieldKey === 'storePositioning')).toMatchObject({
      source: 'openai_analysis',
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_profile'])
    });
  });

  it('returns current failed run diagnostics from the start API when analysis fails', async () => {
    const diagnosticApp = express();
    diagnosticApp.use(express.json());
    diagnosticApp.use(
      '/api/analysis-runs',
      createAnalysisRunRoutes({
        connection,
        env: {},
        provider: {
          name: 'openAIAnalysisProvider',
          mode: 'openai',
          model: 'test-openai-model',
          async analyze() {
            return {
              storePositioning: '분당 레터링 케이크 예약 전문점',
              keyStrengths: ['상담형 주문 제작'],
              targetCustomers: ['기념일 케이크 고객'],
              toneAndManner: '친절한 안내형',
              blogWritingStyle: '후기 근거 중심',
              seoKeywords: ['분당 케이크'],
              ctaStyle: '예약 문의 유도',
              imageDirection: '케이크 디테일 이미지',
              negativeExpressions: ['전국 최고'],
              evidence: [
                {
                  collectionItemId: 'collection_item_demo_blog',
                  evidenceType: 'blog_post',
                  summary: '블로그 근거',
                  score: 0.8
                }
              ],
              rulesetFields: fullAnalyzerRulesetFields().filter((field) => field.fieldKey !== 'reviewWeakness')
            };
          }
        }
      })
    );
    diagnosticApp.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    const diagnosticServer = diagnosticApp.listen(0);
    const diagnosticAddress = diagnosticServer.address() as AddressInfo;
    const diagnosticBaseUrl = `http://127.0.0.1:${diagnosticAddress.port}`;

    try {
      const createResponse = await fetch(`${diagnosticBaseUrl}/api/analysis-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store_demo_cake',
          collectionRunId: 'collection_run_demo_store_learning',
          selectedItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile']
        })
      });
      const created = await readJson(createResponse);

      const startResponse = await fetch(`${diagnosticBaseUrl}/api/analysis-runs/${created.analysisRunId}/start`, {
        method: 'POST'
      });
      const failed = await readJson(startResponse);

      expect(startResponse.status).toBe(400);
      expect(failed.error).toBe('AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다. 다시 실행해주세요.');
      expect(failed.analysisRunId).toBe(created.analysisRunId);
      expect(failed.analysisRun).toEqual(
        expect.objectContaining({
          id: created.analysisRunId,
          status: 'failed',
          error: expect.objectContaining({
            errorType: 'analysis_contract_invalid',
            contractIssue: 'missing_required_ruleset_fields'
          })
        })
      );
      expect(failed.analysisFailure).toEqual(
        expect.objectContaining({
          analysisRunId: created.analysisRunId,
          status: 'failed',
          isCurrentRun: true,
          errorType: 'analysis_contract_invalid',
          contractIssue: 'missing_required_ruleset_fields',
          analyzerProvider: 'openAIAnalysisProvider',
          analyzerMode: 'openai',
          analyzerModel: 'test-openai-model',
          message: 'AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다. 다시 실행해주세요.',
          failedAt: expect.any(String)
        })
      );
      expect(JSON.stringify(failed)).not.toContain('reviewWeakness');
      expect(JSON.stringify(failed)).not.toContain('Analyzer output');
    } finally {
      await new Promise<void>((resolve) => diagnosticServer.close(() => resolve()));
    }
  });

  it.each([
    {
      name: 'missing required field',
      rulesetFields: fullAnalyzerRulesetFields().filter((field) => field.fieldKey !== 'reviewWeakness'),
      expectedIssue: 'missing_required_ruleset_fields',
      rawLeak: 'reviewWeakness'
    },
    {
      name: 'duplicate required field',
      rulesetFields: [...fullAnalyzerRulesetFields(), analyzerRulesetField('seoKeywords')],
      expectedIssue: 'duplicate_ruleset_fields',
      rawLeak: 'seoKeywords'
    },
    {
      name: 'unknown field',
      rulesetFields: [...fullAnalyzerRulesetFields(), analyzerRulesetField('unknownField')],
      expectedIssue: 'unknown_ruleset_fields',
      rawLeak: 'unknownField'
    },
    {
      name: 'invalid OpenAI source',
      rulesetFields: fullAnalyzerRulesetFields({ ctaStyle: { source: 'mock_analyzer' } }),
      expectedIssue: 'invalid_openai_ruleset_source',
      rawLeak: 'ctaStyle'
    }
  ])('fails analysis with a sanitized product error when OpenAI returns $name', async ({ rulesetFields, expectedIssue, rawLeak }) => {
    const repos = createStoreLearningRepositories(connection);
    const analysisRun = repos.analysisRuns.create({
      id: `analysis_run_invalid_ruleset_${expectedIssue}`,
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      result: {
        selectedItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile']
      },
      error: null
    });

    await expect(
      startAnalysisRun(repos, analysisRun.id, {
        name: 'openAIAnalysisProvider',
        mode: 'openai',
        async analyze() {
          return {
            storePositioning: '분당 레터링 케이크 예약 전문점',
            keyStrengths: ['상담형 주문 제작'],
            targetCustomers: ['기념일 케이크 고객'],
            toneAndManner: '친절한 안내형',
            blogWritingStyle: '후기 근거 중심',
            seoKeywords: ['분당 케이크'],
            ctaStyle: '예약 문의 유도',
            imageDirection: '케이크 디테일 이미지',
            negativeExpressions: ['전국 최고'],
            evidence: [
              {
                collectionItemId: 'collection_item_demo_blog',
                evidenceType: 'blog_post',
                summary: '블로그 근거',
                score: 0.8
              }
            ],
            rulesetFields
          };
        }
      })
    ).rejects.toThrow('AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다.');

    const failedRun = repos.analysisRuns.findById(analysisRun.id);
    expect(failedRun?.status).toBe('failed');
    expect(failedRun?.error).toEqual(
      expect.objectContaining({
        errorType: 'analysis_contract_invalid',
        message: 'AI 분석 결과 형식이 맞지 않아 저장하지 못했습니다. 다시 실행해주세요.',
        contractIssue: expectedIssue,
        analyzerProvider: 'openAIAnalysisProvider',
        analyzerMode: 'openai'
      })
    );
    expect(JSON.stringify(failedRun?.error)).not.toContain(rawLeak);
    expect(JSON.stringify(failedRun?.error)).not.toContain('Analyzer output');
    expect(repos.analysisEvidence.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
    expect(repos.learningSnapshots.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
    expect(repos.marketingRulesets.listByStoreId('store_demo_cake')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ learningSnapshotId: `learning_snapshot_${analysisRun.id}` })])
    );
  });

  it('fails analysis before saving artifacts when analyzer evidence references unavailable items', async () => {
    const repos = createStoreLearningRepositories(connection);
    const analysisRun = repos.analysisRuns.create({
      id: 'analysis_run_invalid_evidence_test',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      result: {
        selectedItemIds: ['collection_item_demo_blog']
      },
      error: null
    });

    await expect(
      startAnalysisRun(repos, analysisRun.id, {
        name: 'badEvidenceProvider',
        mode: 'openai',
        async analyze() {
          return {
            storePositioning: '잘못된 근거 테스트',
            keyStrengths: ['근거 검증'],
            targetCustomers: ['테스트 고객'],
            toneAndManner: '차분한 안내형',
            blogWritingStyle: '근거 중심',
            seoKeywords: ['테스트'],
            ctaStyle: '문의 유도',
            imageDirection: '대표 이미지',
            negativeExpressions: ['과장 금지'],
            evidence: [
              {
                collectionItemId: 'missing_collection_item',
                evidenceType: 'blog_post',
                summary: '존재하지 않는 item',
                score: 0.8
              }
            ],
            rulesetFields: fullAnalyzerRulesetFields({
              storePositioning: {
                aiValue: '잘못된 근거 테스트',
                finalValue: '잘못된 근거 테스트',
                evidenceItemIds: ['missing_collection_item'],
                confidence: 0.8
              }
            })
          };
        }
      })
    ).rejects.toThrow('Analyzer output referenced unavailable collection items');

    const failedRun = repos.analysisRuns.findById(analysisRun.id);
    expect(failedRun?.status).toBe('failed');
    expect(repos.analysisEvidence.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
    expect(repos.learningSnapshots.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
  });

  it('stores a sanitized context overflow error when OpenAI rejects an oversized analysis prompt', async () => {
    const repos = createStoreLearningRepositories(connection);
    const analysisRun = repos.analysisRuns.create({
      id: 'analysis_run_context_overflow_test',
      storeId: 'store_demo_cake',
      collectionRunId: 'collection_run_demo_store_learning',
      status: 'queued',
      startedAt: null,
      completedAt: null,
      result: {
        selectedItemIds: [
          'collection_item_demo_blog',
          'collection_item_demo_place_profile',
          'collection_item_demo_place_review'
        ]
      },
      error: null
    });

    await expect(
      startAnalysisRun(repos, analysisRun.id, {
        name: 'openAIAnalysisProvider',
        mode: 'openai',
        model: 'test-openai-model',
        getLastRunMetadata: () => ({
          selectedItemCount: 40,
          promptItemCount: 31,
          omittedItemCount: 9,
          promptCharacterCount: 61000,
          promptCharacterBudget: 60000,
          promptBudgetReason: 'prompt_character_budget_exceeded'
        }),
        async analyze() {
          throw new Error(
            "This model's maximum context length is 128000 tokens. However, your messages resulted in 179181 tokens."
          );
        }
      })
    ).rejects.toThrow('선택한 콘텐츠가 많아 분석 입력 한도를 초과했습니다.');

    const failedRun = repos.analysisRuns.findById(analysisRun.id);
    expect(failedRun?.status).toBe('failed');
    expect(failedRun?.error).toEqual(
      expect.objectContaining({
        errorType: 'analysis_context_too_large',
        message: '선택한 콘텐츠가 많아 분석 입력 한도를 초과했습니다. 일부 콘텐츠를 제외하거나 다시 수집 후 실행해주세요.',
        analyzerProvider: 'openAIAnalysisProvider',
        analyzerMode: 'openai',
        analyzerModel: 'test-openai-model',
        selectedItemCount: 40,
        promptItemCount: 31,
        omittedItemCount: 9,
        promptBudgetReason: 'prompt_character_budget_exceeded'
      })
    );
    expect(JSON.stringify(failedRun?.error)).not.toContain('179181');
    expect(repos.analysisEvidence.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
  });
});
