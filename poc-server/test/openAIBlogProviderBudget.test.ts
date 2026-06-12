import { describe, expect, it } from 'vitest';
import type { BlogPost } from '../src/repositories/blog_posts.js';
import type { MediaAsset } from '../src/repositories/media_assets.js';
import type { MarketingRuleset } from '../src/repositories/marketing_rulesets.js';
import type { RulesetField } from '../src/repositories/ruleset_fields.js';
import type { Store } from '../src/repositories/stores.js';
import { buildBlogDraftPromptInput, buildBlogSeoPromptInput } from '../src/storeLearning/blog/blogPromptBudget.js';
import { createOpenAIBlogProvider } from '../src/storeLearning/blog/openAIBlogProvider.js';

const STORE_RAW_SENTINEL = 'RAW_STORE_METADATA_SHOULD_NOT_REACH_OPENAI';
const RULESET_RAW_SENTINEL = 'RAW_RULESET_PAYLOAD_SHOULD_NOT_REACH_OPENAI';
const ARTICLE_RAW_SENTINEL = 'RAW_ARTICLE_PAYLOAD_SHOULD_NOT_REACH_OPENAI';
const MEDIA_RAW_SENTINEL = 'RAW_MEDIA_METADATA_SHOULD_NOT_REACH_OPENAI';

const timestamp = '2026-06-10T00:00:00.000Z';

