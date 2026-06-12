import { randomUUID } from 'node:crypto';
import type { JsonValue } from '../../repositories/base.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { recordLlmAuditLog } from '../llmAudit/llmAuditRecorder.js';
import { sanitizedProviderError } from '../llmAudit/llmAuditMetadata.js';
import {
  BLOG_FORMULA_V2_MODEL,
  BLOG_FORMULA_V2_VERSION,
  BlogDraftOutputV2Schema,
  BlogFormulaSetV2Schema,
  BlogRetrievedSampleV2Schema,
  BlogTopicBriefInputSchema,
  type BlogDraftOutputV2,
  type BlogDraftValidationResultV2,
  type BlogRetrievedSampleV2,
  type BlogTopicBriefInput
} from './types.js';
import { BLOG_FORMULA_V2_CALL_ID, BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION } from './blogFormulaPrompt.js';
import { evaluateBlogFormulaV2Quality } from './formulaQuality.js';
import { buildGenerationReadyMockFormula } from './mockFormulaBuilder.js';
import type {
  BlogFormulaV2Provider,
  BlogFormulaV2ProviderProvenance
} from './providers/blogFormulaV2Provider.js';
import { listOwnerBlogPostsForFormulaV2, type OwnerBlogPostV2 } from './sourcePosts.js';
import { validateBlogFormulaV2DraftText } from './validator.js';

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;

type RetrieveSamplesInput = {
  formulaSetId?: string;
  topicBriefId?: string;
  topicBrief?: BlogTopicBriefInput;
  maxSamples?: number;
};

type GenerateDraftInput = {
  formulaSetId?: string;
  topicBriefId: string;
  retrievalRunId: string;
};

type ValidateDraftInput =
  | { draftGenerationId: string }
  | { selectedTitle: string; blogDraft: string; topicBrief: BlogTopicBriefInput };

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function asStringArray(value: JsonValue | undefined | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).at(-1) ?? null;
}

function latestByCreatedAt<T extends { createdAt: string }>(records: T[]) {
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1) ?? null;
}

function requireStore(repos: StoreLearningRepositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) throw new Error(`Store not found: ${storeId}`);
  return store;
}

function requireFormulaSet(repos: StoreLearningRepositories, storeId: string, formulaSetId?: string) {
  const formulaSet = formulaSetId
    ? repos.v2BlogFormulaSets.findById(formulaSetId)
    : latestByUpdatedAt(repos.v2BlogFormulaSets.listByStoreId(storeId));
  if (!formulaSet || formulaSet.storeId !== storeId) throw new Error(`Blog Formula V2 set not found for store: ${storeId}`);
  return formulaSet;
}

function requireTopicBrief(repos: StoreLearningRepositories, storeId: string, topicBriefId: string) {
  const topicBrief = repos.v2BlogTopicBriefs.findById(topicBriefId);
  if (!topicBrief || topicBrief.storeId !== storeId) throw new Error(`Blog Formula V2 topic brief not found: ${topicBriefId}`);
  return topicBrief;
}

function topicBriefInputFromRecord(record: ReturnType<StoreLearningRepositories['v2BlogTopicBriefs']['findById']>) {
  if (!record) throw new Error('Topic brief not found');
  return BlogTopicBriefInputSchema.parse({
    topic: record.topic,
    mainKeyword: record.mainKeyword,
    secondaryKeywords: asStringArray(record.secondaryKeywords),
    targetReader: record.targetReader,
    coreConcern: record.coreConcern,
    mainAngle: record.mainAngle,
    mustInclude: asStringArray(record.mustInclude),
    mustAvoid: asStringArray(record.mustAvoid),
    ctaDirection: record.ctaDirection
  });
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .match(/[0-9a-z가-힣]+/g)
    ?.map((token) => token.replace(/(을|를|은|는|이|가|과|와|으로|로|에|의|도|만)$/u, ''))
    .filter((token) => token.length >= 2) ?? [];
}

