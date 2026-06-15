import { randomUUID } from 'node:crypto';
import type { JsonValue } from '../../repositories/base.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { V2BlogTopicBriefSet } from '../../repositories/v2_blog_formula.js';
import { recordLlmAuditLog } from '../llmAudit/llmAuditRecorder.js';
import { sanitizedProviderError } from '../llmAudit/llmAuditMetadata.js';
import {
  BLOG_FORMULA_V2_MODEL,
  BLOG_FORMULA_V2_VERSION,
  BlogFormulaSetV2Schema,
  BlogRetrievedSampleV2Schema,
  BlogTopicBriefInputSchema,
  TopicBriefSetV2Schema,
  parseStoredBlogFormulaV2,
  type BlogDraftOutputV2,
  type BlogDraftValidationResultV2,
  type BlogFormulaSetV2,
  type BlogRetrievedSampleV2,
  type BlogTopicBriefInput,
  type TopicBriefSetCandidate,
  type TopicBriefSetV2
} from './types.js';
import { BLOG_FORMULA_V2_CALL_ID, BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION } from './blogFormulaPrompt.js';
import {
  BLOG_FORMULA_V2_DRAFT_CALL_ID,
  BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION
} from './blogDraftPrompt.js';
import { assembleDraftOutput, buildDeterministicDraftCreative, deriveDraftReports } from './draftOutput.js';
import { evaluateBlogFormulaV2Quality } from './formulaQuality.js';
import { buildGenerationReadyMockFormula } from './mockFormulaBuilder.js';
import type {
  BlogFormulaV2Provider,
  BlogFormulaV2ProviderProvenance
} from './providers/blogFormulaV2Provider.js';
import type {
  BlogDraftV2Provider,
  BlogDraftV2ProviderProvenance
} from './providers/blogDraftV2Provider.js';
import { listOwnerBlogPostsForFormulaV2, type OwnerBlogPostV2 } from './sourcePosts.js';
import { analyzeSelfIntroductionPatterns } from './selfIntroductionPatterns.js';
import { validateBlogFormulaV2DraftText } from './validator.js';
import { buildHeuristicTopicBriefSets } from './topicBriefSetHeuristic.js';
import { TOPIC_BRIEF_SET_BATCH_SIZE, type TopicBriefSetPromptStore } from './topicBriefSetPrompt.js';
import type {
  TopicBriefSetExtractProviderMode,
  TopicBriefSetProvider
} from './providers/topicBriefSetProvider.js';

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

function representativeKeywordsFromStore(store: ReturnType<typeof requireStore>): string[] {
  const metadata = store.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return asStringArray((metadata as Record<string, JsonValue>).representativeKeywords);
}

function topicBriefSetStore(store: ReturnType<typeof requireStore>): TopicBriefSetPromptStore {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    representativeKeywords: representativeKeywordsFromStore(store)
  };
}

