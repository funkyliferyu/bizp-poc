import type { DbConnection } from '../../src/db/connection.js';
import { createStoreLearningRepositories } from '../../src/repositories/storeLearningRepositories.js';

export const BLOG_FORMULA_V2_STORE_ID = 'store_blog_formula_v2';

const baseTime = Date.UTC(2026, 5, 12, 8, 0, 0);

function timestamp(offsetSeconds: number) {
  return new Date(baseTime + offsetSeconds * 1000).toISOString();
}

export function seedBlogFormulaV2Fixture(connection: DbConnection) {
  const repos = createStoreLearningRepositories(connection);
  const storeId = BLOG_FORMULA_V2_STORE_ID;
  const runId = 'collection_run_blog_formula_v2';

  repos.stores.create({
    id: storeId,
    name: '테라스의원',
    naverPlaceUrl: 'https://naver.me/test-terrace',
    naverPlaceId: '1020864025',
    category: '피부과',
    address: '서울 강남구 테스트로 12',
    phone: '02-000-0000',
    description: '리팟레이저와 색소 진료를 안내하는 피부과입니다.',
    metadata: {
      representativeKeywords: ['리팟레이저', '흑자', '색소 치료'],
      operatingHours: '월-금 10:00-19:00',
      healthcare: true
    },
    createdAt: timestamp(0),
    updatedAt: timestamp(0)
  });

  repos.collectionRuns.create({
    id: runId,
    storeId,
    status: 'selection_ready',
    mode: 'mock',
    startedAt: timestamp(1),
    completedAt: timestamp(2),
    summary: { blog: { collected: 4 }, place: { collected: 2 } },
    createdAt: timestamp(1),
    updatedAt: timestamp(2)
  });

  const ownerPosts = [
    {
      id: 'collection_item_v2_owner_1',
      title: '리팟레이저 부작용 걱정 없이 하려면 [리팟 공식 인증 피부과]',
      bodyText:
        '리팟레이저 부작용을 검색하는 분들은 흑자 치료 후 색소침착이나 재발을 가장 걱정합니다.\n\n오늘은 장비 원리와 의료진 상담 기준을 먼저 설명드리겠습니다.\n\n개인의 피부 상태에 따라 붉어짐, 열감, 색소 변화가 생길 수 있어 의료진 상담 후 결정하는 것이 중요합니다.\n\n테라스의원은 진단 후 필요한 경우에만 치료 계획을 안내드립니다.',
      publishedAt: '2026-05-30T03:00:00.000Z'
    },
    {
      id: 'collection_item_v2_owner_2',
      title: '흑자 제거 전, 리팟레이저 원리를 먼저 확인해야 하는 이유',
      bodyText:
        '흑자 제거는 단순히 강한 에너지를 쓰는 문제가 아닙니다.\n\n피부 깊이와 병변 상태를 확인한 뒤 리팟레이저 적용 여부를 판단해야 합니다.\n\n치료 후 반응은 개인차가 있으므로 회복 과정과 주의사항을 함께 확인해야 합니다.\n\n상담을 통해 본인에게 맞는 계획을 세우는 것이 안전합니다.',
      publishedAt: '2026-05-24T03:00:00.000Z'
    },
    {
      id: 'collection_item_v2_owner_3',
      title: '광화문써마지, 볼패임 없이 효과를 극대화하는 방법은 따로 있습니다',
      bodyText:
        '시술을 고민할 때는 가격보다 내 얼굴 상태에 맞는 설계가 먼저입니다.\n\n부작용 우려가 있다면 원리와 적응증, 피해야 할 케이스를 차분히 확인해야 합니다.\n\n의료진 상담을 통해 기대 가능한 변화와 한계를 함께 살피는 것이 필요합니다.',
      publishedAt: '2026-05-17T03:00:00.000Z'
    },
    {
      id: 'collection_item_v2_owner_4',
      title: '울쎄라600샷가격, 그보다 먼저 확인해야 하는 1가지?',
      bodyText:
        '가격보다 중요한 것은 필요한 샷 수와 피부 상태를 함께 판단하는 과정입니다.\n\n무리한 권유보다 개인별 상태에 맞는 설명이 먼저여야 합니다.\n\n상담 후 가능한 범위와 주의할 점을 확인해 주세요.',
      publishedAt: '2026-05-10T03:00:00.000Z'
    }
  ];

  for (const [index, post] of ownerPosts.entries()) {
    repos.collectionItems.create({
      id: post.id,
      runId,
      storeId,
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: `https://blog.naver.com/terrace/${index + 1}`,
      title: post.title,
      bodyText: post.bodyText,
      selectedForAnalysis: 1,
      selectionReason: 'V2 owner blog fixture',
      selectedAt: timestamp(10 + index),
      metadata: {
        sourceKind: 'owner_blog_post',
        sourceOwnership: 'owned',
        bodyAvailability: 'available',
        isTruncated: false,
        publishedAt: post.publishedAt
      },
      createdAt: timestamp(10 + index),
      updatedAt: timestamp(10 + index)
    });
  }

  repos.collectionItems.create({
    id: 'collection_item_v2_place_profile',
    runId,
    storeId,
    channel: 'place',
    sourceType: 'profile',
    status: 'collected',
    sourceUrl: 'https://naver.me/test-terrace',
    title: '네이버 플레이스 매장 프로필',
    bodyText: '피부과, 색소 치료, 리팟레이저 상담 가능',
    selectedForAnalysis: 1,
    selectionReason: 'V2 place profile fixture',
    selectedAt: timestamp(20),
    metadata: { sourceKind: 'place_profile', sourceOwnership: 'owned', bodyAvailability: 'available' },
    createdAt: timestamp(20),
    updatedAt: timestamp(20)
  });

  repos.collectionItems.create({
    id: 'collection_item_v2_place_review',
    runId,
    storeId,
    channel: 'place',
    sourceType: 'review',
    status: 'collected',
    sourceUrl: 'https://naver.me/test-terrace/reviews',
    title: '플레이스 방문자 리뷰',
    bodyText: '상담이 자세하고 리팟레이저 설명을 잘 들었다는 방문자 리뷰입니다.',
    selectedForAnalysis: 1,
    selectionReason: 'V2 negative-control review fixture',
    selectedAt: timestamp(21),
    metadata: { sourceKind: 'place_visitor_review', sourceOwnership: 'user_generated', bodyAvailability: 'available' },
    createdAt: timestamp(21),
    updatedAt: timestamp(21)
  });

  return {
    storeId,
    runId,
    ownerPostIds: ownerPosts.map((post) => post.id),
    reviewItemId: 'collection_item_v2_place_review'
  };
}
