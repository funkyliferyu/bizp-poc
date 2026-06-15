import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabaseConnection, type DbConnection } from '../src/db/connection.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { createStoreLearningRepositories } from '../src/repositories/storeLearningRepositories.js';
import { seedDemoStore } from '../src/seedStoreLearning.js';
import { extractBlogFormulaV2WithProvider } from '../src/storeLearning/blogFormulaV2/blogFormulaV2Service.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { createBlogPostRoutes } from '../src/storeLearning/routes/blogPosts.js';
import { createStoreRoutes } from '../src/storeLearning/routes/stores.js';
import { BLOG_FORMULA_V2_STORE_ID, seedBlogFormulaV2Fixture } from './helpers/blogFormulaV2Fixtures.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function fakeV2DraftClient() {
  return {
    beta: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: {
                    titleCandidates: ['리팟레이저 상담 전 확인할 점'],
                    selectedTitle: '리팟레이저 상담 전 확인할 점',
                    blogDraft: [
                      '리팟레이저 상담을 고민하는 분에게 필요한 기준을 먼저 정리합니다. 개인차와 부작용 가능성은 의료진 상담으로 확인해야 합니다.',
                      '기존 블로그 흐름처럼 걱정 지점을 먼저 다루고 리팟레이저 원리와 판단 기준을 차분히 이어갑니다.',
                      '상담 전에는 기대 범위와 회복 과정, 예약 가능 여부를 함께 확인하는 것이 좋습니다.'
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
          })
        }
      }
    }
  };
}

async function seedV2GenerationInputs(connection: DbConnection) {
  seedBlogFormulaV2Fixture(connection);
  const repos = createStoreLearningRepositories(connection);
  const { formulaSet } = await extractBlogFormulaV2WithProvider(
    repos,
    BLOG_FORMULA_V2_STORE_ID,
    createSafeMockBlogFormulaV2Provider()
  );
  repos.v2BlogTopicBriefSets.create({
    id: 'topic_set_detail_ripot',
    formulaSetId: formulaSet.id,
    storeId: BLOG_FORMULA_V2_STORE_ID,
    sourcePostId: 'collection_item_v2_owner_1',
    topic: '리팟레이저',
    mainKeyword: '리팟레이저',
    secondaryKeywords: ['색소침착'],
    targetReader: '리팟레이저 상담을 고민하는 고객',
    coreConcern: '부작용 가능성',
    mainAngle: '상담 전 확인 기준 안내',
    mustInclude: ['개인차', '부작용 가능성', '의료진 상담'],
    mustAvoid: ['효과보장'],
    ctaDirection: '상담으로 본인 상태를 확인하도록 안내',
    confidence: 0.7,
    status: 'candidate'
  });
  return { formulaSetId: formulaSet.id };
}

