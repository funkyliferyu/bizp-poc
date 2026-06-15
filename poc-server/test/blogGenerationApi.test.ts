import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import {
  extractBlogFormulaV2WithProvider
} from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createBlogPostRoutes } from '../src/storeLearning/routes/blogPosts.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function fakeV2DraftClient() {
  let callCount = 0;
  return {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            callCount += 1;
            const topics = ['리팟레이저', '써마지', '울쎄라'];
            const topic = topics[(callCount - 1) % topics.length];
            return {
              choices: [
                {
                  message: {
                    parsed: {
                      titleCandidates: [`${topic} 상담 전 확인할 점`],
                      selectedTitle: `${topic} 상담 전 확인할 점`,
                      blogDraft: [
                        `${topic}을 고민하는 고객에게 필요한 기준을 먼저 정리합니다. 개인차와 부작용 가능성을 의료진 상담으로 확인해야 합니다.`,
                        `${topic} 선택 전에는 기존 블로그처럼 걱정 지점을 먼저 설명하고 원리와 판단 기준을 차분히 이어갑니다.`,
                        `${topic} 상담에서는 기대 범위와 회복 과정, 피해야 할 표현을 함께 확인한 뒤 예약 가능 여부를 안내합니다.`
                      ].join('\n\n'),
                      styleComplianceReport: { appliedBlocks: ['titleFormula', 'bodyFormula', 'ctaFormula'] },
                      safetyCheck: {
                        requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
                        bannedPhrasesAvoided: true
                      },
                      seoCheck: {
                        mainKeywordInTitle: true,
                        mainKeywordInIntro: true,
                        secondaryKeywordsUsed: []
                      }
                    }
                  }
                }
              ]
            };
          }
        }
      }
    }
  };
}

async function seedV2FormulaAndTopicBriefSets(connection: DbConnection) {
  seedBlogFormulaV2Fixture(connection);
  const repos = createStoreLearningRepositories(connection);
  const { formulaSet } = await extractBlogFormulaV2WithProvider(
    repos,
    BLOG_FORMULA_V2_STORE_ID,
    createSafeMockBlogFormulaV2Provider()
  );
  const topics = [
    ['topic_set_ripot', 'collection_item_v2_owner_1', '리팟레이저', '리팟레이저 부작용'],
    ['topic_set_thermage', 'collection_item_v2_owner_3', '써마지', '광화문써마지'],
    ['topic_set_ulthera', 'collection_item_v2_owner_4', '울쎄라', '울쎄라600샷가격'],
    ['topic_set_ripot_2', 'collection_item_v2_owner_2', '리팟레이저', '흑자 제거']
  ];
  for (const [id, sourcePostId, topic, mainKeyword] of topics) {
    repos.v2BlogTopicBriefSets.create({
      id,
      formulaSetId: formulaSet.id,
      storeId: BLOG_FORMULA_V2_STORE_ID,
      sourcePostId,
      topic,
      mainKeyword,
      secondaryKeywords: ['개인차', '상담'],
      targetReader: `${topic} 정보를 찾는 고객`,
      coreConcern: `${topic} 전 확인할 걱정`,
      mainAngle: `${topic} 상담 전 판단 기준 안내`,
      mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
      mustAvoid: ['효과보장'],
      ctaDirection: '상담으로 본인 상태를 확인하도록 안내',
      confidence: 0.7,
      status: 'candidate'
    });
  }
  repos.blogPosts.create({
    id: 'existing_pending_blog_post',
    storeId: BLOG_FORMULA_V2_STORE_ID,
    contentGenerationId: null,
    status: 'pending_approval',
    title: '기존 승인 대기 글',
    article: { title: '기존 승인 대기 글', bodySections: [{ heading: '기존', body: '기존 글입니다.' }] },
    publishedUrl: null,
    scheduledAt: null,
    publishedAt: null
  });
  return { repos, formulaSetId: formulaSet.id };
}