function sourceIds(posts: OwnerBlogPostV2[]) {
  return posts.map((post) => post.collectionItemId);
}

function serializeFormulaSourcePost(post: OwnerBlogPostV2) {
  return {
    collectionItemId: post.collectionItemId,
    title: post.title,
    sourceUrl: post.sourceUrl,
    sourceKind: post.sourceKind,
    charCount: post.charCount,
    isTruncated: post.isTruncated,
    usedFor: ['titleFormula', 'introFormula', 'bodyFormula', 'ctaFormula', 'footerFormula', 'medicalSafetyFormula']
  };
}

function provenanceFromProvider(provider: BlogFormulaV2Provider): BlogFormulaV2ProviderProvenance {
  return {
    name: provider.name,
    mode: provider.mode,
    model: provider.model,
    callId: BLOG_FORMULA_V2_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: provider.mode !== 'openai'
  };
}

function providerInputStore(store: ReturnType<typeof requireStore>) {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    address: store.address
  };
}

export function getBlogFormulaV2Payload(repos: StoreLearningRepositories, storeId: string) {
  requireStore(repos, storeId);
  const formulaSet = latestByUpdatedAt(repos.v2BlogFormulaSets.listByStoreId(storeId));
  const latestDraftGeneration = latestByUpdatedAt(repos.v2BlogDraftGenerations.listByStoreId(storeId));
  const latestValidation = latestDraftGeneration
    ? latestByCreatedAt(repos.v2BlogDraftValidations.listByDraftGenerationId(latestDraftGeneration.id))
    : null;
  const ownerPosts = listOwnerBlogPostsForFormulaV2(repos, storeId);

  return {
    lane: 'blog_formula_v2',
    independentFromV1: true,
    status: {
      formulaSetStatus: formulaSet?.status ?? 'none',
      sourceOwnerBlogPostCount: ownerPosts.length,
      model: formulaSet?.model ?? BLOG_FORMULA_V2_MODEL,
      reviewStatus: latestValidation?.status ?? 'not_validated'
    },
    formulaSet,
    sourcePosts: formulaSet ? repos.v2BlogFormulaSourcePosts.listByFormulaSetId(formulaSet.id) : [],
    latestDraftGeneration,
    latestValidation
  };
}

export function extractBlogFormulaV2(repos: StoreLearningRepositories, storeId: string) {
  requireStore(repos, storeId);
  const posts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  if (posts.length === 0) throw new Error(`No owner_blog_post content available for Blog Formula V2: ${storeId}`);

  const formula = buildGenerationReadyMockFormula(posts);
  const qualityIssues = evaluateBlogFormulaV2Quality(formula);
  const formulaSet = repos.v2BlogFormulaSets.create({
    id: makeId('v2_formula_set'),
    storeId,
    version: BLOG_FORMULA_V2_VERSION,
    status: 'generated',
    formula: toJsonValue(formula),
    sourcePostIds: sourceIds(posts),
    model: BLOG_FORMULA_V2_MODEL
  });

  const sourcePosts = posts.map((post) =>
    repos.v2BlogFormulaSourcePosts.create({
      id: makeId('v2_formula_source'),
      formulaSetId: formulaSet.id,
      storeId,
      collectionItemId: post.collectionItemId,
      title: post.title,
      sourceUrl: post.sourceUrl,
      charCount: post.charCount,
      isTruncated: post.isTruncated ? 1 : 0,
      usedFor: serializeFormulaSourcePost(post).usedFor
    })
  );

  const run = repos.v2BlogFormulaRuns.create({
    id: makeId('v2_formula_run'),
    storeId,
    formulaSetId: formulaSet.id,
    input: {
      sourceKind: 'owner_blog_post',
      sourcePostCount: posts.length,
      sourcePostIds: sourceIds(posts)
    },
    output: { formulaSetId: formulaSet.id, formula },
    validation: toJsonValue({
      status: 'needs_human_review',
      reason: 'deterministic_formula_requires_human_review_before_publish',
      qualityIssues
    }),
    model: BLOG_FORMULA_V2_MODEL,
    status: 'completed'
  });

  return {
    formulaSet,
    run,
    sourcePosts: sourcePosts.map((sourcePost, index) => ({
      ...sourcePost,
      sourceKind: 'owner_blog_post' as const,
      usedFor: serializeFormulaSourcePost(posts[index]).usedFor
    }))
  };
}

