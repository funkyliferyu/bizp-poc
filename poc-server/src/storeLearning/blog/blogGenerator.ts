import { z } from 'zod';
import type { JsonValue } from '../../repositories/base.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { Store } from '../../repositories/stores.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

const BlogDraftSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1)
});

export const BlogDraftOutputSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1),
  bodySections: z.array(BlogDraftSectionSchema).min(3),
  seoKeywords: z.array(z.string().min(1)).min(1),
  cta: z.string().min(1),
  imagePrompts: z.array(z.string().min(1)).min(1),
  generatedFromRulesetId: z.string().min(1),
  generator: z.literal('mock_ruleset_blog_generator')
});

export type BlogDraftOutput = z.infer<typeof BlogDraftOutputSchema>;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeIdPart(value: string) {
  return value.replace(/[^0-9A-Za-z_-]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function latestRuleset(repos: Repositories, storeId: string) {
  const latestArtifacts = getLatestAnalysisArtifacts(repos, storeId);
  return latestArtifacts?.marketingRuleset ?? latestByUpdatedAt(repos.marketingRulesets.listByStoreId(storeId));
}

function asRecord(value: JsonValue | unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function splitCsv(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function fieldValue(fields: RulesetField[], keys: string[], fallback: string) {
  for (const key of keys) {
    const field = fields.find((item) => item.fieldKey === key);
    const value = field?.finalValue || field?.fieldValue || field?.aiValue;
    if (value) return value;
  }
  return fallback;
}

function seoKeywords(fields: RulesetField[], store: Store) {
  const keywordCsv = fieldValue(fields, ['seoKeywords', 'contentKeywords'], '');
  const fromFields = splitCsv(keywordCsv);
  const fallback = [store.name, '분당 케이크', '레터링 케이크', '당일 제작 케이크'];
  return unique([...fromFields, ...fallback]).slice(0, 6);
}

function buildDraft(store: Store, ruleset: MarketingRuleset, fields: RulesetField[]) {
  const keywords = seoKeywords(fields, store);
  const positioning = fieldValue(
    fields,
    ['storePositioning', 'positioning'],
    asRecord(ruleset.ruleset).positioning?.toString() || `${store.name} 블로그 운영`
  );
  const strengths = fieldValue(fields, ['keyStrengths', 'reviewStrength'], '당일 제작 상담, 커스텀 디자인, 친절한 픽업 안내');
  const targetCustomers = fieldValue(fields, ['targetCustomers'], '기념일 케이크를 찾는 고객');
  const tone = fieldValue(fields, ['toneAndManner'], '친절하고 구체적인 예약 안내형');
  const writingStyle = fieldValue(fields, ['blogWritingStyle'], '검색 유입형 블로그 문장');
  const cta = fieldValue(fields, ['ctaStyle'], '예약 가능 여부와 픽업 시간을 확인하도록 안내');
  const imageDirection = fieldValue(fields, ['imageDirection'], '케이크 디테일과 포장 상태를 보여주는 이미지');
  const primaryKeyword = keywords.find((keyword) => keyword.includes('케이크')) ?? keywords[0] ?? store.name;

  return BlogDraftOutputSchema.parse({
    title: `${primaryKeyword} 추천 - ${store.name} 예약 안내`,
    metaDescription: `${store.name}의 ${positioning} 특징과 예약 전 확인할 포인트를 정리했습니다.`,
    bodySections: [
      {
        heading: `${primaryKeyword}를 찾는 고객에게`,
        body: `${targetCustomers}에게 필요한 정보는 디자인, 픽업 시간, 주문 가능 여부입니다. ${store.name}은 ${positioning}이라는 장점을 중심으로 블로그 초안을 구성합니다.`
      },
      {
        heading: '고객 후기에서 반복되는 강점',
        body: `${strengths} 같은 신호가 반복되어 콘텐츠에서는 과장 없이 실제 주문 흐름과 상담 포인트를 먼저 안내합니다. 문장 톤은 ${tone}으로 유지합니다.`
      },
      {
        heading: '예약 전 확인하면 좋은 내용',
        body: `${writingStyle} 기준으로 제목과 본문에는 ${keywords.slice(0, 4).join(', ')} 키워드를 자연스럽게 포함합니다. 마지막에는 ${cta} 문장을 넣어 다음 행동을 분명하게 안내합니다.`
      }
    ],
    seoKeywords: keywords,
    cta,
    imagePrompts: [
      `${imageDirection} - 대표 이미지`,
      `${store.name} 레터링 케이크 디테일 이미지 placeholder`,
      `${store.name} 픽업 또는 포장 안내 이미지 placeholder`
    ],
    generatedFromRulesetId: ruleset.id,
    generator: 'mock_ruleset_blog_generator'
  });
}

function seoScoreForDraft(draft: BlogDraftOutput) {
  const keywordFit = Math.min(30, 20 + draft.seoKeywords.length);
  const readability = 22;
  const structure = draft.bodySections.length >= 3 ? 22 : 16;
  const localIntent = draft.seoKeywords.some((keyword) => keyword.includes('분당')) ? 18 : 12;
  return Math.min(100, keywordFit + readability + structure + localIntent);
}

export function generateApprovalPendingBlogPost(repos: Repositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) throw new Error(`Store not found: ${storeId}`);
  const ruleset = latestRuleset(repos, store.id);
  if (!ruleset) throw new Error(`Marketing ruleset not found for store: ${store.id}`);
  const fields = repos.rulesetFields.listByRulesetId(ruleset.id);
  const draft = buildDraft(store, ruleset, fields);
  const timestamp = nowIso();
  const idSuffix = `${Date.now()}_${sanitizeIdPart(store.id)}`;
  const generationId = `content_generation_blog_${idSuffix}`;
  const blogPostId = `blog_post_${idSuffix}`;
  const score = seoScoreForDraft(draft);

  const contentGeneration = repos.contentGenerations.create({
    id: generationId,
    storeId: store.id,
    rulesetId: ruleset.id,
    status: 'generated',
    contentType: 'blog_post',
    prompt: {
      mode: 'mock',
      generator: draft.generator,
      rulesetId: ruleset.id,
      fieldKeys: fields.map((field) => field.fieldKey)
    },
    output: draft,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const blogPost = repos.blogPosts.create({
    id: blogPostId,
    storeId: store.id,
    contentGenerationId: contentGeneration.id,
    status: 'pending_approval',
    title: draft.title,
    article: {
      ...draft,
      status: 'pending_approval'
    },
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const mediaAssets = draft.imagePrompts.map((prompt, index) =>
    repos.mediaAssets.create({
      id: `media_asset_${blogPost.id}_${index + 1}`,
      storeId: store.id,
      blogPostId: blogPost.id,
      assetType: 'image_prompt',
      status: 'placeholder',
      url: null,
      metadata: {
        prompt,
        placement: index === 0 ? 'cover' : `body_${index}`,
        generator: draft.generator,
        note: 'BLOG-001 placeholder only; no image generation performed'
      },
      createdAt: timestamp,
      updatedAt: timestamp
    })
  );
  const seoScore = repos.seoScores.create({
    id: `seo_score_${blogPost.id}`,
    blogPostId: blogPost.id,
    score,
    totalScore: score,
    status: 'scored',
    rubric: {
      keywordFit: Math.min(30, 20 + draft.seoKeywords.length),
      readability: 22,
      structure: draft.bodySections.length >= 3 ? 22 : 16,
      localIntent: draft.seoKeywords.some((keyword) => keyword.includes('분당')) ? 18 : 12
    },
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return {
    contentGeneration,
    blogPost: serializeBlogPost(repos, blogPost.id),
    mediaAssets,
    seoScore
  };
}

export function serializeBlogPost(repos: Repositories, postId: string) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const article = asRecord(post.article);
  const seoScore = latestByUpdatedAt(repos.seoScores.listByBlogPostId(post.id));
  const mediaAssets = repos.mediaAssets.listByBlogPostId(post.id);
  return {
    id: post.id,
    storeId: post.storeId,
    contentGenerationId: post.contentGenerationId,
    status: post.status,
    title: post.title,
    article,
    generatedFromRulesetId: article.generatedFromRulesetId?.toString() ?? null,
    metaDescription: article.metaDescription?.toString() ?? null,
    seoKeywords: Array.isArray(article.seoKeywords) ? article.seoKeywords.filter((item): item is string => typeof item === 'string') : [],
    cta: article.cta?.toString() ?? null,
    seoScore: seoScore?.score ?? null,
    mediaAssetCount: mediaAssets.length,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedUrl: post.publishedUrl,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt
  };
}

export function listBlogPostsForStore(repos: Repositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;
  const posts = repos.blogPosts
    .listByStoreId(store.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((post) => serializeBlogPost(repos, post.id))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));

  return {
    store: {
      id: store.id,
      name: store.name
    },
    posts,
    pendingApprovalCount: posts.filter((post) => post.status === 'pending_approval').length
  };
}

export function getBlogPostDetail(repos: Repositories, postId: string) {
  const blogPost = serializeBlogPost(repos, postId);
  if (!blogPost) return null;
  const contentGeneration = blogPost.contentGenerationId
    ? repos.contentGenerations.findById(blogPost.contentGenerationId)
    : null;
  const mediaAssets = repos.mediaAssets.listByBlogPostId(blogPost.id);
  const seoScore = latestByUpdatedAt(repos.seoScores.listByBlogPostId(blogPost.id));
  return {
    blogPost,
    contentGeneration,
    mediaAssets,
    seoScore
  };
}
