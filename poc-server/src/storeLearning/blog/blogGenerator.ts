import { z } from 'zod';
import type { JsonValue } from '../../repositories/base.js';
import type { BlogPost } from '../../repositories/blog_posts.js';
import type { MediaAsset } from '../../repositories/media_assets.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { SeoScore } from '../../repositories/seo_scores.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { Store } from '../../repositories/stores.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';
import {
  BlogDraftSectionSchema,
  BlogProviderDraftOutputSchema,
  SeoScoreOutputSchema,
  SeoScoreRubricSchema,
  type BlogContentProvider,
  type SeoScoreOutput
} from './blogProvider.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

export const BlogDraftOutputSchema = z.object({
  title: z.string().min(1),
  metaDescription: z.string().min(1),
  bodySections: z.array(BlogDraftSectionSchema).min(3),
  seoKeywords: z.array(z.string().min(1)).min(1),
  cta: z.string().min(1),
  imagePrompts: z.array(z.string().min(1)).min(1),
  generatedFromRulesetId: z.string().min(1),
  generator: z.enum(['mock_ruleset_blog_generator', 'openai_blog_provider'])
});

export type BlogDraftOutput = z.infer<typeof BlogDraftOutputSchema>;

type NormalizedArticle = {
  title: string;
  metaDescription: string;
  bodySections: Array<{ heading: string; body: string }>;
  bodyText: string;
  seoKeywords: string[];
  cta: string;
  imagePrompts: string[];
  generatedFromRulesetId: string | null;
  revisions: Array<Record<string, JsonValue>>;
};

type ProviderDraft = {
  draft: BlogDraftOutput;
  seoScore: SeoScoreOutput | null;
};

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

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function normalizedArticle(post: BlogPost): NormalizedArticle {
  const article = asRecord(post.article);
  const rawSections = jsonArray(article.bodySections);
  const bodySections = rawSections
    .map((section) => {
      const record = asRecord(section);
      return {
        heading: asString(record.heading),
        body: asString(record.body)
      };
    })
    .filter((section) => section.heading || section.body);

  const blocks = jsonArray(article.blocks).map((block) => asRecord(block));
  if (bodySections.length === 0 && blocks.length > 0) {
    const heading = asString(blocks.find((block) => block.type === 'heading')?.text) || post.title;
    const paragraphs = blocks
      .filter((block) => block.type !== 'heading')
      .map((block) => asString(block.text))
      .filter(Boolean);
    bodySections.push({
      heading,
      body: paragraphs.join('\n') || asString(article.body) || post.title
    });
  }

  if (bodySections.length === 0) {
    bodySections.push({
      heading: post.title,
      body: asString(article.body) || asString(article.bodyText) || post.title
    });
  }

  const bodyText = bodySections.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
  const seoKeywords = jsonArray(article.seoKeywords)
    .map((keyword) => asString(keyword).trim())
    .filter(Boolean);
  const fallbackKeywords = unique([
    ...post.title.split(/[ -]+/).filter((token) => token.includes('케이크') || token.includes('분당')),
    '분당 케이크',
    '레터링 케이크'
  ]);
  const imagePrompts = jsonArray(article.imagePrompts)
    .map((prompt) => asString(prompt).trim())
    .filter(Boolean);
  const revisions = jsonArray(article.revisions)
    .map((revision) => asRecord(revision))
    .filter((revision) => Object.keys(revision).length > 0) as Array<Record<string, JsonValue>>;

  return {
    title: asString(article.title) || post.title,
    metaDescription:
      asString(article.metaDescription) || bodySections[0]?.body.slice(0, 110) || `${post.title} 블로그 초안입니다.`,
    bodySections,
    bodyText,
    seoKeywords: unique([...seoKeywords, ...fallbackKeywords]).slice(0, 8),
    cta: asString(article.cta) || '예약 가능 여부와 픽업 시간을 확인해 주세요.',
    imagePrompts,
    generatedFromRulesetId: asString(article.generatedFromRulesetId) || null,
    revisions
  };
}

function promptFromAsset(asset: MediaAsset) {
  const metadata = asRecord(asset.metadata);
  return asset.prompt || asString(metadata.prompt) || asString(metadata.alt) || `${asset.assetType} placeholder`;
}

