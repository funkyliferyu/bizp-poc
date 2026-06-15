import { randomUUID } from 'node:crypto';
import type { JsonValue } from '../../repositories/base.js';
import type { BlogPost } from '../../repositories/blog_posts.js';
import type { ContentGeneration } from '../../repositories/content_generations.js';
import type { MediaAsset } from '../../repositories/media_assets.js';
import type { SeoScore } from '../../repositories/seo_scores.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import type { V2BlogTopicBriefSet } from '../../repositories/v2_blog_formula.js';
import type { BlogDraftV2Provider } from '../blogFormulaV2/providers/blogDraftV2Provider.js';
import {
  generateBlogFormulaV2Draft,
  generateBlogFormulaV2DraftWithProvider,
  retrieveBlogFormulaV2Samples
} from '../blogFormulaV2/blogFormulaV2Service.js';
import type { BlogDraftOutputV2, BlogTopicBriefInput } from '../blogFormulaV2/types.js';
import { getBlogPostDetail, serializeBlogPost } from './blogGenerator.js';

type StoreLearningRepositories = ReturnType<typeof createStoreLearningRepositories>;

export type GenerateV2FormulaBlogPostInput = {
  formulaSetId?: string;
  topicBriefSetId: string;
  providerMode?: 'deterministic' | 'safe_mock' | 'openai' | 'auto';
  provider?: BlogDraftV2Provider | null;
};

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

function requireFormulaSet(repos: StoreLearningRepositories, storeId: string, formulaSetId?: string) {
  const formulaSet = formulaSetId
    ? repos.v2BlogFormulaSets.findById(formulaSetId)
    : latestByUpdatedAt(repos.v2BlogFormulaSets.listByStoreId(storeId));
  if (!formulaSet || formulaSet.storeId !== storeId) throw new Error(`Blog Formula V2 set not found for store: ${storeId}`);
  return formulaSet;
}

function requireTopicBriefSet(repos: StoreLearningRepositories, storeId: string, topicBriefSetId: string) {
  const row = repos.v2BlogTopicBriefSets.findById(topicBriefSetId);
  if (!row || row.storeId !== storeId) throw new Error(`Blog Formula V2 topic brief set not found: ${topicBriefSetId}`);
  return row;
}

function topicBriefInputFromSet(row: V2BlogTopicBriefSet): BlogTopicBriefInput {
  return {
    topic: row.topic,
    mainKeyword: row.mainKeyword,
    secondaryKeywords: asStringArray(row.secondaryKeywords),
    targetReader: row.targetReader,
    coreConcern: row.coreConcern,
    mainAngle: row.mainAngle,
    mustInclude: asStringArray(row.mustInclude),
    mustAvoid: asStringArray(row.mustAvoid),
    ctaDirection: row.ctaDirection
  };
}

function sectionHeading(index: number, topicBrief: BlogTopicBriefInput) {
  const headings = [
    `${topicBrief.topic} 상담 전 확인할 점`,
    `${topicBrief.mainKeyword} 핵심 안내`,
    topicBrief.ctaDirection ? '상담 전 확인사항' : '예약 전 확인사항'
  ];
  return headings[index] ?? `${topicBrief.topic} 추가 안내`;
}

function bodySectionsFromDraft(output: BlogDraftOutputV2, topicBrief: BlogTopicBriefInput) {
  const paragraphs = output.blogDraft
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const padded = paragraphs.length >= 3 ? paragraphs : [...paragraphs];
  while (padded.length < 3) {
    padded.push(`${topicBrief.mainKeyword} 상담 전에는 개인차, 부작용 가능성, 의료진 상담 필요성을 함께 확인해 주세요.`);
  }
  return padded.slice(0, 3).map((body, index) => ({
    heading: sectionHeading(index, topicBrief),
    body
  }));
}

function metaDescriptionFor(output: BlogDraftOutputV2, sections: Array<{ body: string }>) {
  const first = sections[0]?.body ?? output.blogDraft;
  return first.replace(/\s+/gu, ' ').slice(0, 120);
}

function articleFromV2Output(
  output: BlogDraftOutputV2,
  topicBrief: BlogTopicBriefInput,
  generator: string
) {
  const bodySections = bodySectionsFromDraft(output, topicBrief);
  const seoKeywords = Array.from(
    new Set([topicBrief.mainKeyword, topicBrief.topic, ...topicBrief.secondaryKeywords].filter(Boolean))
  ).slice(0, 8);
  return {
    title: output.selectedTitle,
    metaDescription: metaDescriptionFor(output, bodySections),
    bodySections,
    seoKeywords,
    cta: topicBrief.ctaDirection ?? '상담으로 본인에게 맞는 계획을 확인해 주세요.',
    imagePrompts: bodySections.map((section, index) => imagePromptForSection(section, topicBrief, index)),
    generatedFromRulesetId: null,
    generator,
    source: 'blog_formula_v2',
    status: 'pending_approval'
  };
}

