import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createOpenAIBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { evaluateBlogFormulaV2Quality } from '../src/storeLearning/blogFormulaV2/formulaQuality.js';
import { BlogFormulaSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function providerInput() {
  return {
    store: {
      id: 'store_test',
      name: '테라스의원',
      category: '피부과',
      address: '서울 강남구 테스트로 12'
    },
    ownerBlogPosts: [
      {
        collectionItemId: 'collection_item_owner_1',
        title: '리팟레이저 부작용 걱정 없이 하려면',
        sourceUrl: 'https://blog.example.test/1',
        bodyText:
          '리팟레이저 부작용을 걱정하는 분들은 색소침착과 재발 가능성을 먼저 확인합니다.\n\n의료진 상담 후 결정하는 것이 중요합니다.',
        charCount: 80,
        isTruncated: false,
        sourceKind: 'owner_blog_post' as const,
        publishedAt: '2026-06-01T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z'
      },
      {
        collectionItemId: 'collection_item_owner_2',
        title: '흑자 제거 전 확인해야 할 기준',
        sourceUrl: 'https://blog.example.test/2',
        bodyText: '흑자 제거는 피부 상태와 병변 깊이를 먼저 확인하고 개인차와 부작용 가능성을 안내해야 합니다.',
        charCount: 55,
        isTruncated: false,
        sourceKind: 'owner_blog_post' as const,
        publishedAt: '2026-05-25T00:00:00.000Z',
        createdAt: '2026-05-25T00:00:00.000Z'
      }
    ]
  };
}

function formulaOutput() {
  return BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);
}

