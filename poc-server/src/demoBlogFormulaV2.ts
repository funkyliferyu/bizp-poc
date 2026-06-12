import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection, type DbConnection } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { createStoreLearningRepositories } from './repositories/storeLearningRepositories.js';
import {
  extractBlogFormulaV2,
  extractBlogFormulaV2WithProvider,
  generateBlogFormulaV2Draft,
  retrieveBlogFormulaV2Samples,
  validateBlogFormulaV2Draft
} from './storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import type {
  BlogFormulaV2ExtractProviderMode,
  BlogFormulaV2ProviderProvenance
} from './storeLearning/blogFormulaV2/providers/blogFormulaV2Provider.js';
import { createBlogFormulaV2ProviderForMode } from './storeLearning/blogFormulaV2/providers/providerFactory.js';
import { listOwnerBlogPostsForFormulaV2 } from './storeLearning/blogFormulaV2/sourcePosts.js';
import { BLOG_FORMULA_V2_MODEL } from './storeLearning/blogFormulaV2/types.js';

export type BlogFormulaV2DemoOptions = {
  connection?: DbConnection;
  databaseFilename?: string;
  storeId?: string;
  providerMode?: BlogFormulaV2ExtractProviderMode;
  closeConnection?: boolean;
};

export type BlogFormulaV2DemoReport = {
  storeId: string;
  mode: 'v2_formula';
  providerMode: 'deterministic' | 'safe_mock' | 'openai';
  model: string;
  formulaSetId: string;
  draftGenerationId: string;
  sourcePostCount: number;
  retrievedSampleCount: number;
  selectedTitle: string;
  validationStatus: string;
  riskLevel: string;
};

const defaultStoreId = process.env.BLOG_FORMULA_V2_STORE_ID ?? 'store_1020864025';
const providerModes = new Set(['deterministic', 'safe_mock', 'openai', 'auto']);

function providerModeFromEnv(value: string | undefined): BlogFormulaV2ExtractProviderMode | undefined {
  if (!value) return undefined;
  if (providerModes.has(value)) return value as BlogFormulaV2ExtractProviderMode;
  throw new Error(`Invalid BLOG_FORMULA_V2_PROVIDER_MODE: ${value}`);
}

function timestamp(offsetSeconds: number) {
  return new Date(Date.UTC(2026, 5, 12, 9, 0, offsetSeconds)).toISOString();
}

