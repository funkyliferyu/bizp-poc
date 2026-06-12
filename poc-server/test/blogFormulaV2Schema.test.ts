import { describe, expect, it } from 'vitest';
import {
  BlogFormulaSetV2Schema,
  parseStoredBlogFormulaV2
} from '../src/storeLearning/blogFormulaV2/types.js';
import { generationReadyFormulaFixture, legacyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const ids = ['item_1', 'item_2', 'item_3'];

describe('BlogFormulaSetV2Schema v2.1', () => {
  it('accepts a generation-ready formula set', () => {
    const parsed = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);
    expect(parsed.titleFormula.length).toBeGreaterThanOrEqual(2);
    expect(parsed.introFormula.sequence.length).toBeGreaterThanOrEqual(4);
    expect(parsed.medicalSafetyFormula.bannedClaims).toContain('부작용 없음');
    expect(parsed.ctaFormula.hardReservationAllowed).toBe(false);
  });

  it('keeps per-block sourcePostIds, confidence, and status', () => {
    const parsed = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);
    expect(parsed.titleFormula[0].sourcePostIds).toEqual(ids);
    expect(parsed.bodyFormula.status).toBe('confirmed');
    expect(parsed.toneAndMannerFormula.confidence).toBeCloseTo(0.8);
  });

  it('rejects a v2.0-shaped formula as the current schema', () => {
    expect(() => BlogFormulaSetV2Schema.parse(legacyFormulaFixture)).toThrow();
  });
});

describe('parseStoredBlogFormulaV2', () => {
  it('passes a stored v2.1 formula through unchanged', () => {
    const parsed = parseStoredBlogFormulaV2(generationReadyFormulaFixture);
    expect(parsed.schemaVersion).toBe('blog_formula_v2.1');
    expect(parsed.footerFormula.hoursPolicy).toContain('하드코딩');
  });

  it('upgrades a stored legacy v2.0 formula to v2.1 deterministically', () => {
    const parsed = parseStoredBlogFormulaV2(legacyFormulaFixture);
    expect(parsed.schemaVersion).toBe('blog_formula_v2.1');
    expect(parsed.titleFormula[0].pattern).toBe('{메인키워드} 걱정 없이 확인할 점');
    expect(parsed.introFormula.sequence).toEqual(['고객의 핵심 걱정', '오늘 확인할 기준 예고']);
    expect(parsed.medicalSafetyFormula.requiredDisclosures).toEqual(['개인차', '부작용 가능성', '의료진 상담']);
    expect(parsed.medicalSafetyFormula.bannedClaims).toContain('효과보장');
    expect(parsed.ctaFormula.softPatterns).toEqual(['본인 상태 확인 → 의료진 상담 권유']);
  });
});