describe('Blog Formula V2 providers', () => {
  it('extracts schema-valid formula output through the safe mock provider without external calls', async () => {
    const provider = createSafeMockBlogFormulaV2Provider();

    const result = await provider.extractFormula(providerInput());

    expect(provider.mode).toBe('safe_mock');
    expect(result.provider).toMatchObject({
      name: 'safeMockBlogFormulaV2Provider',
      mode: 'safe_mock',
      model: 'safe-mock-blog-formula-v2',
      callId: 'SL-F1',
      promptShapeVersion: 'blog_formula_v2_extraction_input.v2',
      noExternalCalls: true
    });
    expect(BlogFormulaSetV2Schema.parse(result.output)).toBeTruthy();
    expect(result.output.titleFormula[0].sourcePostIds).toEqual([
      'collection_item_owner_1',
      'collection_item_owner_2'
    ]);
    expect(result.inputBudget).toMatchObject({
      schemaVersion: 'blog_formula_v2_extraction_input.v2',
      sourcePostCount: 2
    });
  });

  it('extracts a generation-ready v2.1 formula with no quality issues through the safe mock provider', async () => {
    const provider = createSafeMockBlogFormulaV2Provider();

    const result = await provider.extractFormula(providerInput());
    const formula = result.output;

    expect(formula.schemaVersion).toBe('blog_formula_v2.1');
    expect(formula.titleFormula.length).toBeGreaterThanOrEqual(2);
    expect(formula.titleFormula.every((title) => /\{[^}]+\}/u.test(title.pattern))).toBe(true);
    expect(formula.introFormula.sequence.length).toBeGreaterThanOrEqual(3);
    expect(formula.bodyFormula.sequence.length).toBeGreaterThanOrEqual(4);
    expect(formula.toneAndMannerFormula.preferredPhrases.length).toBeGreaterThan(0);
    expect(formula.ctaFormula.hardReservationAllowed).toBe(false);
    expect(formula.medicalSafetyFormula.bannedClaims).toContain('부작용 없음');
    expect(evaluateBlogFormulaV2Quality(formula)).toEqual([]);
  });

  it('keeps the safe mock provider free of OpenAI imports', () => {
    const source = readFileSync(
      path.join(__dirname, '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.ts'),
      'utf8'
    );

    expect(source).not.toContain('openaiClient');
    expect(source).not.toContain('openai/helpers/zod');
  });

  it('limits safe mock formula evidence to the bounded SL-F1 prompt posts', async () => {
    const provider = createSafeMockBlogFormulaV2Provider();

    const result = await provider.extractFormula({
      ...providerInput(),
      ownerBlogPosts: Array.from({ length: 9 }, (_, index) => ({
        collectionItemId: `collection_item_owner_${index}`,
        title: `리팟레이저 기준 ${index}`,
        sourceUrl: `https://blog.example.test/${index}`,
        bodyText: '본문 '.repeat(20),
        charCount: 60,
        isTruncated: false,
        sourceKind: 'owner_blog_post' as const,
        publishedAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
        createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
      }))
    });

    expect(result.promptInput.sourcePostIds).toHaveLength(8);
    expect(result.output.titleFormula[0].sourcePostIds).toEqual(result.promptInput.sourcePostIds);
    expect(result.inputBudget.omittedSourcePostIds).toHaveLength(1);
  });

  it('calls OpenAI parse with the SL-F1 zod response format and stores audit metadata', async () => {
    const parsedOutput = formulaOutput();
    let requestPayload: Record<string, unknown> | null = null;
    const provider = createOpenAIBlogFormulaV2Provider({
      model: 'gpt-test-formula',
      client: {
        beta: {
          chat: {
            completions: {
              parse: async (params: unknown) => {
                requestPayload = params as Record<string, unknown>;
                return { choices: [{ message: { parsed: parsedOutput } }] };
              }
            }
          }
        }
      }
    });

    const result = await provider.extractFormula(providerInput());

    expect(result.provider).toMatchObject({
      name: 'openAIBlogFormulaV2Provider',
      mode: 'openai',
      model: 'gpt-test-formula',
      callId: 'SL-F1',
      promptShapeVersion: 'blog_formula_v2_extraction_input.v2',
      noExternalCalls: false
    });
    expect(result.output).toEqual(parsedOutput);
    expect(requestPayload).toMatchObject({
      model: 'gpt-test-formula',
      response_format: {
        json_schema: {
          name: 'store_learning_blog_formula_v2',
          strict: true
        }
      }
    });
    expect(JSON.stringify(requestPayload)).toContain('Korean local-store blog writing-formula analyst');
    expect(JSON.stringify(requestPayload)).toContain('blog_formula_v2_extraction_input.v2');

    const auditMetadata = provider.getLastAuditMetadata?.();
    expect(auditMetadata).toMatchObject({
      inputBudget: expect.objectContaining({
        schemaVersion: 'blog_formula_v2_extraction_input.v2',
        sourcePostCount: 2
      }),
      promptInputJson: expect.objectContaining({
        schemaVersion: 'blog_formula_v2_extraction_input.v2'
      }),
      responseFormatJson: expect.objectContaining({
        name: 'store_learning_blog_formula_v2',
        strict: true
      }),
      rawRequestedJson: expect.any(Object),
      rawParsedOutputJson: parsedOutput,
      normalizedOutputJson: parsedOutput,
      parsedOutputJson: parsedOutput,
      errorJson: null
    });
    expect(auditMetadata?.durationMs).toEqual(expect.any(Number));
  });

  it('sends a generation-ready system prompt to OpenAI', async () => {
    const { store, ownerBlogPosts: posts } = providerInput();
    let captured: any = null;
    const fakeClient = {
      beta: {
        chat: {
          completions: {
            parse: async (params: unknown) => {
              captured = params;
              return { choices: [{ message: { parsed: generationReadyFormulaFixture } }] };
            }
          }
        }
      }
    };
    const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
    await provider.extractFormula({ store, ownerBlogPosts: posts });
    const systemMessage = captured.messages[0].content as string;
    expect(systemMessage).toContain('generation-ready');
    expect(systemMessage).toContain('not a generic marketing summary');
    expect(systemMessage).toContain('how to write, not what to say');
    expect(systemMessage).toContain('slot-based title');
    expect(systemMessage).toContain('soft decision-guide CTA');
  });

  it('requests the v2.1 formula response format', async () => {
    const { store, ownerBlogPosts: posts } = providerInput();
    let captured: any = null;
    const fakeClient = {
      beta: {
        chat: {
          completions: {
            parse: async (params: unknown) => {
              captured = params;
              return { choices: [{ message: { parsed: generationReadyFormulaFixture } }] };
            }
          }
        }
      }
    };
    const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
    await provider.extractFormula({ store, ownerBlogPosts: posts });
    const schema = captured.response_format.json_schema.schema;
    expect(schema.properties.titleFormula.type).toBe('array');
    expect(schema.properties.introFormula.properties.sequence.type).toBe('array');
    expect(schema.properties.medicalSafetyFormula.properties.bannedClaims.type).toBe('array');
    expect(schema.properties.toneAndMannerFormula.properties.preferredPhrases.type).toBe('array');
  });

  it('rejects a legacy v2.0 parsed output', async () => {
    const { store, ownerBlogPosts: posts } = providerInput();
    const legacyParsed = { schemaVersion: 'blog_formula_v2.0' };
    const fakeClient = {
      beta: {
        chat: {
          completions: {
            parse: async () => ({ choices: [{ message: { parsed: legacyParsed } }] })
          }
        }
      }
    };
    const provider = createOpenAIBlogFormulaV2Provider({ client: fakeClient });
    await expect(provider.extractFormula({ store, ownerBlogPosts: posts })).rejects.toThrow(
      /invalid|schemaVersion|expected/i
    );
  });

  it('rejects invalid OpenAI output and stores sanitized provider errors', async () => {
    const provider = createOpenAIBlogFormulaV2Provider({
      model: 'gpt-test-formula',
      client: {
        beta: {
          chat: {
            completions: {
              parse: async () => ({ choices: [{ message: { parsed: { schemaVersion: 'wrong' } } }] })
            }
          }
        }
      }
    });

    await expect(provider.extractFormula(providerInput())).rejects.toThrow();

    const auditMetadata = provider.getLastAuditMetadata?.();
    expect(auditMetadata).toMatchObject({
      rawParsedOutputJson: { schemaVersion: 'wrong' },
      normalizedOutputJson: null,
      parsedOutputJson: { schemaVersion: 'wrong' },
      errorJson: expect.objectContaining({
        message: expect.any(String)
      })
    });
  });
});