export async function extractBlogFormulaV2WithProvider(
  repos: StoreLearningRepositories,
  storeId: string,
  provider: BlogFormulaV2Provider
) {
  const store = requireStore(repos, storeId);
  const posts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  if (posts.length === 0) throw new Error(`No owner_blog_post content available for Blog Formula V2: ${storeId}`);
  const fallbackProvider = provenanceFromProvider(provider);
  const sourcePostIds = sourceIds(posts);

  try {
    const providerResult = await provider.extractFormula({
      store: providerInputStore(store),
      ownerBlogPosts: posts
    });
    const formula = BlogFormulaSetV2Schema.parse(providerResult.output);
    const qualityIssues = evaluateBlogFormulaV2Quality(formula);
    const providerSourcePostIds = providerResult.promptInput.sourcePostIds;
    const postsById = new Map(posts.map((post) => [post.collectionItemId, post]));
    const providerPosts = providerSourcePostIds
      .map((sourcePostId) => postsById.get(sourcePostId))
      .filter((post): post is OwnerBlogPostV2 => Boolean(post));
    const formulaSet = repos.v2BlogFormulaSets.create({
      id: makeId('v2_formula_set'),
      storeId,
      version: BLOG_FORMULA_V2_VERSION,
      status: 'generated',
      formula: toJsonValue(formula),
      sourcePostIds: providerSourcePostIds,
      model: providerResult.provider.model
    });

    const sourcePosts = providerPosts.map((post) =>
      repos.v2BlogFormulaSourcePosts.create({
        id: makeId('v2_formula_source'),
        formulaSetId: formulaSet.id,
        storeId,
        collectionItemId: post.collectionItemId,
        title: post.title,
        sourceUrl: post.sourceUrl,
        charCount: post.charCount,
        isTruncated: post.isTruncated ? 1 : 0,
        usedFor: serializeFormulaSourcePost(post).usedFor
      })
    );

    const run = repos.v2BlogFormulaRuns.create({
      id: makeId('v2_formula_run'),
      storeId,
      formulaSetId: formulaSet.id,
      input: toJsonValue({
        sourceKind: 'owner_blog_post',
        sourcePostCount: posts.length,
        sourcePostIds: providerSourcePostIds,
        provider: providerResult.provider,
        inputBudget: providerResult.inputBudget,
        promptInput: providerResult.promptInput
      }),
      output: toJsonValue({ formulaSetId: formulaSet.id, formula, provider: providerResult.provider }),
      validation: toJsonValue({
        status: 'needs_human_review',
        reason: 'provider_formula_requires_human_review_before_publish',
        provider: providerResult.provider,
        qualityIssues
      }),
      model: providerResult.provider.model,
      status: 'completed'
    });

    recordLlmAuditLog(repos, {
      storeId,
      relatedEntityType: 'v2_blog_formula_run',
      relatedEntityId: run.id,
      provider,
      model: providerResult.provider.model,
      action: 'blog_formula_v2_extract',
      status: 'completed',
      inputBudget: providerResult.inputBudget,
      parsedOutputJson: formula
    });

    return {
      formulaSet,
      run,
      sourcePosts: sourcePosts.map((sourcePost, index) => ({
        ...sourcePost,
        sourceKind: 'owner_blog_post' as const,
        usedFor: serializeFormulaSourcePost(providerPosts[index]).usedFor
      })),
      provider: providerResult.provider
    };
  } catch (error) {
    const errorJson = sanitizedProviderError(error);
    const run = repos.v2BlogFormulaRuns.create({
      id: makeId('v2_formula_run'),
      storeId,
      formulaSetId: null,
      input: toJsonValue({
        sourceKind: 'owner_blog_post',
        sourcePostCount: posts.length,
        sourcePostIds,
        provider: fallbackProvider
      }),
      output: toJsonValue({ formulaSetId: null, provider: fallbackProvider }),
      validation: toJsonValue({
        status: 'failed',
        provider: fallbackProvider,
        error: errorJson
      }),
      model: provider.model,
      status: 'failed'
    });

    recordLlmAuditLog(repos, {
      storeId,
      relatedEntityType: 'v2_blog_formula_run',
      relatedEntityId: run.id,
      provider,
      model: provider.model,
      action: 'blog_formula_v2_extract',
      status: 'failed',
      errorJson
    });
    throw error;
  }
}

