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

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
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
    const parsedOutput: AnalyzerOutput = {
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
      rulesetFields: [
        {
          fieldKey: 'storePositioning',
          aiValue: '분당 레터링 케이크 예약 전문점',
          userValue: null,
          finalValue: '분당 레터링 케이크 예약 전문점',
          source: 'openai_analysis',
          locked: false,
          evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile'],
          confidence: 0.9
        },
        {
          fieldKey: 'seoKeywords',
          aiValue: '분당 케이크, 레터링 케이크, 정자동 케이크',
          userValue: null,
          finalValue: '분당 케이크, 레터링 케이크, 정자동 케이크',
          source: 'openai_analysis',
          locked: false,
          evidenceItemIds: ['collection_item_demo_blog'],
          confidence: 0.88
        }
      ]
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
    expect(JSON.stringify(parseCalls[0])).toContain('test-openai-model');
    expect(JSON.stringify(parseCalls[0])).toContain('collection_item_demo_blog');
    expect(JSON.stringify(parseCalls[0])).toContain('reviewWeakness');
    expect(JSON.stringify(parseCalls[0])).toContain('blogImageFormat');
    expect(JSON.stringify(parseCalls[0])).toContain('representativeMenu');
    expect(persistedRun?.status).toBe('completed');
    expect(persistedRun?.result).toEqual(
      expect.objectContaining({
        analyzerMode: 'openai',
        analyzerProvider: 'openAIAnalysisProvider'
      })
    );
    expect(snapshot.snapshot).toEqual(
      expect.objectContaining({
        mode: 'openai',
        provider: 'openAIAnalysisProvider',
        storePositioning: '분당 레터링 케이크 예약 전문점'
      })
    );
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      collectionItemId: 'collection_item_demo_blog',
      evidenceType: 'blog_post',
      metadata: {
        provider: 'openAIAnalysisProvider',
        mode: 'openai'
      }
    });
    expect(fields.find((field) => field.fieldKey === 'storePositioning')).toMatchObject({
      source: 'openai_analysis',
      evidenceItemIds: expect.arrayContaining(['collection_item_demo_place_profile'])
    });
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
            rulesetFields: [
              {
                fieldKey: 'storePositioning',
                aiValue: '잘못된 근거 테스트',
                userValue: null,
                finalValue: '잘못된 근거 테스트',
                source: 'openai_analysis',
                locked: false,
                evidenceItemIds: ['missing_collection_item'],
                confidence: 0.8
              }
            ]
          };
        }
      })
    ).rejects.toThrow('Analyzer output referenced unavailable collection items');

    const failedRun = repos.analysisRuns.findById(analysisRun.id);
    expect(failedRun?.status).toBe('failed');
    expect(repos.analysisEvidence.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
    expect(repos.learningSnapshots.listByAnalysisRunId(analysisRun.id)).toHaveLength(0);
  });
});
