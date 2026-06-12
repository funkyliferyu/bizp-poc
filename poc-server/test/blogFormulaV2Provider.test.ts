import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createOpenAIBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.js';
import { createSafeMockBlogFormulaV2Provider } from '../src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.js';
import { BlogFormulaSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';

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

function formulaOutput(sourcePostIds = ['collection_item_owner_1', 'collection_item_owner_2']) {
  const common = {
    sourcePostIds,
    confidence: 0.82,
    status: 'confirmed' as const
  };

  return BlogFormulaSetV2Schema.parse({
    schemaVersion: 'blog_formula_v2.0',
    titleFormula: {
      ...common,
      name: '검색 걱정 선반영 제목',
      description: '주요 키워드와 걱정을 앞에 두는 제목 공식입니다.',
      pattern: '{메인키워드} 전 확인할 걱정과 기준'
    },
    introFormula: {
      ...common,
      name: '걱정 공감형 도입',
      description: '첫 문단에서 검색자의 걱정을 인정하고 확인 기준을 예고합니다.',
      pattern: '걱정 공감 → 확인 기준 예고'
    },
    bodyFormula: {
      ...common,
      name: '원리 기준형 본문',
      description: '원리, 판단 기준, 주의사항 순서로 전개합니다.',
      pattern: '원리 → 개인별 판단 기준 → 주의사항'
    },
    headingFormula: {
      ...common,
      name: '질문형 소제목',
      description: '질문형 소제목으로 독자의 다음 궁금증을 이어갑니다.',
      pattern: '질문형 소제목 3개'
    },
    toneAndMannerFormula: {
      ...common,
      name: '차분한 상담 안내 톤',
      description: '과장 없이 상담 기준을 설명합니다.',
      pattern: '차분함, 구체성, 보장 회피'
    },
    ctaFormula: {
      ...common,
      name: '상담 확인형 CTA',
      description: '본인 상태 확인을 위한 상담을 권합니다.',
      pattern: '상태 확인 → 상담 권유'
    },
    footerFormula: {
      ...common,
      name: '안전 고지 푸터',
      description: '의료정보 목적과 개인차를 반복 고지합니다.',
      pattern: '의료정보 목적 + 개인차 + 상담'
    },
    medicalSafetyFormula: {
      ...common,
      name: '의료 안전 공식',
      description: '효과 보장과 부작용 부정을 피합니다.',
      pattern: '개인차 → 부작용 가능성 → 의료진 상담',
      requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담']
    }
  });
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
      promptShapeVersion: 'blog_formula_v2_extraction_input.v1',
      noExternalCalls: true
    });
    expect(BlogFormulaSetV2Schema.parse(result.output)).toBeTruthy();
    expect(result.output.titleFormula.sourcePostIds).toEqual([
      'collection_item_owner_1',
      'collection_item_owner_2'
    ]);
    expect(result.inputBudget).toMatchObject({
      schemaVersion: 'blog_formula_v2_extraction_input.v1',
      sourcePostCount: 2
    });
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
    expect(result.output.titleFormula.sourcePostIds).toEqual(result.promptInput.sourcePostIds);
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
      promptShapeVersion: 'blog_formula_v2_extraction_input.v1',
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
    expect(JSON.stringify(requestPayload)).toContain('Korean local-store blog formula analyst');
    expect(JSON.stringify(requestPayload)).toContain('blog_formula_v2_extraction_input.v1');

    const auditMetadata = provider.getLastAuditMetadata?.();
    expect(auditMetadata).toMatchObject({
      inputBudget: expect.objectContaining({
        schemaVersion: 'blog_formula_v2_extraction_input.v1',
        sourcePostCount: 2
      }),
      promptInputJson: expect.objectContaining({
        schemaVersion: 'blog_formula_v2_extraction_input.v1'
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
