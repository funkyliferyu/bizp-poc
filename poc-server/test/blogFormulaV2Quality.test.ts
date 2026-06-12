import { describe, expect, it } from 'vitest';
import { evaluateBlogFormulaV2Quality } from '../src/storeLearning/blogFormulaV2/formulaQuality.js';
import { generationReadyFormulaFixture } from './blogFormulaV2Schema.test.js';
import { BlogFormulaSetV2Schema } from '../src/storeLearning/blogFormulaV2/types.js';

const goodFormula = BlogFormulaSetV2Schema.parse(generationReadyFormulaFixture);

describe('evaluateBlogFormulaV2Quality', () => {
  it('returns no issues for a generation-ready formula set', () => {
    expect(evaluateBlogFormulaV2Quality(goodFormula)).toEqual([]);
  });

  it('flags non-slot title patterns', () => {
    const vague = {
      ...goodFormula,
      titleFormula: [{ ...goodFormula.titleFormula[0], pattern: '정보 제공형 제목' }]
    };
    const issues = evaluateBlogFormulaV2Quality(vague);
    expect(issues.some((issue) => issue.code === 'title_pattern_not_slot_based')).toBe(true);
  });

  it('flags empty title/sequence/safety blocks', () => {
    const empty = {
      ...goodFormula,
      titleFormula: [],
      introFormula: { ...goodFormula.introFormula, sequence: [] },
      medicalSafetyFormula: { ...goodFormula.medicalSafetyFormula, bannedClaims: [] }
    };
    const codes = evaluateBlogFormulaV2Quality(empty).map((issue) => issue.code);
    expect(codes).toContain('title_formula_empty');
    expect(codes).toContain('intro_sequence_too_short');
    expect(codes).toContain('banned_claims_empty');
  });

  it('flags generic-adjective-only tone', () => {
    const generic = {
      ...goodFormula,
      toneAndMannerFormula: {
        ...goodFormula.toneAndMannerFormula,
        preferredPhrases: [],
        endingStyle: []
      }
    };
    const codes = evaluateBlogFormulaV2Quality(generic).map((issue) => issue.code);
    expect(codes).toContain('tone_missing_sentence_habits');
  });

  it('flags vague stock phrases used as whole patterns', () => {
    const vague = {
      ...goodFormula,
      introFormula: { ...goodFormula.introFormula, sequence: ['정보 제공 중심', '친근한 톤'] }
    };
    const codes = evaluateBlogFormulaV2Quality(vague).map((issue) => issue.code);
    expect(codes).toContain('vague_rule_detected');
  });
});