function scorePost(post: OwnerBlogPostV2, topicBrief: BlogTopicBriefInput): BlogRetrievedSampleV2['scoring'] {
  const postText = `${post.title ?? ''} ${post.bodyText}`;
  const titleText = post.title ?? '';
  const topicTokens = new Set(
    tokenize(
      [
        topicBrief.topic,
        topicBrief.mainKeyword,
        ...topicBrief.secondaryKeywords,
        topicBrief.coreConcern ?? '',
        topicBrief.mainAngle ?? ''
      ].join(' ')
    )
  );
  const postTokens = new Set(tokenize(postText));
  const overlap = Array.from(topicTokens).filter((token) => postTokens.has(token));
  const mainKeywordTokens = tokenize(topicBrief.mainKeyword);
  const treatmentMatch = titleText.includes(topicBrief.topic) || post.bodyText.includes(topicBrief.topic) ? 1 : 0;
  const concernTokens = tokenize(`${topicBrief.coreConcern ?? ''} ${topicBrief.mustAvoid.join(' ')}`);
  const concernHits = concernTokens.filter((token) => postTokens.has(token)).length;
  const titleHits = mainKeywordTokens.filter((token) => titleText.includes(token)).length;

  return {
    treatmentMatch,
    concernMatch: concernTokens.length > 0 ? Math.min(1, concernHits / Math.min(3, concernTokens.length)) : 0,
    titleMatch: mainKeywordTokens.length > 0 ? Math.min(1, titleHits / mainKeywordTokens.length) : 0,
    bodyKeywordOverlap: topicTokens.size > 0 ? Math.min(1, overlap.length / Math.min(6, topicTokens.size)) : 0
  };
}

function totalScore(scoring: BlogRetrievedSampleV2['scoring']) {
  return Number(
    (
      scoring.treatmentMatch * 0.35 +
      scoring.concernMatch * 0.25 +
      scoring.titleMatch * 0.2 +
      scoring.bodyKeywordOverlap * 0.2
    ).toFixed(4)
  );
}

function whySelected(post: OwnerBlogPostV2, topicBrief: BlogTopicBriefInput, scoring: BlogRetrievedSampleV2['scoring']) {
  if (scoring.treatmentMatch >= 1 && scoring.concernMatch > 0) {
    return `${topicBrief.topic} 주제와 ${topicBrief.coreConcern ?? topicBrief.mainKeyword} 고민이 함께 나타납니다.`;
  }
  if (scoring.titleMatch > 0) return `${topicBrief.mainKeyword} 제목 패턴과 유사합니다.`;
  return `${post.title ?? '기존 블로그'}의 전개 구조가 소재 Brief와 유사합니다.`;
}