function serializeTopicBriefSet(record: V2BlogTopicBriefSet): TopicBriefSetV2 {
  return TopicBriefSetV2Schema.parse({
    id: record.id,
    sourcePostIds: [record.sourcePostId],
    confidence: record.confidence,
    status: record.status,
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

function readProviderMode(output: JsonValue | undefined | null): string | undefined {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
  const provider = (output as Record<string, JsonValue>).provider;
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return undefined;
  const mode = (provider as Record<string, JsonValue>).mode;
  return typeof mode === 'string' ? mode : undefined;
}

async function produceTopicBriefSetCandidates(
  store: ReturnType<typeof requireStore>,
  posts: OwnerBlogPostV2[],
  provider: TopicBriefSetProvider | null
): Promise<TopicBriefSetCandidate[]> {
  const promptStore = topicBriefSetStore(store);
  if (!provider) return buildHeuristicTopicBriefSets(promptStore, posts);
  const result = await provider.extractTopicBriefSets({ store: promptStore, posts });
  return result.sets;
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
  const topicBriefSetRows = formulaSet ? repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id) : [];
  const topicBriefSets = topicBriefSetRows.map(serializeTopicBriefSet);
  const coveredPostCount = new Set(topicBriefSetRows.map((row) => row.sourcePostId)).size;
  const topicBriefSetRemainingCount = formulaSet ? Math.max(0, ownerPosts.length - coveredPostCount) : 0;

  return {
    lane: 'blog_formula_v2',
    independentFromV1: true,
    status: {
      formulaSetStatus: formulaSet?.status ?? 'none',
      sourceOwnerBlogPostCount: ownerPosts.length,
      model: formulaSet?.model ?? BLOG_FORMULA_V2_MODEL,
      reviewStatus: latestValidation?.status ?? 'not_validated',
      topicBriefSetRemainingCount
    },
    formulaSet,
    sourcePosts: formulaSet ? repos.v2BlogFormulaSourcePosts.listByFormulaSetId(formulaSet.id) : [],
    topicBriefSets,
    latestDraftGeneration,
    latestValidation
  };
}

export function extractBlogFormulaV2(repos: StoreLearningRepositories, storeId: string) {
  const store = requireStore(repos, storeId);
  const posts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  if (posts.length === 0) throw new Error(`No owner_blog_post content available for Blog Formula V2: ${storeId}`);

  const formula = buildGenerationReadyMockFormula(posts);
  formula.introFormula.selfIntroductionPatterns = analyzeSelfIntroductionPatterns(posts, store.name);
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
    // Self-introduction patterns are discovered deterministically from the
    // store's own post history, not left to the model.
    formula.introFormula.selfIntroductionPatterns = analyzeSelfIntroductionPatterns(posts, store.name);
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

export function getTopicBriefSetProviderModeForStore(
  repos: StoreLearningRepositories,
  storeId: string,
  formulaSetId?: string
): TopicBriefSetExtractProviderMode | undefined {
  const formulaSet = requireFormulaSet(repos, storeId, formulaSetId);
  const latestRun = latestByCreatedAt(repos.v2BlogFormulaRuns.listByFormulaSetId(formulaSet.id));
  const mode = readProviderMode(latestRun?.output);
  if (mode === 'safe_mock' || mode === 'openai' || mode === 'deterministic') return mode;
  return undefined;
}

type ExtendTopicBriefSetsOptions = {
  formulaSetId?: string;
  provider?: TopicBriefSetProvider | null;
};

// SL-F2 topic-brief extraction is intentionally best-effort and has no audit/run
// trace of its own: callers (the /extract and /topic-brief-sets/extend routes)
// invoke this so that a provider error just propagates and leaves the library
// partial and retryable, rather than failing the surrounding formula flow.
export async function extendBlogFormulaV2TopicBriefSets(
  repos: StoreLearningRepositories,
  storeId: string,
  options: ExtendTopicBriefSetsOptions = {}
) {
  const store = requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, options.formulaSetId);
  const allPosts = listOwnerBlogPostsForFormulaV2(repos, storeId);
  const existing = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id);
  const covered = new Set(existing.map((row) => row.sourcePostId));
  const remaining = allPosts.filter((post) => !covered.has(post.collectionItemId));
  const batch = remaining.slice(0, TOPIC_BRIEF_SET_BATCH_SIZE);

  if (batch.length === 0) {
    return {
      added: [] as TopicBriefSetV2[],
      topicBriefSets: existing.map(serializeTopicBriefSet),
      remainingCount: 0
    };
  }

  const candidates = await produceTopicBriefSetCandidates(store, batch, options.provider ?? null);
  const added = candidates
    .filter((candidate) => candidate.sourcePostIds.length > 0)
    .map((candidate) =>
      serializeTopicBriefSet(
        repos.v2BlogTopicBriefSets.create({
          id: makeId('v2_topic_brief_set'),
          formulaSetId: formulaSet.id,
          storeId,
          sourcePostId: candidate.sourcePostIds[0],
          topic: candidate.topic,
          mainKeyword: candidate.mainKeyword,
          secondaryKeywords: candidate.secondaryKeywords,
          targetReader: candidate.targetReader,
          coreConcern: candidate.coreConcern,
          mainAngle: candidate.mainAngle,
          mustInclude: candidate.mustInclude,
          mustAvoid: candidate.mustAvoid,
          ctaDirection: candidate.ctaDirection,
          confidence: candidate.confidence,
          status: candidate.status
        })
      )
    );

  // Recompute coverage from the persisted rows (distinct sourcePostId) so the
  // count stays correct even when a provider returns fewer or duplicate sets
  // than the batch size. This matches getBlogFormulaV2Payload's basis exactly.
  const allRows = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id);
  const coveredPostCount = new Set(allRows.map((row) => row.sourcePostId)).size;
  return {
    added,
    topicBriefSets: allRows.map(serializeTopicBriefSet),
    remainingCount: Math.max(0, allPosts.length - coveredPostCount)
  };
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
  formula: BlogFormulaSetV2,
  topicBrief: BlogTopicBriefInput,
  samples: BlogRetrievedSampleV2[],
  storeName: string
): BlogDraftOutputV2 {
  const creative = buildDeterministicDraftCreative(formula, topicBrief, samples, storeName);
  const reports = deriveDraftReports({
    formulaSetId,
    formula,
    topicBrief,
    samples,
    selectedTitle: creative.selectedTitle,
    blogDraft: creative.blogDraft
  });
  return assembleDraftOutput(creative, reports);
}