function imagePromptForSection(
  section: { heading: string; body: string },
  topicBrief: BlogTopicBriefInput,
  index: number
) {
  const placement = index === 0 ? '대표 이미지' : `본문 이미지 ${index + 1}`;
  const bodySummary = section.body.replace(/\s+/gu, ' ').slice(0, 70);
  return `${topicBrief.mainKeyword} ${placement}: "${section.heading}" 단락의 내용을 표현하는 이미지 설명 - ${bodySummary}`;
}

function seoScoreForArticle(article: ReturnType<typeof articleFromV2Output>, mediaPrompts: string[]) {
  const bodyText = article.bodySections.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
  const titleKeyword = article.seoKeywords.some((keyword) => article.title.includes(keyword)) ? 18 : 12;
  const bodyHits = article.seoKeywords.filter((keyword) => bodyText.includes(keyword)).length;
  const bodyKeyword = Math.min(20, 12 + bodyHits * 2);
  const metaDescription = article.metaDescription.length >= 40 ? 14 : 10;
  const readability = article.bodySections.length >= 3 ? 14 : 10;
  const imageAltPrompt = Math.min(15, 9 + mediaPrompts.filter(Boolean).length * 2);
  const cta = /상담|예약|확인|문의/u.test(`${bodyText}\n${article.cta}`) ? 14 : 8;
  return {
    totalScore: Math.min(100, titleKeyword + bodyKeyword + metaDescription + readability + imageAltPrompt + cta),
    rubric: {
      titleKeyword: {
        label: '제목 키워드',
        score: titleKeyword,
        maxScore: 20,
        feedback: '주요 키워드가 제목에 반영되어 있습니다.'
      },
      bodyKeyword: {
        label: '본문 키워드',
        score: bodyKeyword,
        maxScore: 20,
        feedback: `본문에 ${bodyHits}개의 주요 키워드가 자연스럽게 포함되어 있습니다.`
      },
      metaDescription: {
        label: '메타 설명',
        score: metaDescription,
        maxScore: 15,
        feedback: '검색 결과에서 보일 요약 문장이 포함되어 있습니다.'
      },
      readability: {
        label: '가독성',
        score: readability,
        maxScore: 15,
        feedback: '문단 길이와 흐름이 블로그 초안 검토에 적합합니다.'
      },
      imageAltPrompt: {
        label: '이미지 ALT/프롬프트',
        score: imageAltPrompt,
        maxScore: 15,
        feedback: '이미지 프롬프트가 본문 단락 내용에 맞춰 준비되어 있습니다.'
      },
      cta: {
        label: 'CTA',
        score: cta,
        maxScore: 15,
        feedback: '상담/예약으로 이어지는 행동 유도 문장이 포함되어 있습니다.'
      }
    }
  };
}

export function selectTopicBriefSetsForV2Batch(
  repos: StoreLearningRepositories,
  storeId: string,
  count = 3
) {
  const formulaSet = requireFormulaSet(repos, storeId);
  const rows = repos.v2BlogTopicBriefSets.listByFormulaSetId(formulaSet.id);
  const selected: V2BlogTopicBriefSet[] = [];
  const seenTopics = new Set<string>();
  for (const row of rows) {
    if (selected.length >= count) break;
    if (seenTopics.has(row.topic)) continue;
    selected.push(row);
    seenTopics.add(row.topic);
  }
  for (const row of rows) {
    if (selected.length >= count) break;
    if (selected.some((item) => item.id === row.id)) continue;
    selected.push(row);
  }
  return selected.map((row) => ({
    id: row.id,
    topic: row.topic,
    mainKeyword: row.mainKeyword,
    sourcePostIds: [row.sourcePostId]
  }));
}

