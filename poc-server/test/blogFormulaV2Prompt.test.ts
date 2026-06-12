import { describe, expect, it } from 'vitest';
import { buildBlogFormulaV2PromptInput } from '../src/storeLearning/blogFormulaV2/blogFormulaPrompt.js';

describe('buildBlogFormulaV2PromptInput', () => {
  it('builds a bounded owner-blog-only SL-F1 prompt input', () => {
    const result = buildBlogFormulaV2PromptInput({
      store: {
        id: 'store_test',
        name: '테스트의원',
        category: '피부과',
        address: '서울시 테스트구'
      },
      ownerBlogPosts: Array.from({ length: 9 }, (_, index) => ({
        collectionItemId: `item_${index}`,
        title: `테스트 시술 ${index}`,
        sourceUrl: `https://blog.example.test/${index}`,
        publishedAt: `2026-06-${String(index + 1).padStart(2, '0')}`,
        sourceKind: 'owner_blog_post' as const,
        bodyText: '본문 '.repeat(1200),
        charCount: 2400,
        isTruncated: false,
        createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
      }))
    });

    expect(result.promptInput.schemaVersion).toBe('blog_formula_v2_extraction_input.v1');
    expect(result.promptInput.outputSchemaRef).toBe('blog_formula_v2.0');
    expect(result.promptInput.ownerBlogPosts).toHaveLength(8);
    expect(result.promptInput.ownerBlogPosts[0]).toMatchObject({
      id: expect.stringMatching(/^item_/),
      title: expect.any(String),
      includedCharCount: 3500,
      isTruncated: true
    });
    expect(result.promptInput.requestedFormulaBlocks).toEqual([
      'titleFormula',
      'introFormula',
      'bodyFormula',
      'headingFormula',
      'toneAndMannerFormula',
      'ctaFormula',
      'footerFormula',
      'medicalSafetyFormula'
    ]);
    expect(JSON.stringify(result.promptInput)).not.toContain('Place');
    expect(result.metadata).toMatchObject({
      schemaVersion: 'blog_formula_v2_extraction_input.v1',
      sourcePostCount: 9,
      promptSourcePostCount: 8,
      bodyCharacterBudget: 18000,
      promptCharacterBudget: 30000
    });
    expect(result.metadata.omittedSourcePostIds).toHaveLength(1);
    expect(result.metadata.promptCharacterCount).toBeLessThanOrEqual(result.metadata.promptCharacterBudget);
  });
});