export function generateBlogFormulaV2Draft(
  repos: StoreLearningRepositories,
  storeId: string,
  input: GenerateDraftInput
) {
  const store = requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, input.formulaSetId);
  const topicBrief = requireTopicBrief(repos, storeId, input.topicBriefId);
  const retrievalRun = repos.v2BlogRetrievalRuns.findById(input.retrievalRunId);
  if (!retrievalRun || retrievalRun.storeId !== storeId) {
    throw new Error(`Blog Formula V2 retrieval run not found: ${input.retrievalRunId}`);
  }
  const topicBriefInput = topicBriefInputFromRecord(topicBrief);
  const samples = samplesForRetrievalRun(repos, retrievalRun.id);
  const formula = parseStoredBlogFormulaV2(formulaSet.formula);
  const output = buildDraftOutput(formulaSet.id, formula, topicBriefInput, samples, store.name);
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

function draftProvenanceFromProvider(provider: BlogDraftV2Provider): BlogDraftV2ProviderProvenance {
  return {
    name: provider.name,
    mode: provider.mode,
    model: provider.model,
    callId: BLOG_FORMULA_V2_DRAFT_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
    noExternalCalls: provider.mode !== 'openai'
  };
}

export async function generateBlogFormulaV2DraftWithProvider(
  repos: StoreLearningRepositories,
  storeId: string,
  input: GenerateDraftInput,
  provider: BlogDraftV2Provider
) {
  const store = requireStore(repos, storeId);
  const formulaSet = requireFormulaSet(repos, storeId, input.formulaSetId);
  const topicBrief = requireTopicBrief(repos, storeId, input.topicBriefId);
  const retrievalRun = repos.v2BlogRetrievalRuns.findById(input.retrievalRunId);
  if (!retrievalRun || retrievalRun.storeId !== storeId) {
    throw new Error(`Blog Formula V2 retrieval run not found: ${input.retrievalRunId}`);
  }
  const topicBriefInput = topicBriefInputFromRecord(topicBrief);
  const samples = samplesForRetrievalRun(repos, retrievalRun.id);
  const formula = parseStoredBlogFormulaV2(formulaSet.formula);

  try {
    const providerResult = await provider.generateDraft({
      store: providerInputStore(store),
      formula,
      topicBrief: topicBriefInput,
      samples
    });
    const reports = deriveDraftReports({
      formulaSetId: formulaSet.id,
      formula,
      topicBrief: topicBriefInput,
      samples,
      selectedTitle: providerResult.creative.selectedTitle,
      blogDraft: providerResult.creative.blogDraft
    });
    const output = assembleDraftOutput(providerResult.creative, reports, providerResult.modelReportedCompliance);
    const draftGeneration = repos.v2BlogDraftGenerations.create({
      id: makeId('v2_draft_generation'),
      storeId,
      generationMode: 'v2_formula',
      formulaSetId: formulaSet.id,
      topicBriefId: topicBrief.id,
      retrievalRunId: retrievalRun.id,
      input: toJsonValue({
        generationMode: 'v2_formula',
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id,
        provider: providerResult.provider,
        inputBudget: providerResult.inputBudget,
        promptInput: providerResult.promptInput
      }),
      output: toJsonValue(output),
      selectedTitle: output.selectedTitle,
      blogDraft: output.blogDraft,
      model: providerResult.provider.model,
      status: 'generated'
    });

    recordLlmAuditLog(repos, {
      storeId,
      relatedEntityType: 'v2_blog_draft_generation',
      relatedEntityId: draftGeneration.id,
      provider,
      model: providerResult.provider.model,
      action: 'blog_formula_v2_generate_draft',
      status: 'completed',
      inputBudget: providerResult.inputBudget,
      parsedOutputJson: output
    });

    return {
      draftGeneration,
      output,
      provider: providerResult.provider
    };
  } catch (error) {
    const errorJson = sanitizedProviderError(error);
    const fallbackProvider = draftProvenanceFromProvider(provider);
    const draftGeneration = repos.v2BlogDraftGenerations.create({
      id: makeId('v2_draft_generation'),
      storeId,
      generationMode: 'v2_formula',
      formulaSetId: formulaSet.id,
      topicBriefId: topicBrief.id,
      retrievalRunId: retrievalRun.id,
      input: toJsonValue({
        generationMode: 'v2_formula',
        formulaSetId: formulaSet.id,
        topicBriefId: topicBrief.id,
        retrievalRunId: retrievalRun.id,
        provider: fallbackProvider
      }),
      output: toJsonValue({ provider: fallbackProvider, error: errorJson }),
      selectedTitle: null,
      blogDraft: null,
      model: provider.model,
      status: 'failed'
    });

    recordLlmAuditLog(repos, {
      storeId,
      relatedEntityType: 'v2_blog_draft_generation',
      relatedEntityId: draftGeneration.id,
      provider,
      model: provider.model,
      action: 'blog_formula_v2_generate_draft',
      status: 'failed',
      errorJson
    });
    throw error;
  }
}