function ensureDemoSourcePosts(connection: DbConnection, storeId: string) {
  const repos = createStoreLearningRepositories(connection);
  const existingStore = repos.stores.findById(storeId);
  if (!existingStore) {
    repos.stores.create({
      id: storeId,
      name: '테라스의원',
      naverPlaceUrl: 'https://naver.me/1020864025',
      naverPlaceId: '1020864025',
      category: '피부과',
      address: '서울 강남구 데모로 12',
      phone: '02-000-0000',
      description: '색소 치료와 리팟레이저 상담을 안내하는 피부과입니다.',
      metadata: {
        representativeKeywords: ['리팟레이저', '흑자', '색소 치료'],
        healthcare: true
      },
      createdAt: timestamp(0),
      updatedAt: timestamp(0)
    });
  }

  if (listOwnerBlogPostsForFormulaV2(repos, storeId).length > 0) return;

  const runId = `collection_run_${storeId}_blog_formula_v2_demo`;
  repos.collectionRuns.upsert({
    id: runId,
    storeId,
    status: 'selection_ready',
    mode: 'mock',
    startedAt: timestamp(1),
    completedAt: timestamp(2),
    summary: { blog: { collected: 3 }, mode: 'blog_formula_v2_demo' },
    createdAt: timestamp(1),
    updatedAt: timestamp(2)
  });

  const posts = [
    {
      id: `collection_item_${storeId}_v2_owner_1`,
      title: '리팟레이저 부작용 걱정 없이 하려면 [리팟 공식 인증 피부과]',
      bodyText:
        '리팟레이저 부작용을 걱정하는 분들은 색소침착과 재발 가능성을 먼저 확인합니다.\n\n장비 원리와 피부 상태를 함께 보고 의료진 상담 후 결정하는 것이 중요합니다.\n\n개인차와 부작용 가능성을 안내한 뒤 필요한 경우에만 치료 계획을 세웁니다.',
      publishedAt: '2026-06-01T03:00:00.000Z'
    },
    {
      id: `collection_item_${storeId}_v2_owner_2`,
      title: '흑자 제거 전, 리팟레이저 원리를 먼저 확인해야 하는 이유',
      bodyText:
        '흑자 제거는 강한 에너지보다 정확한 진단이 먼저입니다.\n\n피부 깊이와 병변 특성에 따라 적합한 방식이 달라질 수 있습니다.\n\n회복 과정과 주의사항은 상담에서 함께 확인해야 합니다.',
      publishedAt: '2026-05-25T03:00:00.000Z'
    },
    {
      id: `collection_item_${storeId}_v2_owner_3`,
      title: '색소 치료 상담 전 확인해야 할 세 가지',
      bodyText:
        '색소 치료를 고민한다면 기대 효과보다 내 피부 상태에 맞는 계획을 먼저 봐야 합니다.\n\n개인별 반응과 주의사항을 설명받고 무리한 표현은 피하는 것이 좋습니다.\n\n의료진 상담을 통해 가능한 범위를 확인해 주세요.',
      publishedAt: '2026-05-18T03:00:00.000Z'
    }
  ];

  for (const [index, post] of posts.entries()) {
    repos.collectionItems.upsert({
      id: post.id,
      runId,
      storeId,
      channel: 'blog',
      sourceType: 'post',
      status: 'collected',
      sourceUrl: `https://blog.naver.com/terrace-demo/${index + 1}`,
      title: post.title,
      bodyText: post.bodyText,
      selectedForAnalysis: 1,
      selectionReason: 'Blog Formula V2 demo source',
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
}

export async function runBlogFormulaV2Demo(
  options: BlogFormulaV2DemoOptions = {}
): Promise<BlogFormulaV2DemoReport> {
  const connection =
    options.connection ?? createDatabaseConnection(options.databaseFilename ? { filename: options.databaseFilename } : undefined);
  const shouldClose = options.closeConnection ?? !options.connection;
  const storeId = options.storeId ?? defaultStoreId;

  try {
    migrateDatabase(connection);
    ensureDemoSourcePosts(connection, storeId);
    const repos = createStoreLearningRepositories(connection);
    const providerMode = options.providerMode ?? providerModeFromEnv(process.env.BLOG_FORMULA_V2_PROVIDER_MODE);
    const provider = createBlogFormulaV2ProviderForMode(providerMode);
    let extractionProvider: BlogFormulaV2ProviderProvenance | null = null;
    let extraction: ReturnType<typeof extractBlogFormulaV2> | Awaited<ReturnType<typeof extractBlogFormulaV2WithProvider>>;
    if (provider) {
      const providerExtraction = await extractBlogFormulaV2WithProvider(repos, storeId, provider);
      extractionProvider = providerExtraction.provider;
      extraction = providerExtraction;
    } else {
      extraction = extractBlogFormulaV2(repos, storeId);
    }
    const retrieval = retrieveBlogFormulaV2Samples(repos, storeId, {
      formulaSetId: extraction.formulaSet.id,
      topicBrief: {
        topic: '리팟레이저',
        mainKeyword: '리팟레이저 부작용',
        secondaryKeywords: ['흑자 제거', '색소침착'],
        targetReader: '흑자 제거를 고민하지만 부작용, 재발, 착색이 걱정되는 고객',
        coreConcern: '부작용과 재발 우려',
        mainAngle: '원리와 의료진 상담 기준을 먼저 설명',
        mustInclude: ['개인차', '의료진 상담', '부작용 가능성'],
        mustAvoid: ['효과보장', '부작용 없음'],
        ctaDirection: '상담 예약'
      },
      maxSamples: 3
    });
    const generated = generateBlogFormulaV2Draft(repos, storeId, {
      formulaSetId: extraction.formulaSet.id,
      topicBriefId: retrieval.topicBrief.id,
      retrievalRunId: retrieval.retrievalRun.id
    });
    const validated = validateBlogFormulaV2Draft(repos, storeId, {
      draftGenerationId: generated.draftGeneration.id
    });

    return {
      storeId,
      mode: 'v2_formula',
      providerMode: extractionProvider?.mode ?? 'deterministic',
      model: extraction.formulaSet.model ?? BLOG_FORMULA_V2_MODEL,
      formulaSetId: extraction.formulaSet.id,
      draftGenerationId: generated.draftGeneration.id,
      sourcePostCount: extraction.sourcePosts.length,
      retrievedSampleCount: retrieval.samples.length,
      selectedTitle: generated.output.selectedTitle,
      validationStatus: validated.validation.status,
      riskLevel: validated.validation.riskLevel
    };
  } finally {
    if (shouldClose) connection.close();
  }
}

function isCliInvocation() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

if (isCliInvocation()) {
  runBlogFormulaV2Demo()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(message);
      process.exitCode = 1;
    });
}
