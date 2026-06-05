import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbConnection } from './db/connection.js';
import { createDatabaseConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { createStoreLearningRepositories } from './repositories/storeLearningRepositories.js';

export type DemoStoreSeedResult = {
  storeId: string;
  collectionRunId: string;
  analysisRunId: string;
  rulesetId: string;
  contentGenerationId: string;
  blogPostId: string;
};

const baseTime = Date.UTC(2026, 5, 5, 0, 0, 0);

function timestamp(offsetSeconds: number) {
  return new Date(baseTime + offsetSeconds * 1000).toISOString();
}

export function seedDemoStore(connection: DbConnection): DemoStoreSeedResult {
  const repos = createStoreLearningRepositories(connection);
  const storeId = 'store_demo_cake';
  const collectionRunId = 'collection_run_demo_store_learning';
  const analysisRunId = 'analysis_run_demo_store_learning';
  const snapshotId = 'learning_snapshot_demo_store_learning';
  const rulesetId = 'marketing_ruleset_demo_v1';
  const contentGenerationId = 'content_generation_demo_blog';
  const blogPostId = 'blog_post_demo_pending_approval';

  repos.stores.upsert({
    id: storeId,
    name: '분당 케이크하우스',
    naverPlaceUrl: 'https://naver.me/demo-cake',
    naverPlaceId: 'place_demo_cake',
    category: 'bakery',
    address: '경기도 성남시 분당구 정자동',
    phone: '031-000-0000',
    description: '당일 제작과 레터링 케이크에 강한 커스텀 케이크 전문점입니다.',
    metadata: {
      representativeKeywords: ['분당 케이크', '당일 제작', '레터링 케이크'],
      mockMode: true
    },
    createdAt: timestamp(0),
    updatedAt: timestamp(0)
  });

  repos.storeChannels.upsert({
    id: 'channel_demo_blog',
    storeId,
    channel: 'blog',
    sourceUrl: 'https://blog.naver.com/demo-cake',
    status: 'connected',
    providerMode: 'mock',
    settings: { postLimit: 50, includeFullBody: true },
    createdAt: timestamp(1),
    updatedAt: timestamp(1)
  });
  repos.storeChannels.upsert({
    id: 'channel_demo_place',
    storeId,
    channel: 'place',
    sourceUrl: 'https://naver.me/demo-cake',
    status: 'connected',
    providerMode: 'mock',
    settings: { includeProfile: true, includeReviews: true },
    createdAt: timestamp(2),
    updatedAt: timestamp(2)
  });
  repos.storeChannels.upsert({
    id: 'channel_demo_instagram',
    storeId,
    channel: 'instagram',
    sourceUrl: null,
    status: 'mock_only',
    providerMode: 'mock',
    settings: { note: 'Provider scope not implemented for DATA-001' },
    createdAt: timestamp(3),
    updatedAt: timestamp(3)
  });

  repos.trainingSettings.upsert({
    id: 'training_settings_demo',
    storeId,
    status: 'ready',
    settings: {
      channels: {
        blog: { enabled: true, postLimit: 50 },
        place: { enabled: true, includeReviews: true },
        instagram: { enabled: false, mode: 'mock' }
      },
      keywords: ['분당 케이크', '당일 제작', '커스텀 케이크'],
      includeStoreMaterials: true
    },
    createdAt: timestamp(4),
    updatedAt: timestamp(4)
  });

  repos.collectionRuns.upsert({
    id: collectionRunId,
    storeId,
    status: 'selection_ready',
    mode: 'mock',
    startedAt: timestamp(5),
    completedAt: timestamp(12),
    summary: {
      blog: { collected: 1, status: 'completed' },
      place: { collected: 2, status: 'completed' },
      instagram: { collected: 0, status: 'mock_only' }
    },
    createdAt: timestamp(5),
    updatedAt: timestamp(12)
  });

  repos.collectionItems.upsert({
    id: 'collection_item_demo_blog',
    runId: collectionRunId,
    storeId,
    channel: 'blog',
    sourceType: 'post',
    status: 'collected',
    sourceUrl: 'https://blog.naver.com/demo-cake/1',
    title: '분당 레터링 케이크 후기',
    bodyText: '당일 제작 케이크와 레터링 디자인 만족도가 높다는 후기입니다.',
    selectedForAnalysis: 1,
    selectionReason: '대표 블로그 후기',
    selectedAt: timestamp(9),
    metadata: { bodyAvailability: 'available', provider: 'mock' },
    createdAt: timestamp(6),
    updatedAt: timestamp(6)
  });
  repos.collectionItems.upsert({
    id: 'collection_item_demo_place_profile',
    runId: collectionRunId,
    storeId,
    channel: 'place',
    sourceType: 'profile',
    status: 'collected',
    sourceUrl: 'https://naver.me/demo-cake',
    title: '네이버 플레이스 매장 프로필',
    bodyText: '커스텀 케이크, 당일 제작, 정자동 픽업 가능',
    selectedForAnalysis: 1,
    selectionReason: '매장 기본정보',
    selectedAt: timestamp(9),
    metadata: { bodyAvailability: 'available', provider: 'mock' },
    createdAt: timestamp(7),
    updatedAt: timestamp(7)
  });
  repos.collectionItems.upsert({
    id: 'collection_item_demo_place_review',
    runId: collectionRunId,
    storeId,
    channel: 'place',
    sourceType: 'review',
    status: 'collected',
    sourceUrl: 'https://naver.me/demo-cake/reviews',
    title: '플레이스 리뷰 요약',
    bodyText: '디자인 상담이 친절하고 케이크가 사진과 비슷하다는 리뷰가 반복됩니다.',
    selectedForAnalysis: 1,
    selectionReason: '리뷰 강점 근거',
    selectedAt: timestamp(9),
    metadata: { bodyAvailability: 'available', provider: 'mock' },
    createdAt: timestamp(8),
    updatedAt: timestamp(8)
  });

  repos.analysisRuns.upsert({
    id: analysisRunId,
    storeId,
    collectionRunId,
    status: 'succeeded',
    startedAt: timestamp(13),
    completedAt: timestamp(20),
    result: {
      positioning: '분당 당일 제작 커스텀 케이크',
      strengths: ['레터링 디자인', '당일 제작', '친절한 상담']
    },
    error: null,
    createdAt: timestamp(13),
    updatedAt: timestamp(20)
  });

  repos.analysisEvidence.upsert({
    id: 'analysis_evidence_demo_strength',
    analysisRunId,
    collectionItemId: 'collection_item_demo_place_review',
    evidenceType: 'review_strength',
    summary: '친절한 상담과 사진 유사도가 리뷰에서 반복됩니다.',
    score: 0.92,
    metadata: { channel: 'place' },
    createdAt: timestamp(14),
    updatedAt: timestamp(14)
  });
  repos.analysisEvidence.upsert({
    id: 'analysis_evidence_demo_keyword',
    analysisRunId,
    collectionItemId: 'collection_item_demo_blog',
    evidenceType: 'keyword',
    summary: '분당 케이크와 당일 제작 키워드가 콘텐츠에 적합합니다.',
    score: 0.87,
    metadata: { channel: 'blog' },
    createdAt: timestamp(15),
    updatedAt: timestamp(15)
  });

  repos.learningSnapshots.upsert({
    id: snapshotId,
    storeId,
    analysisRunId,
    status: 'active',
    snapshot: {
      tabs: {
        blog: { status: 'analyzed', count: 1 },
        place: { status: 'analyzed', count: 2 },
        instagram: { status: 'mock_only', count: 0 }
      }
    },
    createdAt: timestamp(21),
    updatedAt: timestamp(21)
  });

  repos.marketingRulesets.upsert({
    id: rulesetId,
    storeId,
    learningSnapshotId: snapshotId,
    status: 'draft',
    version: 1,
    ruleset: {
      positioning: '분당 당일 제작 커스텀 케이크 전문점',
      writingStyle: '친절하고 예약 정보를 명확히 안내하는 블로그형',
      imageStyle: '케이크 디테일과 픽업 패키지를 함께 보여주는 구성'
    },
    createdAt: timestamp(22),
    updatedAt: timestamp(22)
  });

  repos.rulesetFields.upsert({
    id: 'ruleset_field_demo_positioning',
    rulesetId,
    fieldKey: 'positioning',
    fieldValue: '분당 당일 제작 커스텀 케이크 전문점',
    aiValue: '분당 당일 제작 커스텀 케이크 전문점',
    userValue: null,
    finalValue: '분당 당일 제작 커스텀 케이크 전문점',
    source: 'analysis',
    locked: 0,
    evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_review'],
    confidence: 0.9,
    createdAt: timestamp(23),
    updatedAt: timestamp(23)
  });
  repos.rulesetFields.upsert({
    id: 'ruleset_field_demo_keywords',
    rulesetId,
    fieldKey: 'contentKeywords',
    fieldValue: '분당 케이크, 당일 제작, 레터링 케이크',
    aiValue: '분당 케이크, 당일 제작, 레터링 케이크',
    userValue: null,
    finalValue: '분당 케이크, 당일 제작, 레터링 케이크',
    source: 'analysis',
    locked: 0,
    evidenceItemIds: ['collection_item_demo_blog'],
    confidence: 0.86,
    createdAt: timestamp(24),
    updatedAt: timestamp(24)
  });

  repos.contentGenerations.upsert({
    id: contentGenerationId,
    storeId,
    rulesetId,
    status: 'generated',
    contentType: 'blog_post',
    prompt: {
      topic: '분당 케이크 맛집 추천',
      rulesetId
    },
    output: {
      title: '분당 케이크 맛집 추천 - 당일 제작 레터링 케이크 안내',
      status: 'validated_mock'
    },
    createdAt: timestamp(25),
    updatedAt: timestamp(25)
  });

  repos.blogPosts.upsert({
    id: blogPostId,
    storeId,
    contentGenerationId,
    status: 'pending_approval',
    title: '분당 케이크 맛집 추천 - 당일 제작 레터링 케이크 안내',
    article: {
      blocks: [
        { type: 'heading', text: '분당에서 당일 제작 케이크를 찾는다면' },
        { type: 'paragraph', text: '정자동에서 픽업 가능한 커스텀 케이크 예약 정보를 안내합니다.' }
      ]
    },
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: timestamp(26),
    updatedAt: timestamp(26)
  });

  repos.mediaAssets.upsert({
    id: 'media_asset_demo_blog_cover',
    storeId,
    blogPostId,
    assetType: 'image',
    status: 'selected',
    url: '/assets/demo/store-demo-cake-cover.jpg',
    prompt: '분당 레터링 케이크 대표 이미지 placeholder',
    metadata: {
      alt: '분당 레터링 케이크 대표 이미지',
      source: 'mock'
    },
    createdAt: timestamp(27),
    updatedAt: timestamp(27)
  });

  repos.seoScores.upsert({
    id: 'seo_score_demo_blog',
    blogPostId,
    score: 86,
    totalScore: 86,
    status: 'scored',
    rubric: {
      keywordFit: 28,
      readability: 22,
      structure: 20,
      localIntent: 16
    },
    createdAt: timestamp(28),
    updatedAt: timestamp(28)
  });

  repos.auditEvents.upsert({
    id: 'audit_event_demo_seed',
    storeId,
    actor: 'system',
    action: 'seed_demo_store',
    entityType: 'store',
    entityId: storeId,
    event: {
      mode: 'mock',
      purpose: 'Store Learning & Blog Content Automation PoC'
    },
    createdAt: timestamp(29),
    updatedAt: timestamp(29)
  });

  return {
    storeId,
    collectionRunId,
    analysisRunId,
    rulesetId,
    contentGenerationId,
    blogPostId
  };
}

function isCliInvocation() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

if (isCliInvocation()) {
  const connection = createDatabaseConnection();
  try {
    migrateDatabase(connection);
    const result = seedDemoStore(connection);
    console.log(JSON.stringify({ seeded: true, ...result, database: connection.filename }, null, 2));
  } finally {
    connection.close();
  }
}