function store(): Store {
  return {
    id: 'store_budget_test',
    name: '분당 케이크 연구소',
    naverPlaceUrl: 'https://map.naver.com/p/search/store_budget_test',
    naverPlaceId: 'store_budget_test',
    category: '케이크전문',
    address: '경기 성남시 분당구 정자동',
    phone: '031-000-0000',
    description: '정자동 레터링 케이크 예약 전문점',
    metadata: {
      businessHours: '월-금 10:00-19:00',
      closedDays: '일요일',
      parking: '건물 뒤편 2대 가능',
      intro: '픽업 시간 상담 가능',
      representativeMenu: ['레터링 케이크', '도시락 케이크'],
      rawProviderPayload: STORE_RAW_SENTINEL.repeat(120),
      htmlSnapshot: '<html>unneeded raw provider html</html>'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function ruleset(): MarketingRuleset {
  return {
    id: 'ruleset_budget_test',
    storeId: 'store_budget_test',
    learningSnapshotId: 'snapshot_budget_test',
    status: 'draft',
    version: 3,
    ruleset: {
      positioning: '정자동 픽업 동선을 강조하는 예약 전문점',
      toneAndManner: '친절하고 구체적인 안내형',
      sourceDump: RULESET_RAW_SENTINEL.repeat(120),
      nested: {
        providerPayload: RULESET_RAW_SENTINEL
      }
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function field(fieldKey: string, finalValue: string): RulesetField {
  return {
    id: `field_${fieldKey}`,
    rulesetId: 'ruleset_budget_test',
    fieldKey,
    fieldValue: finalValue,
    aiValue: finalValue,
    userValue: null,
    finalValue,
    source: 'openai_analysis',
    locked: 0,
    evidenceItemIds: ['collection_item_demo_blog'],
    confidence: 0.82,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function rulesetFields() {
  return [
    field('storePositioning', '분당 레터링 케이크 예약 전문점'),
    field('seoKeywords', '분당 케이크, 레터링 케이크, 정자동 케이크'),
    field('blogWritingStyle', '후기 근거를 바탕으로 예약 전 확인사항을 정리하는 문체'),
    field('ctaStyle', '예약 가능 여부와 픽업 시간을 확인하도록 안내'),
    field('industryCommonRules', '업종 공통 필수 고지 없음'),
    field('negativeExpressions', '전국 최고, 무조건, 보장')
  ];
}

function currentPost(): BlogPost {
  return {
    id: 'blog_post_budget_test',
    storeId: 'store_budget_test',
    contentGenerationId: 'content_generation_budget_test',
    status: 'pending_approval',
    title: '기존 분당 케이크 예약 글',
    article: {
      title: '기존 분당 케이크 예약 글',
      metaDescription: '기존 글 검색 요약',
      bodySections: [
        {
          heading: '기존 소개',
          body: '정자동 픽업 동선과 레터링 케이크 예약 방법을 안내합니다.'
        },
        {
          heading: '상담 안내',
          body: '디자인 상담과 픽업 시간을 미리 확인하도록 안내합니다.'
        }
      ],
      seoKeywords: ['분당 케이크', '레터링 케이크'],
      cta: '예약 가능 여부를 확인해 주세요.',
      rawProviderPayload: ARTICLE_RAW_SENTINEL.repeat(120)
    },
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function mediaAsset(index: number): MediaAsset {
  return {
    id: `media_asset_budget_${index}`,
    storeId: 'store_budget_test',
    blogPostId: 'blog_post_budget_test',
    assetType: 'image_prompt',
    status: 'placeholder',
    url: null,
    prompt: `케이크 디테일 이미지 프롬프트 ${index}`,
    metadata: {
      alt: `케이크 이미지 ${index}`,
      placement: index === 1 ? 'cover' : `body_${index}`,
      generator: 'openai_blog_provider',
      rawProviderPayload: MEDIA_RAW_SENTINEL.repeat(120),
      cdnResponse: {
        url: 'https://cdn.example.com/raw-asset'
      }
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function largeRulesetFields() {
  return [
    ...rulesetFields(),
    ...Array.from({ length: 24 }, (_, index) =>
      field(`longField${index}`, `긴 룰셋 필드 ${index} ${'검색 의도와 예약 안내 문장 '.repeat(160)}`)
    )
  ];
}

function largeCurrentPost(): BlogPost {
  return {
    ...currentPost(),
    article: {
      title: '기존 분당 케이크 예약 글',
      metaDescription: `기존 글 검색 요약 ${'메타 설명 확장 '.repeat(80)}`,
      bodySections: Array.from({ length: 18 }, (_, index) => ({
        heading: `긴 본문 섹션 ${index + 1}`,
        body: `분당 케이크 예약과 레터링 상담 흐름을 설명하는 긴 본문 ${index + 1}. ${'픽업 시간과 디자인 상담 근거를 반복 설명합니다. '.repeat(220)}`
      })),
      seoKeywords: Array.from({ length: 30 }, (_, index) => `분당 케이크 키워드 ${index + 1}`),
      cta: `예약 가능 여부를 확인해 주세요. ${'문의 전 확인사항 '.repeat(80)}`,
      imagePrompts: Array.from({ length: 20 }, (_, index) => `이미지 프롬프트 ${index + 1} ${'케이크 디테일 '.repeat(40)}`),
      rawProviderPayload: ARTICLE_RAW_SENTINEL.repeat(160)
    }
  };
}

function draftOutput() {
  return {
    title: 'OpenAI 분당 레터링 케이크 예약 가이드',
    metaDescription: '분당 레터링 케이크 예약 전 확인할 내용을 정리했습니다.',
    bodySections: [
      { heading: '예약 전 확인', body: '픽업 시간과 디자인 상담 흐름을 안내합니다.' },
      { heading: '후기 기반 강점', body: '친절한 상담과 디자인 완성도를 근거로 정리합니다.' },
      { heading: '문의 안내', body: '예약 가능 여부를 확인하도록 안내합니다.' }
    ],
    seoKeywords: ['분당 케이크', '레터링 케이크'],
    cta: '예약 가능 여부를 확인해 주세요.',
    imagePrompts: ['대표 이미지', '상세 이미지', '픽업 이미지'],
    seoScore: null
  };
}

function seoOutput() {
  return {
    totalScore: 87,
    rubric: {
      titleKeyword: { label: '제목 키워드', score: 18, maxScore: 20, feedback: '지역 키워드 포함' },
      bodyKeyword: { label: '본문 키워드', score: 17, maxScore: 20, feedback: '본문 키워드 포함' },
      metaDescription: { label: '메타 설명', score: 13, maxScore: 15, feedback: '요약 적절' },
      readability: { label: '가독성', score: 13, maxScore: 15, feedback: '문단 흐름 양호' },
      imageAltPrompt: { label: '이미지 ALT/프롬프트', score: 13, maxScore: 15, feedback: '이미지 문맥 적절' },
      cta: { label: 'CTA', score: 13, maxScore: 15, feedback: 'CTA 포함' }
    }
  };
}

function userPromptFromParseCall(call: unknown) {
  const params = call as { messages: Array<{ role: string; content: string }> };
  const userMessage = params.messages.find((message) => message.role === 'user');
  if (!userMessage) throw new Error('Missing user message');
  return JSON.parse(userMessage.content) as Record<string, unknown>;
}

describe('OpenAI blog provider prompt budget', () => {
  it('compacts SL-B1 blog draft inputs before sending them to OpenAI', async () => {
    const parseCalls: unknown[] = [];
    const provider = createOpenAIBlogProvider({
      model: 'test-blog-budget-model',
      client: {
        beta: {
          chat: {
            completions: {
              parse: async (params: unknown) => {
                parseCalls.push(params);
                return { choices: [{ message: { parsed: draftOutput() } }] };
              }
            }
          }
        }
      }
    });

    await provider.generateDraft({
      action: 'generate_blog_post',
      store: store(),
      ruleset: ruleset(),
      rulesetFields: rulesetFields()
    });

    const prompt = userPromptFromParseCall(parseCalls[0]);
    const serialized = JSON.stringify(prompt);
    expect(prompt).toMatchObject({
      store: expect.objectContaining({
        name: '분당 케이크 연구소',
        metadata: expect.objectContaining({
          businessHours: '월-금 10:00-19:00',
          parking: '건물 뒤편 2대 가능'
        })
      }),
      ruleset: expect.objectContaining({
        id: 'ruleset_budget_test',
        fields: expect.arrayContaining([
          expect.objectContaining({
            fieldKey: 'seoKeywords',
            finalValue: '분당 케이크, 레터링 케이크, 정자동 케이크'
          }),
          expect.objectContaining({
            fieldKey: 'industryCommonRules',
            finalValue: '업종 공통 필수 고지 없음'
          })
        ])
      })
    });
    expect(serialized).not.toContain(STORE_RAW_SENTINEL);
    expect(serialized).not.toContain(RULESET_RAW_SENTINEL);
    expect(provider.getLastRunMetadata?.()).toMatchObject({
      action: 'generate_blog_post',
      promptCharacterCount: expect.any(Number),
      promptCharacterBudget: expect.any(Number),
      promptBudgetReason: expect.any(String)
    });
  });

  it('compacts SL-B2 regeneration article and media inputs before sending them to OpenAI', async () => {
    const parseCalls: unknown[] = [];
    const provider = createOpenAIBlogProvider({
      client: {
        beta: {
          chat: {
            completions: {
              parse: async (params: unknown) => {
                parseCalls.push(params);
                return { choices: [{ message: { parsed: draftOutput() } }] };
              }
            }
          }
        }
      }
    });

    await provider.generateDraft({
      action: 'regenerate_text',
      store: store(),
      ruleset: ruleset(),
      rulesetFields: rulesetFields(),
      currentPost: currentPost(),
      currentArticle: currentPost().article,
      mediaAssets: [mediaAsset(1), mediaAsset(2)]
    });

    const prompt = userPromptFromParseCall(parseCalls[0]);
    const serialized = JSON.stringify(prompt);
    expect(prompt.currentPost).toMatchObject({
      id: 'blog_post_budget_test',
      title: '기존 분당 케이크 예약 글',
      article: expect.objectContaining({
        bodySections: expect.arrayContaining([
          expect.objectContaining({
            heading: '기존 소개',
            body: expect.stringContaining('정자동 픽업 동선')
          })
        ])
      })
    });
    expect(prompt.mediaAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'media_asset_budget_1',
          prompt: '케이크 디테일 이미지 프롬프트 1',
          metadata: expect.objectContaining({
            alt: '케이크 이미지 1',
            placement: 'cover'
          })
        })
      ])
    );
    expect(serialized).not.toContain(ARTICLE_RAW_SENTINEL);
    expect(serialized).not.toContain(MEDIA_RAW_SENTINEL);
    expect(serialized).not.toContain('https://cdn.example.com/raw-asset');
    expect(provider.getLastRunMetadata?.()).toMatchObject({
      action: 'regenerate_text',
      mediaAssetCount: 2,
      promptCharacterCount: expect.any(Number)
    });
  });

  it('compacts SL-S1 SEO scoring inputs before sending them to OpenAI', async () => {
    const parseCalls: unknown[] = [];
    const provider = createOpenAIBlogProvider({
      client: {
        beta: {
          chat: {
            completions: {
              parse: async (params: unknown) => {
                parseCalls.push(params);
                return { choices: [{ message: { parsed: seoOutput() } }] };
              }
            }
          }
        }
      }
    });

    await provider.scoreSeo({
      store: store(),
      ruleset: ruleset(),
      rulesetFields: rulesetFields(),
      post: currentPost(),
      article: currentPost().article,
      mediaAssets: [mediaAsset(1)]
    });

    const prompt = userPromptFromParseCall(parseCalls[0]);
    const serialized = JSON.stringify(prompt);
    expect(prompt.post).toMatchObject({
      id: 'blog_post_budget_test',
      title: '기존 분당 케이크 예약 글',
      article: expect.objectContaining({
        metaDescription: '기존 글 검색 요약',
        cta: '예약 가능 여부를 확인해 주세요.'
      })
    });
    expect(prompt.ruleset).toMatchObject({
      id: 'ruleset_budget_test',
      fields: expect.arrayContaining([expect.objectContaining({ fieldKey: 'storePositioning' })])
    });
    expect(serialized).not.toContain(ARTICLE_RAW_SENTINEL);
    expect(serialized).not.toContain(RULESET_RAW_SENTINEL);
    expect(serialized).not.toContain(MEDIA_RAW_SENTINEL);
    expect(provider.getLastRunMetadata?.()).toMatchObject({
      action: 'seo_rescore',
      mediaAssetCount: 1,
      promptCharacterCount: expect.any(Number)
    });
  });

  it('keeps oversized SL-B2 regeneration prompts under the configured budget', () => {
    const result = buildBlogDraftPromptInput(
      {
        action: 'regenerate_text',
        store: store(),
        ruleset: ruleset(),
        rulesetFields: largeRulesetFields(),
        currentPost: largeCurrentPost(),
        currentArticle: largeCurrentPost().article,
        mediaAssets: Array.from({ length: 20 }, (_, index) => mediaAsset(index + 1))
      },
      {
        promptCharacterBudget: 9500,
        articleCharacterBudget: 24000,
        sectionCharacterBudget: 3200,
        rulesetFieldCharacterBudget: 1800,
        mediaAssetLimit: 20
      }
    );

    const serialized = JSON.stringify(result.promptInput);
    expect(result.metadata.promptCharacterCount).toBeLessThanOrEqual(9500);
    expect(result.metadata.promptBudgetReason).toBe('prompt_character_budget_exceeded');
    expect(result.metadata.promptMediaAssetCount).toBeLessThan(20);
    expect(serialized).not.toContain(ARTICLE_RAW_SENTINEL);
    expect(serialized).not.toContain(MEDIA_RAW_SENTINEL);
  });

  it('keeps oversized SL-S1 SEO prompts under the configured budget', () => {
    const result = buildBlogSeoPromptInput(
      {
        store: store(),
        ruleset: ruleset(),
        rulesetFields: largeRulesetFields(),
        post: largeCurrentPost(),
        article: largeCurrentPost().article,
        mediaAssets: Array.from({ length: 18 }, (_, index) => mediaAsset(index + 1))
      },
      {
        promptCharacterBudget: 8500,
        articleCharacterBudget: 22000,
        sectionCharacterBudget: 3000,
        rulesetFieldCharacterBudget: 1600,
        mediaAssetLimit: 18
      }
    );

    const serialized = JSON.stringify(result.promptInput);
    expect(result.metadata.promptCharacterCount).toBeLessThanOrEqual(8500);
    expect(result.metadata.promptBudgetReason).toBe('prompt_character_budget_exceeded');
    expect(result.metadata.promptMediaAssetCount).toBeLessThan(18);
    expect(serialized).not.toContain(ARTICLE_RAW_SENTINEL);
    expect(serialized).not.toContain(RULESET_RAW_SENTINEL);
    expect(serialized).not.toContain(MEDIA_RAW_SENTINEL);
  });
});
