import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';

describe('Store Learning repositories', () => {
  it('adds collection item selection columns when migrating an existing SQLite table', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      connection.exec(`
        CREATE TABLE collection_items (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          store_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_url TEXT,
          title TEXT,
          body_text TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      migrateDatabase(connection);

      const columns = connection
        .prepare('PRAGMA table_info(collection_items)')
        .all()
        .map((row) => (row as { name: string }).name);
      expect(columns).toEqual(expect.arrayContaining(['selected_for_analysis', 'selection_reason', 'selected_at']));
    } finally {
      connection.close();
    }
  });

  it('creates, reads, and updates the Store Learning PoC data graph in SQLite', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);
      const repos = createStoreLearningRepositories(connection);

      const store = repos.stores.create({
        id: 'store_demo_cake',
        name: '분당 케이크하우스',
        naverPlaceUrl: 'https://naver.me/demo-cake',
        naverPlaceId: 'place_demo_cake',
        category: 'bakery',
        address: '경기도 성남시 분당구 정자동',
        phone: '031-000-0000',
        description: '커스텀 케이크 전문점',
        metadata: { keywords: ['분당 케이크', '레터링 케이크'] }
      });
      expect(repos.stores.findById(store.id)?.metadata).toEqual({
        keywords: ['분당 케이크', '레터링 케이크']
      });

      repos.storeChannels.create({
        id: 'channel_blog',
        storeId: store.id,
        channel: 'blog',
        sourceUrl: 'https://blog.naver.com/demo-cake',
        status: 'connected',
        providerMode: 'mock',
        settings: { postLimit: 50 }
      });

      repos.trainingSettings.create({
        id: 'training_demo_cake',
        storeId: store.id,
        status: 'ready',
        settings: {
          blog: { enabled: true },
          place: { enabled: true },
          keywords: ['분당 케이크', '당일 제작']
        }
      });

      const collectionRun = repos.collectionRuns.create({
        id: 'collection_run_demo',
        storeId: store.id,
        status: 'running',
        mode: 'mock',
        startedAt: '2026-06-05T00:00:00.000Z',
        completedAt: null,
        summary: { blog: 1, place: 1 }
      });

      const collectionItem = repos.collectionItems.create({
        id: 'item_blog_demo',
        runId: collectionRun.id,
        storeId: store.id,
        channel: 'blog',
        sourceType: 'post',
        sourceUrl: 'https://blog.naver.com/demo-cake/1',
        title: '분당 케이크 후기',
        bodyText: '당일 제작 케이크 후기가 좋습니다.',
        selectedForAnalysis: 0,
        selectionReason: null,
        selectedAt: null,
        metadata: { bodyAvailability: 'available' }
      });

      const analysisRun = repos.analysisRuns.create({
        id: 'analysis_run_demo',
        storeId: store.id,
        collectionRunId: collectionRun.id,
        status: 'running',
        startedAt: '2026-06-05T00:05:00.000Z',
        completedAt: null,
        result: {},
        error: null
      });

      repos.analysisEvidence.create({
        id: 'evidence_demo',
        analysisRunId: analysisRun.id,
        collectionItemId: collectionItem.id,
        evidenceType: 'strength',
        summary: '리뷰에서 당일 제작과 디자인 만족도가 반복됩니다.',
        score: 0.91,
        metadata: { channel: 'blog' }
      });

      const snapshot = repos.learningSnapshots.create({
        id: 'snapshot_demo',
        storeId: store.id,
        analysisRunId: analysisRun.id,
        status: 'active',
        snapshot: {
          channels: {
            blog: { status: 'analyzed', count: 1 },
            place: { status: 'analyzed', count: 1 },
            instagram: { status: 'mock', count: 0 }
          }
        }
      });

      const ruleset = repos.marketingRulesets.create({
        id: 'ruleset_demo_v1',
        storeId: store.id,
        learningSnapshotId: snapshot.id,
        status: 'draft',
        version: 1,
        ruleset: { positioning: '분당 커스텀 케이크 전문점' }
      });

      repos.rulesetFields.create({
        id: 'ruleset_field_positioning',
        rulesetId: ruleset.id,
        fieldKey: 'positioning',
        fieldValue: '분당 커스텀 케이크 전문점',
        source: 'ai',
        confidence: 0.88
      });

      const generation = repos.contentGenerations.create({
        id: 'generation_blog_demo',
        storeId: store.id,
        rulesetId: ruleset.id,
        status: 'generated',
        contentType: 'blog_post',
        prompt: { topic: '분당 케이크 맛집' },
        output: { title: '분당 케이크 맛집 추천' }
      });

      const blogPost = repos.blogPosts.create({
        id: 'blog_post_demo',
        storeId: store.id,
        contentGenerationId: generation.id,
        status: 'pending_approval',
        title: '분당 케이크 맛집 추천',
        article: { blocks: [{ type: 'paragraph', text: '커스텀 케이크를 소개합니다.' }] },
        publishedUrl: null,
        scheduledAt: null,
        publishedAt: null
      });

      repos.mediaAssets.create({
        id: 'media_asset_demo',
        storeId: store.id,
        blogPostId: blogPost.id,
        assetType: 'image',
        status: 'selected',
        url: '/assets/demo-cake.jpg',
        metadata: { alt: '레터링 케이크' }
      });

      repos.seoScores.create({
        id: 'seo_score_demo',
        blogPostId: blogPost.id,
        score: 82,
        status: 'scored',
        rubric: { keyword: 20, readability: 18 }
      });

      repos.auditEvents.create({
        id: 'audit_demo',
        storeId: store.id,
        actor: 'codex',
        action: 'seed_demo_store',
        entityType: 'store',
        entityId: store.id,
        event: { mode: 'test' }
      });

      expect(repos.collectionRuns.findById(collectionRun.id)?.summary).toEqual({ blog: 1, place: 1 });
      expect(repos.analysisEvidence.findById('evidence_demo')?.score).toBe(0.91);
      expect(repos.blogPosts.findById(blogPost.id)?.article).toEqual({
        blocks: [{ type: 'paragraph', text: '커스텀 케이크를 소개합니다.' }]
      });
      expect(repos.auditEvents.listByStoreId(store.id)).toHaveLength(1);

      const updatedStore = repos.stores.update(store.id, {
        description: 'AI 학습에 사용할 커스텀 케이크 전문점 소개',
        metadata: { keywords: ['분당 케이크', '당일 제작', '커스텀 케이크'] }
      });
      const updatedChannel = repos.storeChannels.update('channel_blog', {
        status: 'ready_for_collection',
        settings: { postLimit: 30 }
      });
      const updatedTrainingSettings = repos.trainingSettings.update('training_demo_cake', {
        status: 'saved',
        settings: { keywords: ['분당 케이크', '커스텀 케이크'], place: { enabled: true } }
      });
      const completedRun = repos.collectionRuns.update(collectionRun.id, {
        status: 'selection_ready',
        completedAt: '2026-06-05T00:10:00.000Z'
      });
      const selectedItem = repos.collectionItems.update(collectionItem.id, {
        selectedForAnalysis: 1,
        selectionReason: '대표 블로그 후기',
        selectedAt: '2026-06-05T00:11:00.000Z'
      });
      const completedAnalysis = repos.analysisRuns.update(analysisRun.id, {
        status: 'succeeded',
        completedAt: '2026-06-05T00:15:00.000Z',
        result: { strengths: ['당일 제작'] }
      });
      const updatedEvidence = repos.analysisEvidence.update('evidence_demo', {
        score: 0.95,
        metadata: { channel: 'blog', selected: true }
      });
      const updatedSnapshot = repos.learningSnapshots.update(snapshot.id, {
        status: 'current',
        snapshot: { channels: { blog: { status: 'analyzed', count: 1 } } }
      });
      const activeRuleset = repos.marketingRulesets.update(ruleset.id, {
        status: 'active',
        ruleset: { positioning: '분당 당일 제작 케이크 전문점' }
      });
      const updatedRulesetField = repos.rulesetFields.update('ruleset_field_positioning', {
        fieldValue: '분당 당일 제작 케이크 전문점',
        confidence: 0.91
      });
      const updatedGeneration = repos.contentGenerations.update(generation.id, {
        status: 'approved_for_review',
        output: { title: '분당 당일 제작 케이크 추천' }
      });
      const approvedPost = repos.blogPosts.update(blogPost.id, {
        status: 'publish_requested',
        scheduledAt: '2026-06-06T01:00:00.000Z'
      });
      const updatedMediaAsset = repos.mediaAssets.update('media_asset_demo', {
        status: 'approved',
        metadata: { alt: '레터링 케이크 승인 이미지' }
      });
      const updatedSeo = repos.seoScores.update('seo_score_demo', {
        score: 91,
        rubric: { keyword: 24, readability: 21, structure: 46 }
      });
      const updatedAuditEvent = repos.auditEvents.update('audit_demo', {
        action: 'repository_update_tested',
        event: { mode: 'test', updated: true }
      });

      expect(updatedStore.metadata).toEqual({
        keywords: ['분당 케이크', '당일 제작', '커스텀 케이크']
      });
      expect(updatedChannel.settings).toEqual({ postLimit: 30 });
      expect(updatedTrainingSettings.status).toBe('saved');
      expect(completedRun.status).toBe('selection_ready');
      expect(selectedItem.selectedForAnalysis).toBe(1);
      expect(selectedItem.selectionReason).toBe('대표 블로그 후기');
      expect(completedAnalysis.status).toBe('succeeded');
      expect(updatedEvidence.score).toBe(0.95);
      expect(updatedSnapshot.status).toBe('current');
      expect(activeRuleset.status).toBe('active');
      expect(updatedRulesetField.fieldValue).toBe('분당 당일 제작 케이크 전문점');
      expect(updatedGeneration.status).toBe('approved_for_review');
      expect(approvedPost.status).toBe('publish_requested');
      expect(updatedMediaAsset.status).toBe('approved');
      expect(updatedSeo.score).toBe(91);
      expect(updatedAuditEvent.action).toBe('repository_update_tested');
    } finally {
      connection.close();
    }
  });

  it('seeds one idempotent demo store for the Store Learning PoC', () => {
    const connection = createDatabaseConnection({ filename: ':memory:' });
    try {
      migrateDatabase(connection);

      const firstSeed = seedDemoStore(connection);
      const secondSeed = seedDemoStore(connection);
      const repos = createStoreLearningRepositories(connection);

      expect(firstSeed.storeId).toBe('store_demo_cake');
      expect(secondSeed.storeId).toBe('store_demo_cake');
      expect(repos.stores.all()).toHaveLength(1);
      expect(repos.storeChannels.listByStoreId(firstSeed.storeId).map((channel) => channel.channel)).toEqual([
        'blog',
        'place',
        'instagram'
      ]);
      expect(repos.collectionItems.listByRunId(firstSeed.collectionRunId)).toHaveLength(3);
      expect(repos.collectionItems.listByRunId(firstSeed.collectionRunId).every((item) => item.selectedForAnalysis === 1))
        .toBe(true);
      expect(repos.marketingRulesets.listByStoreId(firstSeed.storeId)[0].version).toBe(1);
      expect(repos.blogPosts.listByStoreId(firstSeed.storeId)[0].status).toBe('pending_approval');
      expect(repos.seoScores.listByBlogPostId(firstSeed.blogPostId)[0].score).toBeGreaterThanOrEqual(80);
      expect(repos.auditEvents.listByStoreId(firstSeed.storeId).map((event) => event.action)).toContain(
        'seed_demo_store'
      );
    } finally {
      connection.close();
    }
  });
});