describe('ruleset based blog generation API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/stores', createStoreRoutes({ connection, env: {} }));
    app.use('/api/blog-posts', createBlogPostRoutes({ connection }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();
  });

  it('generates an approval-pending blog post from the latest marketing ruleset', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById(body.blogPost.id);
    const generation = repos.contentGenerations.findById(body.contentGeneration.id);
    const mediaAssets = repos.mediaAssets.listByBlogPostId(body.blogPost.id);
    const seoScores = repos.seoScores.listByBlogPostId(body.blogPost.id);

    expect(response.status).toBe(200);
    expect(body.blogPost).toMatchObject({
      status: 'pending_approval',
      generatedFromRulesetId: expect.any(String),
      title: expect.stringContaining('예약 전 확인할 점')
    });
    expect(body.blogPost.article).toMatchObject({
      metaDescription: expect.any(String),
      bodySections: expect.arrayContaining([expect.objectContaining({ heading: expect.any(String) })]),
      seoKeywords: expect.arrayContaining(['분당 케이크']),
      cta: expect.any(String),
      generatedFromRulesetId: body.blogPost.generatedFromRulesetId
    });
    expect(JSON.stringify(body.blogPost.article.bodySections)).toContain('제목, 첫 문단, 소제목');
    expect(JSON.stringify(body.blogPost.article.bodySections)).toContain('소재-키워드 맵');
    expect(generation).toMatchObject({
      storeId: 'store_demo_cake',
      rulesetId: body.blogPost.generatedFromRulesetId,
      status: 'generated',
      contentType: 'blog_post'
    });
    expect(post).toMatchObject({
      status: 'pending_approval',
      contentGenerationId: generation?.id,
      title: body.blogPost.title
    });
    expect(mediaAssets).toHaveLength(3);
    expect(mediaAssets.map((asset) => asset.status)).toEqual(['placeholder', 'placeholder', 'placeholder']);
    expect(seoScores[0]).toMatchObject({
      status: 'scored',
      score: expect.any(Number)
    });
    expect(seoScores[0].score).toBeGreaterThanOrEqual(70);
  });

  it('lists approval-pending blog posts and returns generated detail data', async () => {
    const generatedResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const generated = await readJson(generatedResponse);

    const listResponse = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts`);
    const list = await readJson(listResponse);
    expect(listResponse.status).toBe(200);
    expect(list.posts.map((post: { id: string }) => post.id)).toContain(generated.blogPost.id);
    expect(list.posts.find((post: { id: string }) => post.id === generated.blogPost.id)).toMatchObject({
      status: 'pending_approval',
      seoScore: expect.any(Number),
      generatedFromRulesetId: generated.blogPost.generatedFromRulesetId
    });

    const detailResponse = await fetch(`${baseUrl}/api/blog-posts/${generated.blogPost.id}`);
    const detail = await readJson(detailResponse);
    expect(detailResponse.status).toBe(200);
    expect(detail.blogPost).toMatchObject({
      id: generated.blogPost.id,
      status: 'pending_approval',
      article: expect.objectContaining({
        bodySections: expect.any(Array),
        seoKeywords: expect.any(Array)
      })
    });
    expect(detail.mediaAssets).toHaveLength(3);
    expect(detail.seoScore.score).toBeGreaterThanOrEqual(70);
    expect(detail.contentGeneration.id).toBe(generated.contentGeneration.id);
  });

  it('returns list summary metadata for the first approval-pending ruleset-generated draft', async () => {
    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({
      pendingApprovalCount: 1,
      firstPendingApprovalPostId: 'blog_post_demo_pending_approval',
      firstPendingApprovalHref: '09_AI콘텐츠생성_상세.html?postId=blog_post_demo_pending_approval',
      generatedDraftCount: 1
    });
    expect(body.posts[0]).toMatchObject({
      id: 'blog_post_demo_pending_approval',
      status: 'pending_approval',
      generationSource: {
        type: 'ruleset',
        label: '마케팅 룰셋 기반',
        rulesetId: 'marketing_ruleset_demo_v1',
        contentGenerationId: 'content_generation_demo_blog'
      }
    });
  });

  it('generates one approval-pending blog post from a Blog Formula V2 topic brief while keeping existing posts', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    const { formulaSetId } = await seedV2FormulaAndTopicBriefSets(connection);

    const app = express();
    app.use(express.json());
    app.use(
      '/api/stores',
      createStoreRoutes({
        connection,
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-v2-draft-model' },
        blogDraftV2ProviderOptions: {
          openAIClient: fakeV2DraftClient(),
          model: 'test-v2-draft-model'
        }
      })
    );
    app.use('/api/blog-posts', createBlogPostRoutes({ connection }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/blog-posts/generate-from-v2-formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formulaSetId,
        topicBriefSetId: 'topic_set_ripot',
        providerMode: 'openai'
      })
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const existingPost = repos.blogPosts.findById('existing_pending_blog_post');
    const generation = repos.contentGenerations.findById(body.contentGeneration.id);
    const mediaAssets = repos.mediaAssets.listByBlogPostId(body.blogPost.id);

    expect(response.status).toBe(200);
    expect(existingPost).toMatchObject({ status: 'pending_approval', title: '기존 승인 대기 글' });
    expect(body.blogPost).toMatchObject({
      status: 'pending_approval',
      contentGenerationId: body.contentGeneration.id,
      title: '리팟레이저 상담 전 확인할 점',
      generationSource: {
        type: 'blog_formula_v2',
        label: 'Blog Formula V2',
        contentGenerationId: body.contentGeneration.id
      }
    });
    expect(generation?.prompt).toMatchObject({
      mode: 'openai',
      action: 'generate_blog_post_from_v2_formula',
      v2FormulaSetId: formulaSetId,
      v2TopicBriefSetId: 'topic_set_ripot',
      v2DraftGenerationId: expect.any(String)
    });
    expect(generation?.output).toMatchObject({
      generator: 'openai_blog_formula_v2',
      v2DraftOutput: expect.objectContaining({
        selectedTitle: '리팟레이저 상담 전 확인할 점'
      })
    });
    expect(body.v2DraftGenerationId).toEqual(expect.any(String));
    expect(body.topicBriefSetId).toBe('topic_set_ripot');
    expect(body.mediaAssets).toHaveLength(3);
    expect(mediaAssets).toHaveLength(3);
    expect(mediaAssets.map((asset) => asset.status)).toEqual(['placeholder', 'placeholder', 'placeholder']);
    expect(mediaAssets.map((asset) => asset.prompt).join('\n')).not.toMatch(/placeholder/i);
    expect(mediaAssets[0].prompt).toContain('리팟레이저');
    expect(body.seoScore.totalScore).toEqual(expect.any(Number));

    const listResponse = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/blog-posts?source=blog_formula_v2`);
    const list = await readJson(listResponse);

    expect(listResponse.status).toBe(200);
    expect(list.posts.map((post: { id: string }) => post.id)).toEqual([body.blogPost.id]);
    expect(list.summary).toMatchObject({
      pendingApprovalCount: 1,
      firstPendingApprovalPostId: body.blogPost.id,
      generatedDraftCount: 1
    });
  });

  it('returns V2 batch candidates for the requested 1-10 generation count without creating posts', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    await seedV2FormulaAndTopicBriefSets(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/stores', createStoreRoutes({ connection, env: {} }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const beforeCount = createStoreLearningRepositories(connection).blogPosts.listByStoreId(BLOG_FORMULA_V2_STORE_ID).length;
    const response = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/blog-posts/v2-batch-candidates`);
    const body = await readJson(response);
    const afterCount = createStoreLearningRepositories(connection).blogPosts.listByStoreId(BLOG_FORMULA_V2_STORE_ID).length;

    expect(response.status).toBe(200);
    expect(body.topicBriefSets).toHaveLength(3);
    expect(body.topicBriefSets.map((set: { topic: string }) => set.topic)).toEqual(['리팟레이저', '써마지', '울쎄라']);
    expect(body.topicBriefSets.map((set: { id: string }) => set.id)).toEqual(['topic_set_ripot', 'topic_set_thermage', 'topic_set_ulthera']);
    expect(afterCount).toBe(beforeCount);

    const fourResponse = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/blog-posts/v2-batch-candidates?limit=4`);
    const fourBody = await readJson(fourResponse);

    expect(fourResponse.status).toBe(200);
    expect(fourBody.topicBriefSets).toHaveLength(4);
  });

  it('generates an approval-pending blog post through the OpenAI blog provider with an LLM audit log when configured', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const parseCalls: unknown[] = [];
    const app = express();
    app.use(express.json());
    app.use(
      '/api/stores',
      createStoreRoutes({
        connection,
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-blog-model' },
        blogProviderClient: {
          beta: {
            chat: {
              completions: {
                parse: async (params: unknown) => {
                  parseCalls.push(params);
                  return {
                    choices: [
                      {
                        message: {
                          parsed: {
                            title: 'OpenAI 분당 레터링 케이크 예약 가이드',
                            metaDescription: 'OpenAI provider가 생성한 분당 레터링 케이크 예약 안내 요약입니다.',
                            bodySections: [
                              {
                                heading: 'OpenAI 추천 포인트',
                                body: '정자동 픽업 동선과 레터링 상담 흐름을 함께 안내합니다.'
                              },
                              {
                                heading: '후기 기반 강점',
                                body: '수집된 블로그와 플레이스 근거를 바탕으로 친절한 상담 강점을 설명합니다.'
                              },
                              {
                                heading: '예약 전 확인사항',
                                body: '분당 케이크, 레터링 케이크 키워드를 자연스럽게 포함하고 예약 확인 CTA를 둡니다.'
                              }
                            ],
                            seoKeywords: ['분당 케이크', '레터링 케이크', '정자동 케이크'],
                            cta: '예약 가능 여부와 픽업 시간을 확인해 주세요.',
                            imagePrompts: [
                              'OpenAI 케이크 대표 이미지 프롬프트',
                              'OpenAI 레터링 디테일 이미지 프롬프트',
                              'OpenAI 픽업 안내 이미지 프롬프트'
                            ],
                            seoScore: {
                              totalScore: 91,
                              rubric: {
                                titleKeyword: {
                                  label: '제목 키워드',
                                  score: 19,
                                  maxScore: 20,
                                  feedback: '주요 지역 키워드가 제목에 반영되었습니다.'
                                },
                                bodyKeyword: {
                                  label: '본문 키워드',
                                  score: 18,
                                  maxScore: 20,
                                  feedback: '본문에 핵심 키워드가 자연스럽게 포함되었습니다.'
                                },
                                metaDescription: {
                                  label: '메타 설명',
                                  score: 14,
                                  maxScore: 15,
                                  feedback: '검색 결과 요약에 적합합니다.'
                                },
                                readability: {
                                  label: '가독성',
                                  score: 14,
                                  maxScore: 15,
                                  feedback: '문단 구성이 검토하기 쉽습니다.'
                                },
                                imageAltPrompt: {
                                  label: '이미지 ALT/프롬프트',
                                  score: 13,
                                  maxScore: 15,
                                  feedback: '이미지 프롬프트가 본문 맥락과 맞습니다.'
                                },
                                cta: {
                                  label: 'CTA',
                                  score: 13,
                                  maxScore: 15,
                                  feedback: '예약 행동을 명확히 유도합니다.'
                                }
                              }
                            }
                          }
                        }
                      }
                    ]
                  };
                }
              }
            }
          }
        }
      })
    );
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const generation = repos.contentGenerations.findById(body.contentGeneration.id);
    const mediaAssets = repos.mediaAssets.listByBlogPostId(body.blogPost.id);
    const seoScores = repos.seoScores.listByBlogPostId(body.blogPost.id);
    const auditLogs = repos.llmAuditLogs.listByRelatedEntity('content_generation', body.contentGeneration.id);

    expect(response.status).toBe(200);
    expect(parseCalls).toHaveLength(1);
    expect(JSON.stringify(parseCalls[0])).toContain('test-blog-model');
    expect(body.blogPost.title).toBe('OpenAI 분당 레터링 케이크 예약 가이드');
    expect(generation?.prompt).toMatchObject({
      mode: 'openai',
      provider: 'openAIBlogProvider',
      model: 'test-blog-model',
      action: 'generate_blog_post',
      providerSeoScoreReturned: true,
      inputBudget: expect.objectContaining({
        action: 'generate_blog_post',
        promptCharacterCount: expect.any(Number),
        promptCharacterBudget: expect.any(Number)
      })
    });
    expect(body.contentProvenance).toMatchObject({
      mode: 'openai',
      provider: 'openAIBlogProvider',
      model: 'test-blog-model',
      action: 'generate_blog_post',
      providerSeoScoreReturned: true,
      inputBudget: expect.objectContaining({
        action: 'generate_blog_post',
        promptCharacterCount: expect.any(Number),
        promptCharacterBudget: expect.any(Number)
      })
    });
    expect(body.seoScore.provenance).toMatchObject({
      mode: 'openai',
      provider: 'openAIBlogProvider',
      model: 'test-blog-model',
      action: 'generate_blog_post',
      providerSeoScoreReturned: true,
      inputBudget: expect.objectContaining({
        action: 'generate_blog_post',
        promptCharacterCount: expect.any(Number),
        promptCharacterBudget: expect.any(Number)
      })
    });
    expect(generation?.output).toMatchObject({
      generator: 'openai_blog_provider',
      seoScore: expect.objectContaining({ totalScore: 91 })
    });
    expect(mediaAssets[0]).toMatchObject({
      status: 'placeholder',
      prompt: 'OpenAI 케이크 대표 이미지 프롬프트',
      metadata: expect.objectContaining({
        generator: 'openai_blog_provider'
      })
    });
    expect(seoScores.at(-1)).toMatchObject({
      score: 91,
      totalScore: 91,
      rubric: expect.objectContaining({
        titleKeyword: expect.any(Object)
      })
    });
    expect(auditLogs).toHaveLength(1);
    const promptInput = auditLogs[0].promptInputJson as {
      constraints?: string[];
      rulesetFields?: Array<{ fieldKey: string; finalValue: string }>;
    };
    const promptFieldKeys = (promptInput.rulesetFields || []).map((field) => field.fieldKey);
    expect(promptFieldKeys).toEqual(
      expect.arrayContaining([
        'keywordMap',
        'titlePatterns',
        'introPattern',
        'bodyOutlinePattern',
        'headingPattern',
        'industryCommonRules',
        'seoPlacementPolicy'
      ])
    );
    expect(JSON.stringify(promptInput.constraints)).toContain('Naver top-ranking guarantees');
    expect(JSON.stringify(promptInput.rulesetFields)).toContain('제목, 첫 문단, 소제목');
    expect(auditLogs[0]).toMatchObject({
      storeId: 'store_demo_cake',
      relatedEntityType: 'content_generation',
      relatedEntityId: body.contentGeneration.id,
      provider: 'openAIBlogProvider',
      mode: 'openai',
      model: 'test-blog-model',
      action: 'generate_blog_post',
      status: 'completed',
      inputBudget: expect.objectContaining({
        action: 'generate_blog_post',
        promptCharacterCount: expect.any(Number),
        promptCharacterBudget: expect.any(Number)
      }),
      promptInputJson: expect.objectContaining({
        store: expect.objectContaining({ id: 'store_demo_cake' }),
        ruleset: expect.objectContaining({ id: body.blogPost.generatedFromRulesetId })
      }),
      responseFormatJson: expect.objectContaining({
        name: 'store_learning_blog_draft',
        strict: true
      }),
      parsedOutputJson: expect.objectContaining({
        title: 'OpenAI 분당 레터링 케이크 예약 가이드',
        seoScore: expect.objectContaining({ totalScore: 91 })
      }),
      rawRequestedJson: expect.objectContaining({
        model: 'test-blog-model',
        messages: expect.any(Array)
      }),
      rawParsedOutputJson: expect.objectContaining({
        title: 'OpenAI 분당 레터링 케이크 예약 가이드',
        seoScore: expect.objectContaining({ totalScore: 91 })
      }),
      normalizedOutputJson: expect.objectContaining({
        title: 'OpenAI 분당 레터링 케이크 예약 가이드',
        seoScore: expect.objectContaining({ totalScore: 91 })
      }),
      errorJson: null
    });
    expect(auditLogs[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(auditLogs[0])).toContain('rawRequestedJson');
    expect(JSON.stringify(auditLogs[0])).toContain('rawParsedOutputJson');
    expect(JSON.stringify(auditLogs[0])).toContain('normalizedOutputJson');
    expect(JSON.stringify(auditLogs[0])).not.toContain('test-key');
  });

  it('sanitizes OpenAI context length errors during blog draft generation and records a failed LLM audit log', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use(
      '/api/stores',
      createStoreRoutes({
        connection,
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-blog-model' },
        blogProviderClient: {
          beta: {
            chat: {
              completions: {
                parse: async () => {
                  throw new Error(
                    "This model's maximum context length is 128000 tokens. However, your messages resulted in 179181 tokens."
                  );
                }
              }
            }
          }
        }
      })
    );
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/stores/store_demo_cake/blog-posts/generate`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const auditLogs = repos.llmAuditLogs.listByStoreId('store_demo_cake');

    expect(response.status).toBe(400);
    expect(body.error).toBe('블로그 생성 입력이 커서 AI 처리 한도를 초과했습니다. 룰셋 또는 기존 글 내용을 줄인 뒤 다시 시도해주세요.');
    expect(JSON.stringify(body)).not.toContain('179181');
    expect(JSON.stringify(body)).not.toContain('maximum context length');
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      storeId: 'store_demo_cake',
      relatedEntityType: 'content_generation',
      relatedEntityId: null,
      provider: 'openAIBlogProvider',
      mode: 'openai',
      model: 'test-blog-model',
      action: 'generate_blog_post',
      status: 'failed',
      inputBudget: expect.objectContaining({
        action: 'generate_blog_post',
        promptCharacterCount: expect.any(Number)
      }),
      errorJson: expect.objectContaining({
        message: '블로그 생성 입력이 커서 AI 처리 한도를 초과했습니다. 룰셋 또는 기존 글 내용을 줄인 뒤 다시 시도해주세요.'
      })
    });
    expect(JSON.stringify(auditLogs[0].errorJson)).not.toContain('179181');
    expect(JSON.stringify(auditLogs[0].errorJson)).not.toContain('maximum context length');
  });
});