export async function generateApprovalPendingBlogPostFromV2Formula(
  repos: StoreLearningRepositories,
  storeId: string,
  input: GenerateV2FormulaBlogPostInput
) {
  const store = repos.stores.findById(storeId);
  if (!store) throw new Error(`Store not found: ${storeId}`);
  const formulaSet = requireFormulaSet(repos, storeId, input.formulaSetId);
  const topicBriefSet = requireTopicBriefSet(repos, storeId, input.topicBriefSetId);
  if (topicBriefSet.formulaSetId !== formulaSet.id) {
    throw new Error(`Topic brief set does not belong to formula set: ${topicBriefSet.id}`);
  }
  const topicBriefInput = topicBriefInputFromSet(topicBriefSet);
  const retrieval = retrieveBlogFormulaV2Samples(repos, storeId, {
    formulaSetId: formulaSet.id,
    topicBrief: topicBriefInput,
    maxSamples: 3
  });
  const draftResult = input.provider
    ? await generateBlogFormulaV2DraftWithProvider(
        repos,
        storeId,
        {
          formulaSetId: formulaSet.id,
          topicBriefId: retrieval.topicBrief.id,
          retrievalRunId: retrieval.retrievalRun.id
        },
        input.provider
      )
    : generateBlogFormulaV2Draft(repos, storeId, {
        formulaSetId: formulaSet.id,
        topicBriefId: retrieval.topicBrief.id,
        retrievalRunId: retrieval.retrievalRun.id
      });
  const generator = input.provider?.mode === 'openai' ? 'openai_blog_formula_v2' : 'deterministic_blog_formula_v2';
  const article = articleFromV2Output(draftResult.output, topicBriefInput, generator);
  const timestamp = new Date().toISOString();
  const idSuffix = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  const contentGeneration = repos.contentGenerations.create({
    id: `content_generation_v2_blog_${idSuffix}`,
    storeId,
    rulesetId: null,
    status: 'generated',
    contentType: 'blog_post',
    prompt: toJsonValue({
      mode: input.provider?.mode ?? input.providerMode ?? 'deterministic',
      provider: input.provider?.name ?? null,
      model: input.provider?.model ?? null,
      action: 'generate_blog_post_from_v2_formula',
      v2FormulaSetId: formulaSet.id,
      v2TopicBriefSetId: topicBriefSet.id,
      v2DraftGenerationId: draftResult.draftGeneration.id,
      topicBrief: topicBriefInput
    }),
    output: toJsonValue({
      ...article,
      v2DraftOutput: draftResult.output
    }),
    createdAt: timestamp,
    updatedAt: timestamp
  }) as ContentGeneration;
  const blogPost = repos.blogPosts.create({
    id: `blog_post_v2_${idSuffix}`,
    storeId,
    contentGenerationId: contentGeneration.id,
    status: 'pending_approval',
    title: article.title,
    article: toJsonValue(article),
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  }) as BlogPost;
  const mediaAssets = article.imagePrompts.map((prompt, index) =>
    repos.mediaAssets.create({
      id: makeId(`media_asset_${blogPost.id}_${index + 1}`),
      storeId,
      blogPostId: blogPost.id,
      assetType: 'image_prompt',
      status: 'placeholder',
      url: null,
      prompt,
      metadata: toJsonValue({
        prompt,
        placement: index === 0 ? 'cover' : `body_${index}`,
        generator,
        v2TopicBriefSetId: topicBriefSet.id
      }),
      createdAt: timestamp,
      updatedAt: timestamp
    }) as MediaAsset
  );
  const scored = seoScoreForArticle(article, article.imagePrompts);
  const seoScore = repos.seoScores.create({
    id: `seo_score_${blogPost.id}`,
    blogPostId: blogPost.id,
    score: scored.totalScore,
    totalScore: scored.totalScore,
    status: 'scored',
    rubric: toJsonValue({
      _provenance: {
        mode: input.provider?.mode ?? input.providerMode ?? 'deterministic',
        provider: 'localSeoScorer',
        model: null,
        action: 'generate_blog_post_from_v2_formula',
        providerSeoScoreReturned: false
      },
      ...scored.rubric
    }),
    createdAt: timestamp,
    updatedAt: timestamp
  }) as SeoScore;
  const detail = getBlogPostDetail(repos, blogPost.id);
  if (!detail || !detail.blogPost) throw new Error(`Generated blog post not found: ${blogPost.id}`);
  return {
    contentGeneration,
    blogPost: serializeBlogPost(repos, blogPost.id),
    article: detail.article,
    mediaAssets: detail.mediaAssets,
    contentProvenance: detail.contentProvenance,
    seoScore: detail.seoScore,
    v2DraftGenerationId: draftResult.draftGeneration.id,
    topicBriefSetId: topicBriefSet.id,
    rawSeoScore: seoScore
  };
}
