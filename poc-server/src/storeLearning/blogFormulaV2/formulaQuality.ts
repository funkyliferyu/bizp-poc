import type { BlogFormulaSetV2 } from './types.js';

export type BlogFormulaV2QualityIssue = {
  code:
    | 'title_formula_empty'
    | 'title_pattern_not_slot_based'
    | 'intro_sequence_too_short'
    | 'body_sequence_too_short'
    | 'heading_patterns_empty'
    | 'tone_missing_sentence_habits'
    | 'cta_soft_patterns_empty'
    | 'footer_sequence_too_short'
    | 'banned_claims_empty'
    | 'required_disclosures_empty'
    | 'vague_rule_detected';
  block: string;
  message: string;
};

const VAGUE_STOCK_PHRASES = ['정보 제공 중심', '친근한 톤', '친근하고 전문적', '전문적인 문체', '정보 제공형 제목'];

function vagueIssues(block: string, values: string[]): BlogFormulaV2QualityIssue[] {
  return values
    .filter((value) => VAGUE_STOCK_PHRASES.some((phrase) => value.trim() === phrase))
    .map((value) => ({
      code: 'vague_rule_detected' as const,
      block,
      message: `추상 룰 금지: "${value}"는 생성 지침이 아닙니다.`
    }));
}

export function evaluateBlogFormulaV2Quality(formula: BlogFormulaSetV2): BlogFormulaV2QualityIssue[] {
  const issues: BlogFormulaV2QualityIssue[] = [];

  if (formula.titleFormula.length === 0) {
    issues.push({ code: 'title_formula_empty', block: 'titleFormula', message: '제목 공식이 비어 있습니다.' });
  }
  for (const title of formula.titleFormula) {
    if (!/\{[^}]+\}/u.test(title.pattern)) {
      issues.push({
        code: 'title_pattern_not_slot_based',
        block: 'titleFormula',
        message: `슬롯 기반 패턴이 아닙니다: "${title.pattern}"`
      });
    }
  }
  if (formula.introFormula.sequence.length < 3) {
    issues.push({ code: 'intro_sequence_too_short', block: 'introFormula', message: '도입부 무브 시퀀스가 3개 미만입니다.' });
  }
  if (formula.bodyFormula.sequence.length < 4) {
    issues.push({ code: 'body_sequence_too_short', block: 'bodyFormula', message: '본문 전개 시퀀스가 4개 미만입니다.' });
  }
  if (formula.headingFormula.patterns.length === 0) {
    issues.push({ code: 'heading_patterns_empty', block: 'headingFormula', message: '소제목 패턴이 비어 있습니다.' });
  }
  if (formula.toneAndMannerFormula.preferredPhrases.length === 0 && formula.toneAndMannerFormula.endingStyle.length === 0) {
    issues.push({
      code: 'tone_missing_sentence_habits',
      block: 'toneAndMannerFormula',
      message: '톤 공식에 재사용 가능한 문장 습관(선호 표현/어미)이 없습니다.'
    });
  }
  if (formula.ctaFormula.softPatterns.length === 0) {
    issues.push({ code: 'cta_soft_patterns_empty', block: 'ctaFormula', message: 'soft CTA 패턴이 비어 있습니다.' });
  }
  if (formula.footerFormula.sequence.length < 2) {
    issues.push({ code: 'footer_sequence_too_short', block: 'footerFormula', message: '푸터 시퀀스가 2개 미만입니다.' });
  }
  if (formula.medicalSafetyFormula.bannedClaims.length === 0) {
    issues.push({ code: 'banned_claims_empty', block: 'medicalSafetyFormula', message: '금지 클레임 목록이 비어 있습니다.' });
  }
  if (formula.medicalSafetyFormula.requiredDisclosures.length === 0) {
    issues.push({ code: 'required_disclosures_empty', block: 'medicalSafetyFormula', message: '필수 고지 목록이 비어 있습니다.' });
  }

  issues.push(...vagueIssues('titleFormula', formula.titleFormula.map((title) => title.pattern)));
  issues.push(...vagueIssues('introFormula', formula.introFormula.sequence));
  issues.push(...vagueIssues('bodyFormula', formula.bodyFormula.sequence));
  issues.push(...vagueIssues('toneAndMannerFormula', formula.toneAndMannerFormula.style));

  return issues;
}