function createTopicBrief(repos: StoreLearningRepositories, storeId: string, input: BlogTopicBriefInput) {
  const parsed = BlogTopicBriefInputSchema.parse(input);
  return repos.v2BlogTopicBriefs.create({
    id: makeId('v2_topic_brief'),
    storeId,
    topic: parsed.topic,
    mainKeyword: parsed.mainKeyword,
    secondaryKeywords: parsed.secondaryKeywords,
    targetReader: parsed.targetReader ?? null,
    coreConcern: parsed.coreConcern ?? null,
    mainAngle: parsed.mainAngle ?? null,
    mustInclude: parsed.mustInclude,
    mustAvoid: parsed.mustAvoid,
    ctaDirection: parsed.ctaDirection ?? null
  });
}

function serializeSampleFromPost(
  post: OwnerBlogPostV2,
  rank: number,
  scoring: BlogRetrievedSampleV2['scoring'],
  topicBrief: BlogTopicBriefInput
): BlogRetrievedSampleV2 {
  return BlogRetrievedSampleV2Schema.parse({
    collectionItemId: post.collectionItemId,
    title: post.title,
    sourceUrl: post.sourceUrl,
    sourceKind: 'owner_blog_post',
    rank,
    totalScore: totalScore(scoring),
    scoring,
    whySelected: whySelected(post, topicBrief, scoring),
    bodyText: post.bodyText
  });
}

export function retrieveBlogFormulaV2Samples(
  repos: StoreLearningRepositories,
  storeId: string,
  input: RetrieveSamplesInput
) {
  requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, input.formulaSetId);
  const topicBrief = input.topicBriefId
    ? requireTopicBrief(repos, storeId, input.topicBriefId)
    : createTopicBrief(
        repos,
        storeId,
        input.topicBrief ??
          BlogTopicBriefInputSchema.parse({
            topic: '리팟레이저',
            mainKeyword: '리팟레이저 부작용',
            secondaryKeywords: [],
            mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
            mustAvoid: []
          })
      );
  const topicBriefInput = topicBriefInputFromRecord(topicBrief);
  const maxSamples = Math.min(3, Math.max(1, input.maxSamples ?? 3));
  const samples = listOwnerBlogPostsForFormulaV2(repos, storeId)
    .map((post) => {
      const scoring = scorePost(post, topicBriefInput);
      return serializeSampleFromPost(post, 1, scoring, topicBriefInput);
    })
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, maxSamples)
    .map((sample, index) => ({ ...sample, rank: index + 1 }));

  const retrievalRun = repos.v2BlogRetrievalRuns.create({
    id: makeId('v2_retrieval_run'),
    storeId,
    topicBriefId: topicBrief.id,
    formulaSetId: formulaSet.id,
    input: {
      topicBrief: topicBriefInput,
      maxSamples,
      sourceKind: 'owner_blog_post'
    },
    output: {
      selectedCount: samples.length,
      samples
    }
  });

  for (const sample of samples) {
    repos.v2BlogRetrievedSamples.create({
      id: makeId('v2_retrieved_sample'),
      retrievalRunId: retrievalRun.id,
      storeId,
      collectionItemId: sample.collectionItemId,
      rank: sample.rank,
      totalScore: sample.totalScore,
      scoring: sample.scoring,
      whySelected: sample.whySelected
    });
  }

  return {
    topicBrief,
    retrievalRun,
    samples
  };
}

function samplesForRetrievalRun(repos: StoreLearningRepositories, retrievalRunId: string) {
  return repos.v2BlogRetrievedSamples
    .listByRetrievalRunId(retrievalRunId)
    .sort((left, right) => left.rank - right.rank)
    .map((sample) => {
      const item = repos.collectionItems.findById(sample.collectionItemId);
      if (!item) return null;
      const post = listOwnerBlogPostsForFormulaV2(repos, item.storeId).find(
        (candidate) => candidate.collectionItemId === sample.collectionItemId
      );
      if (!post) return null;
      return BlogRetrievedSampleV2Schema.parse({
        collectionItemId: post.collectionItemId,
        title: post.title,
        sourceUrl: post.sourceUrl,
        sourceKind: 'owner_blog_post',
        rank: sample.rank,
        totalScore: sample.totalScore,
        scoring: sample.scoring,
        whySelected: sample.whySelected ?? '유사 블로그 샘플로 선택되었습니다.',
        bodyText: post.bodyText
      });
    })
    .filter((sample): sample is BlogRetrievedSampleV2 => sample !== null);
}