export function validateBlogFormulaV2Draft(
  repos: StoreLearningRepositories,
  storeId: string,
  input: ValidateDraftInput
) {
  const store = requireStore(repos, storeId);
  let draftGenerationId: string | null = null;
  let selectedTitle: string;
  let blogDraft: string;
  let topicBriefInput: BlogTopicBriefInput;
  let samples: BlogRetrievedSampleV2[] = [];
  let formula: BlogFormulaSetV2 | null = null;

  if ('draftGenerationId' in input) {
    const draft = repos.v2BlogDraftGenerations.findById(input.draftGenerationId);
    if (!draft || draft.storeId !== storeId) throw new Error(`Blog Formula V2 draft not found: ${input.draftGenerationId}`);
    draftGenerationId = draft.id;
    selectedTitle = draft.selectedTitle ?? '';
    blogDraft = draft.blogDraft ?? '';
    if (!draft.topicBriefId) throw new Error(`Blog Formula V2 draft has no topic brief: ${draft.id}`);
    topicBriefInput = topicBriefInputFromRecord(requireTopicBrief(repos, storeId, draft.topicBriefId));
    samples = draft.retrievalRunId ? samplesForRetrievalRun(repos, draft.retrievalRunId) : [];
    const formulaSet = draft.formulaSetId ? repos.v2BlogFormulaSets.findById(draft.formulaSetId) : null;
    formula = formulaSet ? parseStoredBlogFormulaV2(formulaSet.formula) : null;
  } else {
    selectedTitle = input.selectedTitle;
    blogDraft = input.blogDraft;
    topicBriefInput = BlogTopicBriefInputSchema.parse(input.topicBrief);
  }

  const validation = validateBlogFormulaV2DraftText({
    selectedTitle,
    blogDraft,
    topicBrief: topicBriefInput,
    retrievedSamples: samples,
    selfIntroductionPatterns: formula?.introFormula.selfIntroductionPatterns,
    storeName: store.name
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
