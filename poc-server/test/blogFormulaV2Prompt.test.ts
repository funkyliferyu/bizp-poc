import { describe, expect, it } from 'vitest';
import { buildBlogFormulaV2PromptInput } from '../src/storeLearning/blogFormulaV2/blogFormulaPrompt.js';

describe('buildBlogFormulaV2PromptInput', () => {
  const store = {
    id: 'store_test',
    name: '테스트의원',
    category: '피부과',
    address: '서울시 테스트구'
  };

  const posts = Array.from({ length: 9 }, (_, index) => ({
    collectionItemId: `item_${index}`,
    title: `테스트 시술 ${index}`,
    sourceUrl: `https://blog.example.test/${index}`,
    publishedAt: `2026-06-${String(index + 1).padStart(2, '0')}`,
    sourceKind: 'owner_blog_post' as const,
    bodyText: '본문 '.repeat(1200),
    charCount: 2400,
    isTruncated: false,
    createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
  }));

  it('builds a bounded owner-blog-only SL-F1 prompt input', () => {
    const result = buildBlogFormulaV2PromptInput({
      store,
      ownerBlogPosts: posts
    });

    expect(result.promptInput.schemaVersion).toBe('blog_formula_v2_extraction_input.v2');
    expect(result.promptInput.outputSchemaRef).toBe('blog_formula_v2.1');
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
      schemaVersion: 'blog_formula_v2_extraction_input.v2',
      sourcePostCount: 9,
      promptSourcePostCount: 8,
      bodyCharacterBudget: 18000,
      promptCharacterBudget: 30000
    });
    expect(result.metadata.omittedSourcePostIds).toHaveLength(1);
    expect(result.metadata.promptCharacterCount).toBeLessThanOrEqual(result.metadata.promptCharacterBudget);
  });

  it('embeds the product intent and downstream consumer contract', () => {
    const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
    const intent = promptInput.productIntent.join(' ');
    expect(intent).toContain('not to produce a generic marketing summary');
    expect(intent).toContain('generation-ready writing formula');
    expect(intent).toContain('Topic Brief');
    expect(intent).toContain('Top 1~3');
  });

  it('embeds formula extraction instructions describing how to write, not what to say', () => {
    const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
    const instructions = promptInput.formulaExtractionInstructions.join(' ');
    expect(instructions).toContain('how to write, not what to say');
    expect(instructions).toContain('slot-based title formulas');
    expect(instructions).toContain('sequence of writing moves');
    expect(instructions).toContain('reusable sentence habits');
    expect(instructions).toContain('soft decision-guide CTA');
    expect(instructions).toContain('Do not copy long source text');
    expect(instructions).toContain('confirmed');
  });

  it('embeds formula quality requirements banning vague rules', () => {
    const { promptInput } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
    const quality = promptInput.formulaQualityRequirements.join(' ');
    expect(quality).toContain('정보 제공 중심');
    expect(quality).toContain('slot-based');
    expect(quality).toContain('sourcePostIds');
    expect(quality).toContain('confirmed | candidate | weak');
    expect(quality).toContain('without hardcoding stale business hours');
    expect(quality).toContain('banned claims from required risk disclosures');
  });

  it('updates the prompt schema version for the new instruction shape', () => {
    const { metadata } = buildBlogFormulaV2PromptInput({ store, ownerBlogPosts: posts });
    expect(metadata.schemaVersion).toBe('blog_formula_v2_extraction_input.v2');
  });
});