describe('content detail API', () => {
  let connection: DbConnection;
  let server: ReturnType<express.Express['listen']>;
  let baseUrl: string;

  beforeEach(() => {
    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use('/api/blog-posts', createBlogPostRoutes({ connection, env: {} }));
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

  it('returns detail data with article, media prompts, and itemized SEO feedback', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.blogPost).toMatchObject({
      id: 'blog_post_demo_pending_approval',
      status: 'pending_approval',
      title: expect.stringContaining('분당')
    });
    expect(body.article.bodyText).toContain('정자동');
    expect(body.mediaAssets[0]).toMatchObject({
      blogPostId: 'blog_post_demo_pending_approval',
      prompt: expect.any(String)
    });
    expect(body.contentProvenance).toMatchObject({
      mode: 'mock',
      provider: 'mock_ruleset_blog_generator',
      action: 'generate_blog_post',
      providerSeoScoreReturned: false
    });
    expect(body.seoScore).toMatchObject({
      totalScore: expect.any(Number),
      provenance: {
        mode: 'mock',
        provider: 'localSeoScorer',
        action: 'initial_score'
      },
      rubric: expect.objectContaining({
        titleKeyword: expect.any(Object),
        bodyKeyword: expect.any(Object),
        metaDescription: expect.any(Object),
        readability: expect.any(Object),
        imageAltPrompt: expect.any(Object),
        cta: expect.any(Object)
      })
    });
  });

  it('regenerates text deterministically and updates revision metadata plus SEO score', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/regenerate-text`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById('blog_post_demo_pending_approval');
    const scores = repos.seoScores.listByBlogPostId('blog_post_demo_pending_approval');

    expect(response.status).toBe(200);
    expect(body.blogPost.status).toBe('pending_approval');
    expect(body.blogPost.article.bodySections).toHaveLength(3);
    expect(body.blogPost.article.revisions.at(-1)).toMatchObject({
      type: 'text',
      generator: 'mock_ruleset_blog_generator'
    });
    expect(post?.title).toBe(body.blogPost.title);
    expect(scores.at(-1)?.totalScore).toBe(body.seoScore.totalScore);
  });

  it('returns V2-generated article detail with paragraph-specific image descriptions', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    const { formulaSetId } = await seedV2GenerationInputs(connection);

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
    app.use('/api/blog-posts', createBlogPostRoutes({ connection, env: {} }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: message });
    });
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const generateResponse = await fetch(`${baseUrl}/api/stores/${BLOG_FORMULA_V2_STORE_ID}/blog-posts/generate-from-v2-formula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formulaSetId,
        topicBriefSetId: 'topic_set_detail_ripot',
        providerMode: 'openai'
      })
    });
    const generated = await readJson(generateResponse);
    const detailResponse = await fetch(`${baseUrl}/api/blog-posts/${generated.blogPost.id}`);
    const detail = await readJson(detailResponse);

    expect(generateResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(detail.article.bodySections.length).toBeGreaterThanOrEqual(3);
    expect(detail.article.bodyText).toContain('리팟레이저 상담을 고민하는 분');
    expect(detail.mediaAssets).toHaveLength(3);
    expect(detail.mediaAssets[0].prompt).toContain('리팟레이저');
    expect(detail.mediaAssets[0].prompt).not.toMatch(/placeholder/i);
    expect(detail.seoScore.rubric.imageAltPrompt.feedback).toEqual(expect.any(String));
  });

  it('regenerates text and SEO through the OpenAI blog provider with an LLM audit log when configured', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const parseCalls: unknown[] = [];
    const app = express();
    app.use(express.json());
    app.use(
      '/api/blog-posts',
      createBlogPostRoutes({
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
                            title: 'OpenAI 재생성 분당 케이크 예약 안내',
                            metaDescription: 'OpenAI 재생성 본문에 맞춘 검색 요약입니다.',
                            bodySections: [
                              {
                                heading: '재생성된 첫 문단',
                                body: '분당 케이크 예약 고객에게 필요한 핵심 정보를 다시 정리합니다.'
                              },
                              {
                                heading: '근거 기반 장점',
                                body: '플레이스와 블로그 근거를 바탕으로 상담과 픽업 장점을 설명합니다.'
                              },
                              {
                                heading: '예약 행동 유도',
                                body: '레터링 케이크 주문 전 확인할 날짜와 픽업 시간을 안내합니다.'
                              }
                            ],
                            seoKeywords: ['분당 케이크', '레터링 케이크', '정자동 케이크'],
                            cta: '예약 가능 여부를 지금 확인해 주세요.',
                            imagePrompts: [
                              'OpenAI 재생성 대표 이미지 프롬프트',
                              'OpenAI 재생성 상세 이미지 프롬프트',
                              'OpenAI 재생성 픽업 이미지 프롬프트'
                            ],
                            seoScore: {
                              totalScore: 94,
                              rubric: {
                                titleKeyword: {
                                  label: '제목 키워드',
                                  score: 20,
                                  maxScore: 20,
                                  feedback: '핵심 키워드가 제목에 정확히 포함되었습니다.'
                                },
                                bodyKeyword: {
                                  label: '본문 키워드',
                                  score: 19,
                                  maxScore: 20,
                                  feedback: '본문 키워드 밀도가 적절합니다.'
                                },
                                metaDescription: {
                                  label: '메타 설명',
                                  score: 14,
                                  maxScore: 15,
                                  feedback: '요약 문장이 검색 친화적입니다.'
                                },
                                readability: {
                                  label: '가독성',
                                  score: 14,
                                  maxScore: 15,
                                  feedback: '읽기 흐름이 자연스럽습니다.'
                                },
                                imageAltPrompt: {
                                  label: '이미지 ALT/프롬프트',
                                  score: 13,
                                  maxScore: 15,
                                  feedback: '이미지 프롬프트가 게시글 의도와 맞습니다.'
                                },
                                cta: {
                                  label: 'CTA',
                                  score: 14,
                                  maxScore: 15,
                                  feedback: '예약 CTA가 분명합니다.'
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

    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/regenerate-text`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const post = repos.blogPosts.findById('blog_post_demo_pending_approval');
    const generation = post?.contentGenerationId ? repos.contentGenerations.findById(post.contentGenerationId) : null;
    const scores = repos.seoScores.listByBlogPostId('blog_post_demo_pending_approval');
    const auditLogs = generation ? repos.llmAuditLogs.listByRelatedEntity('blog_post', post?.id ?? '') : [];

    expect(response.status).toBe(200);
    expect(parseCalls).toHaveLength(1);
    expect(JSON.stringify(parseCalls[0])).toContain('test-blog-model');
    expect(body.blogPost.title).toBe('OpenAI 재생성 분당 케이크 예약 안내');
    expect(body.blogPost.article.revisions.at(-1)).toMatchObject({
      type: 'text',
      generator: 'openai_blog_provider'
    });
    expect(generation?.prompt).toMatchObject({
      mode: 'openai',
      provider: 'openAIBlogProvider',
      action: 'regenerate_text',
      inputBudget: expect.objectContaining({
        action: 'regenerate_text',
        promptCharacterCount: expect.any(Number),
        promptCharacterBudget: expect.any(Number)
      })
    });
    expect(body.contentProvenance).toMatchObject({
      mode: 'openai',
      provider: 'openAIBlogProvider',
      action: 'regenerate_text',
      inputBudget: expect.objectContaining({
        action: 'regenerate_text',
        promptCharacterCount: expect.any(Number)
      })
    });
    expect(scores.at(-1)).toMatchObject({
      totalScore: 94,
      rubric: expect.objectContaining({
        bodyKeyword: expect.any(Object)
      })
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      storeId: 'store_demo_cake',
      relatedEntityType: 'blog_post',
      relatedEntityId: 'blog_post_demo_pending_approval',
      provider: 'openAIBlogProvider',
      mode: 'openai',
      model: 'test-blog-model',
      action: 'regenerate_blog_text',
      status: 'completed',
      inputBudget: expect.objectContaining({
        action: 'regenerate_text',
        promptCharacterCount: expect.any(Number)
      }),
      promptInputJson: expect.objectContaining({
        currentPost: expect.objectContaining({ id: 'blog_post_demo_pending_approval' })
      }),
      responseFormatJson: expect.objectContaining({
        name: 'store_learning_blog_draft',
        strict: true
      }),
      parsedOutputJson: expect.objectContaining({
        title: 'OpenAI 재생성 분당 케이크 예약 안내'
      }),
      errorJson: null
    });
  });

  it('regenerates image prompts without calling image providers', async () => {
    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/regenerate-images`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const mediaAssets = repos.mediaAssets.listByBlogPostId('blog_post_demo_pending_approval');

    expect(response.status).toBe(200);
    expect(body.mediaAssets).toHaveLength(3);
    expect(body.mediaAssets.map((asset: { status: string }) => asset.status)).toEqual([
      'placeholder',
      'placeholder',
      'placeholder'
    ]);
    expect(body.mediaAssets[0].prompt).toContain('재생성');
    expect(mediaAssets[0].prompt).toBe(body.mediaAssets[0].prompt);
  });

  it('rescoring, preview, and publish request update the detail state', async () => {
    const scoreResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/seo-score`, {
      method: 'POST'
    });
    const scoreBody = await readJson(scoreResponse);
    expect(scoreResponse.status).toBe(200);
    expect(scoreBody.seoScore.totalScore).toBeGreaterThanOrEqual(60);
    expect(Object.keys(scoreBody.seoScore.rubric)).toEqual([
      'titleKeyword',
      'bodyKeyword',
      'metaDescription',
      'readability',
      'imageAltPrompt',
      'cta'
    ]);

    const previewResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/preview`);
    const previewBody = await readJson(previewResponse);
    expect(previewResponse.status).toBe(200);
    expect(previewBody.preview.html).toContain('<article');
    expect(previewBody.preview.title).toContain('분당');
    expect(previewBody.preview.bodySections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          heading: expect.any(String),
          body: expect.any(String)
        })
      ])
    );
    expect(previewBody.preview.cta).toEqual(expect.any(String));
    expect(previewBody.preview.html).not.toContain(`<h1>${previewBody.preview.title}</h1>`);

    const publishResponse = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/request-publish`, {
      method: 'POST'
    });
    const publishBody = await readJson(publishResponse);
    const repos = createStoreLearningRepositories(connection);
    expect(publishResponse.status).toBe(200);
    expect(publishBody.blogPost.status).toBe('publish_requested');
    expect(repos.blogPosts.findById('blog_post_demo_pending_approval')?.status).toBe('publish_requested');
  });

  it('rescoring uses the OpenAI blog provider with an LLM audit log when configured', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const parseCalls: unknown[] = [];
    const app = express();
    app.use(express.json());
    app.use(
      '/api/blog-posts',
      createBlogPostRoutes({
        connection,
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-seo-model' },
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
                            totalScore: 88,
                            rubric: {
                              titleKeyword: {
                                label: '제목 키워드',
                                score: 18,
                                maxScore: 20,
                                feedback: '제목에 지역 키워드가 포함되었습니다.'
                              },
                              bodyKeyword: {
                                label: '본문 키워드',
                                score: 18,
                                maxScore: 20,
                                feedback: '본문 키워드가 충분합니다.'
                              },
                              metaDescription: {
                                label: '메타 설명',
                                score: 13,
                                maxScore: 15,
                                feedback: '요약 문장이 적절합니다.'
                              },
                              readability: {
                                label: '가독성',
                                score: 13,
                                maxScore: 15,
                                feedback: '읽기 흐름이 좋습니다.'
                              },
                              imageAltPrompt: {
                                label: '이미지 ALT/프롬프트',
                                score: 13,
                                maxScore: 15,
                                feedback: '이미지 설명이 충분합니다.'
                              },
                              cta: {
                                label: 'CTA',
                                score: 13,
                                maxScore: 15,
                                feedback: '예약 CTA가 포함되었습니다.'
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

    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/seo-score`, {
      method: 'POST'
    });
    const body = await readJson(response);
    const repos = createStoreLearningRepositories(connection);
    const scores = repos.seoScores.listByBlogPostId('blog_post_demo_pending_approval');
    const auditLogs = repos.llmAuditLogs.listByRelatedEntity('seo_score', scores.at(-1)?.id ?? '');

    expect(response.status).toBe(200);
    expect(parseCalls).toHaveLength(1);
    expect(JSON.stringify(parseCalls[0])).toContain('test-seo-model');
    expect(body.seoScore).toMatchObject({
      totalScore: 88,
      provenance: expect.objectContaining({
        mode: 'openai',
        provider: 'openAIBlogProvider',
        action: 'seo_rescore',
        inputBudget: expect.objectContaining({
          action: 'seo_rescore',
          promptCharacterCount: expect.any(Number),
          promptCharacterBudget: expect.any(Number)
        })
      }),
      rubric: expect.objectContaining({
        titleKeyword: expect.objectContaining({ score: 18 })
      })
    });
    expect(scores.at(-1)).toMatchObject({
      totalScore: 88,
      rubric: expect.objectContaining({
        cta: expect.any(Object)
      })
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      storeId: 'store_demo_cake',
      relatedEntityType: 'seo_score',
      relatedEntityId: scores.at(-1)?.id,
      provider: 'openAIBlogProvider',
      mode: 'openai',
      model: 'test-seo-model',
      action: 'score_blog_seo',
      status: 'completed',
      inputBudget: expect.objectContaining({
        action: 'seo_rescore',
        promptCharacterCount: expect.any(Number)
      }),
      promptInputJson: expect.objectContaining({
        post: expect.objectContaining({ id: 'blog_post_demo_pending_approval' })
      }),
      responseFormatJson: expect.objectContaining({
        name: 'store_learning_blog_seo_score',
        strict: true
      }),
      parsedOutputJson: expect.objectContaining({
        totalScore: 88
      }),
      errorJson: null
    });
  });

  it('sanitizes OpenAI context length errors during SEO rescoring and records a failed LLM audit log', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    connection.close();

    connection = createDatabaseConnection({ filename: ':memory:' });
    migrateDatabase(connection);
    seedDemoStore(connection);

    const app = express();
    app.use(express.json());
    app.use(
      '/api/blog-posts',
      createBlogPostRoutes({
        connection,
        env: { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-seo-model' },
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

    const response = await fetch(`${baseUrl}/api/blog-posts/blog_post_demo_pending_approval/seo-score`, {
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
      relatedEntityType: 'seo_score',
      relatedEntityId: null,
      provider: 'openAIBlogProvider',
      mode: 'openai',
      model: 'test-seo-model',
      action: 'score_blog_seo',
      status: 'failed',
      errorJson: expect.objectContaining({
        message: '블로그 생성 입력이 커서 AI 처리 한도를 초과했습니다. 룰셋 또는 기존 글 내용을 줄인 뒤 다시 시도해주세요.'
      })
    });
    expect(JSON.stringify(auditLogs[0].errorJson)).not.toContain('179181');
    expect(JSON.stringify(auditLogs[0].errorJson)).not.toContain('maximum context length');
  });
});