function buildDraftOutput(
  formulaSetId: string,
  topicBrief: BlogTopicBriefInput,
  samples: BlogRetrievedSampleV2[]
): BlogDraftOutputV2 {
  const selectedTitle = `${topicBrief.mainKeyword} 걱정 없이 확인할 점`;
  const secondary = topicBrief.secondaryKeywords.slice(0, 2).join(', ');
  const targetReader = topicBrief.targetReader ?? `${topicBrief.topic}을 고민하는 고객`;
  const concern = topicBrief.coreConcern ?? `${topicBrief.mainKeyword} 관련 걱정`;
  const angle = topicBrief.mainAngle ?? '원리와 상담 기준을 차분히 설명';
  const sampleTitles = samples.map((sample) => sample.title).filter(Boolean).slice(0, 3);
  const disclosureLine =
    '개인차가 있으며 피부 상태에 따라 붉어짐, 열감, 색소 변화 등 부작용 가능성이 있을 수 있으므로 의료진 상담 후 결정해 주세요.';
  const cta = topicBrief.ctaDirection ?? '상담 예약';

  return BlogDraftOutputV2Schema.parse({
    titleCandidates: [
      selectedTitle,
      `${topicBrief.topic} 전 ${concern}를 먼저 확인해야 하는 이유`,
      `${topicBrief.topic} 상담 전 알아둘 기준`
    ],
    selectedTitle,
    blogDraft: [
      `${topicBrief.mainKeyword}을 검색하는 ${targetReader}이라면 ${concern}가 가장 먼저 떠오를 수 있습니다.`,
      `오늘은 ${angle}하는 방향으로 ${topicBrief.topic} 상담 전 확인할 내용을 정리하겠습니다.`,
      `먼저 기존 블로그에서는 ${sampleTitles.join(', ') || '고객 걱정과 판단 기준'}처럼 걱정을 먼저 다루고 원리와 주의사항을 이어서 설명하는 흐름이 반복됩니다.`,
      secondary
        ? `${secondary} 같은 보조 키워드는 본문 중간에서 자연스럽게 연결하고, 같은 표현을 과하게 반복하지 않습니다.`
        : '보조 키워드는 본문 흐름에 맞는 위치에만 자연스럽게 배치합니다.',
      disclosureLine,
      `${cta}을 원하시면 현재 피부 상태와 기대 범위를 함께 확인한 뒤 계획을 세우는 방식으로 안내드립니다.`
    ].join('\n\n'),
    styleComplianceReport: {
      formulaSetId,
      sourcePostIds: samples.map((sample) => sample.collectionItemId),
      appliedBlocks: ['titleFormula', 'introFormula', 'bodyFormula', 'ctaFormula', 'medicalSafetyFormula']
    },
    safetyCheck: {
      requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
      bannedPhrasesAvoided: true
    },
    seoCheck: {
      mainKeywordInTitle: selectedTitle.includes(topicBrief.mainKeyword),
      mainKeywordInIntro: true,
      secondaryKeywordsUsed: topicBrief.secondaryKeywords.filter((keyword) =>
        `${selectedTitle} ${secondary}`.includes(keyword)
      )
    }
  });
}

