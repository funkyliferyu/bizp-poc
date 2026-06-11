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
      operatingHours: '월-금 10:00-20:00, 토 11:00-19:00',
      closedDays: '매주 일요일',
      parking: '건물 지하 주차장 1시간 지원',
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
      strengths: ['레터링 디자인', '당일 제작', '친절한 상담'],
      analyzerProvider: 'mockDeterministicAnalyzer',
      analyzerMode: 'mock',
      analyzerModel: null,
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
      promptBudgetReason: null
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
    metadata: {
      channel: 'place',
      fieldEvidence: {
        positioning: {
          summary: '포지셔닝 산출 근거: 분당 당일 제작 커스텀 케이크 전문점. 수집 근거: 리뷰에서 상담 친절도와 완성도 언급이 반복됩니다.'
        },
        storePositioning: {
          summary: '포지셔닝 산출 근거: 분당 당일 제작 커스텀 케이크 전문점. 수집 근거: 리뷰에서 상담 친절도와 완성도 언급이 반복됩니다.'
        },
        keyStrengths: {
          summary: '업체 주장 강점 산출 근거: 친절한 상담과 사진 유사도가 리뷰에서 반복됩니다.'
        },
        reviewStrength: {
          summary: '리뷰 강점 산출 근거: 친절한 디자인 상담, 사진과 비슷한 완성도, 빠른 제작 안내가 반복됩니다.'
        },
        reviewWeakness: {
          summary: '리뷰 약점 산출 근거: 픽업 전 주차와 이동 동선 안내가 필요합니다.'
        }
      }
    },
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
    metadata: {
      channel: 'blog',
      fieldEvidence: {
        positioning: {
          summary: '포지셔닝 산출 근거: 분당 당일 제작 커스텀 케이크 전문점. 수집 근거: 블로그 제목과 본문에 지역, 당일 제작, 레터링 케이크 키워드가 함께 나타납니다.'
        },
        storePositioning: {
          summary: '포지셔닝 산출 근거: 분당 당일 제작 커스텀 케이크 전문점. 수집 근거: 블로그 제목과 본문에 지역, 당일 제작, 레터링 케이크 키워드가 함께 나타납니다.'
        },
        contentKeywords: {
          summary: '콘텐츠 소재 키워드 산출 근거: 분당 케이크, 당일 제작, 레터링 케이크 표현이 콘텐츠에 적합합니다.'
        },
        seoKeywords: {
          summary: 'SEO 키워드 산출 근거: 분당 케이크와 당일 제작 키워드가 블로그 검색 의도와 맞습니다.'
        },
        representativeMenu: {
          summary: '대표 메뉴 산출 근거: 블로그 본문에서 레터링 케이크와 딸기 생크림 케이크가 함께 언급됩니다.'
        }
      }
    },
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

  const expandedRulesetFields = [
    {
      fieldKey: 'representativeMenu',
      value: '레터링 케이크, 딸기 생크림 케이크, 커스텀 기념일 케이크',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.79
    },
    {
      fieldKey: 'targetCustomers',
      value: '기념일 케이크 고객, 레터링 케이크 예약 고객, 정자동 픽업 고객',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_review'],
      confidence: 0.84
    },
    {
      fieldKey: 'reviewStrength',
      value: '친절한 디자인 상담, 사진과 비슷한 완성도, 빠른 제작 안내',
      evidenceItemIds: ['collection_item_demo_place_review', 'collection_item_demo_blog'],
      confidence: 0.86
    },
    {
      fieldKey: 'reviewWeakness',
      value: '주차 공간이 협소할 수 있어 픽업 시간과 이동 동선을 미리 안내해야 함',
      evidenceItemIds: ['collection_item_demo_place_review'],
      confidence: 0.74
    },
    {
      fieldKey: 'toneAndManner',
      value: '친절하고 구체적인 예약 안내형',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.86
    },
    {
      fieldKey: 'catchphrase',
      value: '특별한 날을 더 특별하게, 분당에서 차분하게 준비하는 레터링 케이크',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile'],
      confidence: 0.76
    },
    {
      fieldKey: 'industryCommonRules',
      value: '업종 공통 필수 고지 없음',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.62
    },
    {
      fieldKey: 'blogRequiredIntroCopy',
      value: '브랜드 소개나 반복 인트로가 있을 때만 직접 입력',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.7
    },
    {
      fieldKey: 'blogRequiredFooterCopy',
      value: '예약, 문의, 운영 안내 등 반복 푸터가 있을 때만 직접 입력',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.62
    },
    {
      fieldKey: 'negativeExpressions',
      value: '전국 최고, 무조건 가능, 효능 보장, 과장된 원조 표현',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile', 'collection_item_demo_place_review'],
      confidence: 0.9
    },
    {
      fieldKey: 'humorLevel',
      value: '낮음 — 가벼운 언어 유희만 허용',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.73
    },
    {
      fieldKey: 'trendSensitivity',
      value: '중간 — 시즌과 기념일 트렌드만 선별 반영',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile'],
      confidence: 0.72
    },
    {
      fieldKey: 'instagramPurpose',
      value: '비주얼 중심 브랜딩과 신규 고객 유입',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.72
    },
    {
      fieldKey: 'instagramWritingStyle',
      value: '짧은 단정 서술과 지역/메뉴 해시태그 중심',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.72
    },
    {
      fieldKey: 'instagramPreferredLength',
      value: '캡션 80-150자와 해시태그 4-6개',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.71
    },
    {
      fieldKey: 'instagramHashtags',
      value: '#분당케이크 #레터링케이크 #커스텀케이크 #당일제작케이크',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile', 'collection_item_demo_place_review'],
      confidence: 0.78
    },
    {
      fieldKey: 'instagramEmojiPolicy',
      value: '문장 끝 1-2개까지 허용',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.7
    },
    {
      fieldKey: 'blogPurpose',
      value: '검색 유입, 예약 상담 유도, 신뢰 형성',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile'],
      confidence: 0.85
    },
    {
      fieldKey: 'blogWritingStyle',
      value: '실제 후기 근거를 먼저 제시하고 주문/픽업 정보를 자연스럽게 연결하는 검색 유입형',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.87
    },
    {
      fieldKey: 'blogPreferredLength',
      value: '본문 700-1,000자와 사진 8장 이상 권장',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.77
    },
    {
      fieldKey: 'blogHashtags',
      value: '#분당케이크 #레터링케이크 #커스텀케이크 #당일제작케이크',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile', 'collection_item_demo_place_review'],
      confidence: 0.78
    },
    {
      fieldKey: 'blogEmojiPolicy',
      value: '검색형 본문에서는 이모지 사용 안 함',
      evidenceItemIds: ['collection_item_demo_blog'],
      confidence: 0.78
    },
    {
      fieldKey: 'seoKeywords',
      value: '분당 케이크, 레터링 케이크, 정자동 케이크, 당일 제작 케이크',
      evidenceItemIds: ['collection_item_demo_blog', 'collection_item_demo_place_profile', 'collection_item_demo_place_review'],
      confidence: 0.89
    },
    {
      fieldKey: 'ctaStyle',
      value: '예약 가능 여부와 픽업 시간을 확인하도록 부드럽게 유도',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.82
    },
    {
      fieldKey: 'primaryColors',
      value: '#FAD9E3 파스텔 핑크, #FFFFFF 화이트',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.69
    },
    {
      fieldKey: 'accentColors',
      value: '#E8A0BF 로즈 핑크',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.68
    },
    {
      fieldKey: 'imageDirection',
      value: '케이크 디테일, 레터링 문구, 포장 상태, 픽업 동선을 함께 보여주는 이미지 구성',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_place_review'],
      confidence: 0.81
    },
    {
      fieldKey: 'imageStyle',
      value: '감성적 미니멀, 케이크 클로즈업 중심',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.74
    },
    {
      fieldKey: 'imageAvoidStyle',
      value: '어두운 톤, 과도한 필터, 복잡한 배경',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.73
    },
    {
      fieldKey: 'instagramImageFormat',
      value: '정방형 1:1 또는 세로 4:5',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.7
    },
    {
      fieldKey: 'instagramImageStyle',
      value: '감성 접사와 플랫레이 중심',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.7
    },
    {
      fieldKey: 'instagramOverlayPolicy',
      value: '카드뉴스형 가능, 로고 워터마크는 owner asset이 있을 때만 사용',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.68
    },
    {
      fieldKey: 'blogImageFormat',
      value: '가로 3:2 권장, 최소 8장, 1200x800px 이상',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.76
    },
    {
      fieldKey: 'blogImageStyle',
      value: '전체샷, 디테일샷, 공간샷을 혼합',
      evidenceItemIds: ['collection_item_demo_place_profile', 'collection_item_demo_blog'],
      confidence: 0.75
    },
    {
      fieldKey: 'blogOverlayPolicy',
      value: '이미지 내 텍스트 최소화',
      evidenceItemIds: ['collection_item_demo_place_profile'],
      confidence: 0.74
    }
  ];

  expandedRulesetFields.forEach((field, index) => {
    repos.rulesetFields.upsert({
      id: `ruleset_field_demo_${field.fieldKey}`,
      rulesetId,
      fieldKey: field.fieldKey,
      fieldValue: field.value,
      aiValue: field.value,
      userValue: null,
      finalValue: field.value,
      source: 'analysis',
      locked: 0,
      evidenceItemIds: field.evidenceItemIds,
      confidence: field.confidence,
      createdAt: timestamp(30 + index),
      updatedAt: timestamp(30 + index)
    });
  });

  repos.contentGenerations.upsert({
    id: contentGenerationId,
    storeId,
    rulesetId,
    status: 'generated',
    contentType: 'blog_post',
    prompt: {
      topic: '분당 케이크 맛집 추천',
      rulesetId,
      mode: 'mock',
      provider: 'mock_ruleset_blog_generator',
      model: null,
      action: 'generate_blog_post',
      providerSeoScoreReturned: false
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
      generatedFromRulesetId: rulesetId,
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
      _provenance: {
        mode: 'mock',
        provider: 'localSeoScorer',
        model: null,
        action: 'initial_score'
      },
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