function serializeMediaAsset(asset: MediaAsset) {
  const metadata = asRecord(asset.metadata);
  const prompt = promptFromAsset(asset);
  return {
    ...asset,
    prompt,
    alt: asString(metadata.alt) || prompt,
    placement: asString(metadata.placement) || null
  };
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

function providerDraftFromOutput(output: unknown, rulesetId: string): ProviderDraft {
  const parsed = BlogProviderDraftOutputSchema.parse(output);
  const draft = BlogDraftOutputSchema.parse({
    ...parsed,
    generatedFromRulesetId: rulesetId,
    generator: 'openai_blog_provider'
  });
  return {
    draft,
    seoScore: parsed.seoScore ?? null
  };
}

function seoScoreForDraft(draft: BlogDraftOutput) {
  const keywordFit = Math.min(30, 20 + draft.seoKeywords.length);
  const readability = 22;
  const structure = draft.bodySections.length >= 3 ? 22 : 16;
  const localIntent = draft.seoKeywords.some((keyword) => keyword.includes('분당')) ? 18 : 12;
  return Math.min(100, keywordFit + readability + structure + localIntent);
}

function seoRubricForDraft(draft: BlogDraftOutput) {
  return {
    keywordFit: Math.min(30, 20 + draft.seoKeywords.length),
    readability: 22,
    structure: draft.bodySections.length >= 3 ? 22 : 16,
    localIntent: draft.seoKeywords.some((keyword) => keyword.includes('분당')) ? 18 : 12
  };
}

function itemizedStoredRubric(value: JsonValue | unknown) {
  const parsed = SeoScoreRubricSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function scoreBlogPost(post: BlogPost, mediaAssets: MediaAsset[]) {
  const article = normalizedArticle(post);
  const keyword = article.seoKeywords.find((item) => post.title.includes(item)) ?? article.seoKeywords[0] ?? '케이크';
  const titleKeywordScore = post.title.includes(keyword) || post.title.includes('분당') ? 18 : 12;
  const bodyKeywordHits = article.seoKeywords.filter((item) => article.bodyText.includes(item)).length;
  const bodyKeywordScore = Math.min(20, 12 + bodyKeywordHits * 2);
  const metaLength = article.metaDescription.length;
  const metaDescriptionScore = metaLength >= 45 && metaLength <= 140 ? 14 : metaLength > 0 ? 10 : 4;
  const averageSectionLength =
    article.bodySections.reduce((total, section) => total + section.body.length, 0) / article.bodySections.length;
  const readabilityScore = averageSectionLength >= 35 && averageSectionLength <= 220 ? 14 : 11;
  const promptedAssets = mediaAssets.filter((asset) => promptFromAsset(asset).length > 0).length;
  const imageAltPromptScore = Math.min(15, 8 + promptedAssets * 2);
  const ctaScore = article.cta.length > 0 || /예약|문의|확인/.test(article.bodyText) ? 14 : 8;

  return SeoScoreOutputSchema.parse({
    totalScore: Math.min(
      100,
      titleKeywordScore +
        bodyKeywordScore +
        metaDescriptionScore +
        readabilityScore +
        imageAltPromptScore +
        ctaScore
    ),
    rubric: {
      titleKeyword: {
        label: '제목 키워드',
        score: titleKeywordScore,
        maxScore: 20,
        feedback: `${keyword} 중심 키워드가 제목에 반영되어 있습니다.`
      },
      bodyKeyword: {
        label: '본문 키워드',
        score: bodyKeywordScore,
        maxScore: 20,
        feedback: `본문에 ${bodyKeywordHits}개의 주요 키워드가 자연스럽게 포함되어 있습니다.`
      },
      metaDescription: {
        label: '메타 설명',
        score: metaDescriptionScore,
        maxScore: 15,
        feedback: '검색 결과에서 보일 요약 문장이 포함되어 있습니다.'
      },
      readability: {
        label: '가독성',
        score: readabilityScore,
        maxScore: 15,
        feedback: '문단 길이와 흐름이 블로그 초안 검토에 적합합니다.'
      },
      imageAltPrompt: {
        label: '이미지 ALT/프롬프트',
        score: imageAltPromptScore,
        maxScore: 15,
        feedback: '이미지 프롬프트 placeholder가 발행 전 검토 가능한 형태로 준비되어 있습니다.'
      },
      cta: {
        label: 'CTA',
        score: ctaScore,
        maxScore: 15,
        feedback: '예약/문의로 이어지는 행동 유도 문장이 포함되어 있습니다.'
      }
    }
  });
}

function createSeoScore(repos: Repositories, post: BlogPost, mediaAssets: MediaAsset[], override?: SeoScoreOutput | null) {
  const scored = override ?? scoreBlogPost(post, mediaAssets);
  const timestamp = nowIso();
  const sequence = repos.seoScores.listByBlogPostId(post.id).length + 1;
  return repos.seoScores.create({
    id: `seo_score_${post.id}_${sequence}_${Date.now()}`,
    blogPostId: post.id,
    score: scored.totalScore,
    totalScore: scored.totalScore,
    status: 'scored',
    rubric: scored.rubric,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function serializeSeoScore(score: SeoScore | null, post: BlogPost, mediaAssets: MediaAsset[]) {
  const scored = scoreBlogPost(post, mediaAssets);
  const storedRubric = itemizedStoredRubric(score?.rubric);
  return {
    id: score?.id ?? null,
    blogPostId: post.id,
    score: score?.score ?? scored.totalScore,
    totalScore: score?.totalScore ?? score?.score ?? scored.totalScore,
    status: score?.status ?? 'scored',
    rubric: storedRubric ?? scored.rubric,
    createdAt: score?.createdAt ?? null,
    updatedAt: score?.updatedAt ?? null
  };
}

function previewHtml(post: BlogPost, mediaAssets: MediaAsset[]) {
  const article = normalizedArticle(post);
  const media = mediaAssets.map(serializeMediaAsset);
  const bodyHtml = article.bodySections
    .map((section, index) => {
      const prompt = media[index]?.prompt;
      const imageHtml = prompt
        ? `<div class="preview-image">${escapeHtml(prompt)}</div>`
        : '';
      return `<h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>${imageHtml}`;
    })
    .join('');

  return {
    title: post.title,
    metaDescription: article.metaDescription,
    html: `<article class="blog-preview"><h1>${escapeHtml(post.title)}</h1><p class="meta">${escapeHtml(
      article.metaDescription
    )}</p>${bodyHtml}<p class="cta">${escapeHtml(article.cta)}</p></article>`,
    mediaAssets: media
  };
}

export async function generateApprovalPendingBlogPost(
  repos: Repositories,
  storeId: string,
  provider?: BlogContentProvider | null
) {
  const store = repos.stores.findById(storeId);
  if (!store) throw new Error(`Store not found: ${storeId}`);
  const ruleset = latestRuleset(repos, store.id);
  if (!ruleset) throw new Error(`Marketing ruleset not found for store: ${store.id}`);
  const fields = repos.rulesetFields.listByRulesetId(ruleset.id);
  const providerDraft = provider
    ? providerDraftFromOutput(
        await provider.generateDraft({
          action: 'generate_blog_post',
          store,
          ruleset,
          rulesetFields: fields
        }),
        ruleset.id
      )
    : null;
  const draft = providerDraft?.draft ?? buildDraft(store, ruleset, fields);
  const providerSeoScore = providerDraft?.seoScore ?? null;
  const timestamp = nowIso();
  const idSuffix = `${Date.now()}_${sanitizeIdPart(store.id)}`;
  const generationId = `content_generation_blog_${idSuffix}`;
  const blogPostId = `blog_post_${idSuffix}`;
  const score = providerSeoScore?.totalScore ?? seoScoreForDraft(draft);
  const rubric = providerSeoScore?.rubric ?? seoRubricForDraft(draft);

  const contentGeneration = repos.contentGenerations.create({
    id: generationId,
    storeId: store.id,
    rulesetId: ruleset.id,
    status: 'generated',
    contentType: 'blog_post',
    prompt: {
      mode: provider?.mode ?? 'mock',
      provider: provider?.name ?? null,
      generator: draft.generator,
      rulesetId: ruleset.id,
      fieldKeys: fields.map((field) => field.fieldKey)
    },
    output: providerSeoScore ? { ...draft, seoScore: providerSeoScore } : draft,
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
      prompt,
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
    rubric,
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
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const blogPost = serializeBlogPost(repos, post.id);
  const article = normalizedArticle(post);
  const rawMediaAssets = repos.mediaAssets.listByBlogPostId(post.id);
  const latestSeoScore = latestByUpdatedAt(repos.seoScores.listByBlogPostId(post.id));
  const contentGeneration = post.contentGenerationId
    ? repos.contentGenerations.findById(post.contentGenerationId)
    : null;
  return {
    blogPost,
    article,
    contentGeneration,
    mediaAssets: rawMediaAssets.map(serializeMediaAsset),
    seoScore: serializeSeoScore(latestSeoScore, post, rawMediaAssets)
  };
}

function rulesetForPost(repos: Repositories, post: BlogPost) {
  const article = normalizedArticle(post);
  const contentGeneration = post.contentGenerationId ? repos.contentGenerations.findById(post.contentGenerationId) : null;
  const rulesetId = article.generatedFromRulesetId ?? contentGeneration?.rulesetId ?? null;
  return rulesetId ? repos.marketingRulesets.findById(rulesetId) : latestRuleset(repos, post.storeId);
}

export async function regenerateBlogPostText(
  repos: Repositories,
  postId: string,
  provider?: BlogContentProvider | null
) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const currentArticle = normalizedArticle(post);
  const store = repos.stores.findById(post.storeId);
  if (!store) throw new Error(`Store not found: ${post.storeId}`);
  const ruleset = rulesetForPost(repos, post);
  if (!ruleset) throw new Error(`Marketing ruleset not found for store: ${post.storeId}`);
  const fields = repos.rulesetFields.listByRulesetId(ruleset.id);
  const mediaAssets = repos.mediaAssets.listByBlogPostId(post.id);
  const providerDraft = provider
    ? providerDraftFromOutput(
        await provider.generateDraft({
          action: 'regenerate_text',
          store,
          ruleset,
          rulesetFields: fields,
          currentPost: post,
          currentArticle: post.article,
          mediaAssets
        }),
        ruleset.id
      )
    : null;
  const draft = providerDraft?.draft ?? buildDraft(store, ruleset, fields);
  const providerSeoScore = providerDraft?.seoScore ?? null;
  const timestamp = nowIso();
  const revisionNumber = currentArticle.revisions.length + 1;
  const revision = {
    type: 'text',
    revision: revisionNumber,
    generator: draft.generator,
    regeneratedAt: timestamp
  } satisfies Record<string, JsonValue>;
  const revisedDraft = providerDraft
    ? draft
    : BlogDraftOutputSchema.parse({
        ...draft,
        title: `${draft.title} · ${revisionNumber + 1}차 초안`,
        metaDescription: `${draft.metaDescription} 재생성 초안 ${revisionNumber + 1}차입니다.`,
        bodySections: draft.bodySections.map((section, index) => ({
          heading: index === 0 ? `${section.heading} - 재생성 초안` : section.heading,
          body:
            index === 2
              ? `${section.body} CONTENT-001 mock regeneration revision ${revisionNumber} 기준으로 SEO와 CTA를 다시 점검했습니다.`
              : section.body
        }))
      });
  const contentGeneration = repos.contentGenerations.create({
    id: `content_generation_text_regen_${post.id}_${revisionNumber}_${Date.now()}`,
    storeId: post.storeId,
    rulesetId: revisedDraft.generatedFromRulesetId,
    status: 'generated',
    contentType: 'blog_post_text_revision',
    prompt: {
      mode: provider?.mode ?? 'mock',
      provider: provider?.name ?? null,
      action: 'regenerate_text',
      previousContentGenerationId: post.contentGenerationId,
      revision: revisionNumber
    },
    output: providerSeoScore ? { ...revisedDraft, seoScore: providerSeoScore } : revisedDraft,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  repos.blogPosts.update(post.id, {
    contentGenerationId: contentGeneration.id,
    title: revisedDraft.title,
    article: {
      ...revisedDraft,
      status: post.status,
      revisions: [...currentArticle.revisions, revision]
    },
    updatedAt: timestamp
  });
  const updated = repos.blogPosts.findById(post.id);
  if (!updated) return null;
  const updatedMediaAssets = repos.mediaAssets.listByBlogPostId(updated.id);
  const seoScore = createSeoScore(repos, updated, updatedMediaAssets, providerSeoScore);
  return {
    ...getBlogPostDetail(repos, updated.id),
    contentGeneration,
    seoScore: serializeSeoScore(seoScore, updated, updatedMediaAssets)
  };
}

export function regenerateBlogPostImages(repos: Repositories, postId: string) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const article = normalizedArticle(post);
  const timestamp = nowIso();
  const existingAssets = repos.mediaAssets.listByBlogPostId(post.id);
  const prompts = [0, 1, 2].map((index) => {
    const basePrompt = article.imagePrompts[index] || `${post.title} 이미지 ${index + 1}`;
    return `${basePrompt} · 재생성 placeholder ${index + 1}`;
  });

  prompts.forEach((prompt, index) => {
    const existing = existingAssets[index];
    const metadata = {
      prompt,
      alt: prompt,
      placement: index === 0 ? 'cover' : `body_${index}`,
      generator: 'mock_image_prompt_regenerator',
      note: 'CONTENT-001 placeholder only; no image generation performed',
      regeneratedAt: timestamp
    };
    if (existing) {
      repos.mediaAssets.update(existing.id, {
        assetType: 'image_prompt',
        status: 'placeholder',
        url: null,
        prompt,
        metadata,
        updatedAt: timestamp
      });
      return;
    }
    repos.mediaAssets.create({
      id: `media_asset_${post.id}_${index + 1}`,
      storeId: post.storeId,
      blogPostId: post.id,
      assetType: 'image_prompt',
      status: 'placeholder',
      url: null,
      prompt,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  repos.blogPosts.update(post.id, {
    article: {
      ...asRecord(post.article),
      imagePrompts: prompts,
      imageRevision: {
        generator: 'mock_image_prompt_regenerator',
        regeneratedAt: timestamp
      }
    },
    updatedAt: timestamp
  });

  const updated = repos.blogPosts.findById(post.id);
  if (!updated) return null;
  const mediaAssets = repos.mediaAssets.listByBlogPostId(updated.id);
  const seoScore = createSeoScore(repos, updated, mediaAssets);
  return {
    ...getBlogPostDetail(repos, updated.id),
    mediaAssets: mediaAssets.map(serializeMediaAsset),
    seoScore: serializeSeoScore(seoScore, updated, mediaAssets)
  };
}

export async function rescoreBlogPostSeo(repos: Repositories, postId: string, provider?: BlogContentProvider | null) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const store = repos.stores.findById(post.storeId);
  if (!store) throw new Error(`Store not found: ${post.storeId}`);
  const ruleset = rulesetForPost(repos, post);
  const fields = ruleset ? repos.rulesetFields.listByRulesetId(ruleset.id) : [];
  const mediaAssets = repos.mediaAssets.listByBlogPostId(post.id);
  const providerSeoScore = provider
    ? SeoScoreOutputSchema.parse(
        await provider.scoreSeo({
          store,
          ruleset,
          rulesetFields: fields,
          post,
          article: post.article,
          mediaAssets
        })
      )
    : null;
  const seoScore = createSeoScore(repos, post, mediaAssets, providerSeoScore);
  return {
    blogPost: serializeBlogPost(repos, post.id),
    seoScore: serializeSeoScore(seoScore, post, mediaAssets)
  };
}

export function getBlogPostPreview(repos: Repositories, postId: string) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const mediaAssets = repos.mediaAssets.listByBlogPostId(post.id);
  return {
    blogPost: serializeBlogPost(repos, post.id),
    preview: previewHtml(post, mediaAssets),
    seoScore: serializeSeoScore(latestByUpdatedAt(repos.seoScores.listByBlogPostId(post.id)), post, mediaAssets)
  };
}

export function requestBlogPostPublish(repos: Repositories, postId: string) {
  const post = repos.blogPosts.findById(postId);
  if (!post) return null;
  const timestamp = nowIso();
  const article = asRecord(post.article);
  repos.blogPosts.update(post.id, {
    status: 'publish_requested',
    article: {
      ...article,
      status: 'publish_requested',
      publishRequestedAt: timestamp
    },
    updatedAt: timestamp
  });
  return getBlogPostDetail(repos, post.id);
}