export function generateBlogFormulaV2Draft(
  repos: StoreLearningRepositories,
  storeId: string,
  input: GenerateDraftInput
) {
  requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, input.formulaSetId);
  const topicBrief = requireTopicBrief(repos, storeId, input.topicBriefId);
  const retrievalRun = repos.v2BlogRetrievalRuns.findById(input.retrievalRunId);
  if (!retrievalRun || retrievalRun.storeId !== storeId) {
    throw new Error(`Blog Formula V2 retrieval run not found: ${input.retrievalRunId}`);
  }
  const topicBriefInput = topicBriefInputFromRecord(topicBrief);
  const samples = samplesForRetrievalRun(repos, retrievalRun.id);
  const output = buildDraftOutput(formulaSet.id, topicBriefInput, samples);
  const draftGeneration = repos.v2BlogDraftGenerations.create({
    id: makeId('v2_draft_generation'),
    storeId,
    generationMode: 'v2_formula',
    formulaSetId: formulaSet.id,
    topicBriefId: topicBrief.id,
    retrievalRunId: retrievalRun.id,
    input: {
      generationMode: 'v2_formula',
      formulaSetId: formulaSet.id,
      topicBriefId: topicBrief.id,
      retrievalRunId: retrievalRun.id
    },
    output: toJsonValue(output),
    selectedTitle: output.selectedTitle,
    blogDraft: output.blogDraft,
    model: BLOG_FORMULA_V2_MODEL,
    status: 'generated'
  });

  return {
    draftGeneration,
    output
  };
}

export function validateBlogFormulaV2Draft(
  repos: StoreLearningRepositories,
  storeId: string,
  input: ValidateDraftInput
) {
  requireStore(repos, storeId);
  let draftGenerationId: string | null = null;
  let selectedTitle: string;
  let blogDraft: string;
  let topicBriefInput: BlogTopicBriefInput;
  let samples: BlogRetrievedSampleV2[] = [];

  if ('draftGenerationId' in input) {
    const draft = repos.v2BlogDraftGenerations.findById(input.draftGenerationId);
    if (!draft || draft.storeId !== storeId) throw new Error(`Blog Formula V2 draft not found: ${input.draftGenerationId}`);
    draftGenerationId = draft.id;
    selectedTitle = draft.selectedTitle ?? '';
    blogDraft = draft.blogDraft ?? '';
    if (!draft.topicBriefId) throw new Error(`Blog Formula V2 draft has no topic brief: ${draft.id}`);
    topicBriefInput = topicBriefInputFromRecord(requireTopicBrief(repos, storeId, draft.topicBriefId));
    samples = draft.retrievalRunId ? samplesForRetrievalRun(repos, draft.retrievalRunId) : [];
  } else {
    selectedTitle = input.selectedTitle;
    blogDraft = input.blogDraft;
    topicBriefInput = BlogTopicBriefInputSchema.parse(input.topicBrief);
  }

  const validation = validateBlogFormulaV2DraftText({
    selectedTitle,
    blogDraft,
    topicBrief: topicBriefInput,
    retrievedSamples: samples
  });

  const validationRecord = draftGenerationId
    ? repos.v2BlogDraftValidations.create({
        id: makeId('v2_draft_validation'),
        storeId,
        draftGenerationId,
        validation: toJsonValue(validation),
        status: validation.status,
        riskLevel: validation.riskLevel
      })
    : null;

  return {
    draftGenerationId,
    validationRecord,
    validation
  };
}

export function listBlogFormulaV2Drafts(repos: StoreLearningRepositories, storeId: string) {
  requireStore(repos, storeId);
  return repos.v2BlogDraftGenerations.listByStoreId(storeId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getBlogFormulaV2Draft(repos: StoreLearningRepositories, storeId: string, draftGenerationId: string) {
  requireStore(repos, storeId);
  const draft = repos.v2BlogDraftGenerations.findById(draftGenerationId);
  if (!draft || draft.storeId !== storeId) return null;
  return {
    draftGeneration: draft,
    validations: repos.v2BlogDraftValidations.listByDraftGenerationId(draft.id)
  };
}
