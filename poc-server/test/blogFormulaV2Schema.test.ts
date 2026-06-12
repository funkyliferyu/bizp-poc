import { describe, expect, it } from 'vitest';
import {
  BlogFormulaSetV2Schema,
  parseStoredBlogFormulaV2
} from '../src/storeLearning/blogFormulaV2/types.js';

const ids = ['item_1', 'item_2', 'item_3'];
const evidence = { sourcePostIds: ids, confidence: 0.8, status: 'confirmed' as const };

export const generationReadyFormulaFixture = {
  schemaVersion: 'blog_formula_v2.1',
  titleFormula: [
    {
      ...evidence,
      name: 'risk_avoidance_method',
      pattern:
        '{지역키워드}{시술명}, {부작용/실패/원하지 않는 결과} 없이 {효과/만족도}를 높이는 방법은 따로 있습니다'
    },
    {
      ...evidence,
      name: 'official_certification',
      pattern: '{시술명} 부작용 걱정 없이 하려면 [{시술명/장비} 공식 인증 피부과]'
    }
  ],
  introFormula: {
    ...evidence,
    name: '대표원장 신뢰 도입',
    description: '인사-소개-신뢰신호-걱정공감-예고로 이어지는 도입 무브 시퀀스',
    sequence: [
      '짧은 인사',
      '의원 또는 대표원장 소개',
      '공식 인증/전문성 신뢰 신호',
      '독자가 실제로 가질 법한 걱정 제시',
      '그 걱정이 타당하다고 공감',
      '오늘 다룰 내용 예고'
    ]
  },
  bodyFormula: {
    ...evidence,
    name: '고민-원리-판단기준 전개',
    description: '독자 고민에서 출발해 원리, 의료진 판단, 선택 기준으로 전개',
    sequence: [
      '독자의 고민/오해 제시',
      '왜 그런 고민이 생기는지 설명',
      '시술 원리 설명',
      '부작용 또는 실패 가능성이 생기는 이유 설명',
      '장비보다 의료진 판단/설계가 중요하다는 전환',
      '병원 선택 기준 2~3개 제시',
      'soft CTA',
      '병원 정보/의료 고지'
    ]
  },
  headingFormula: {
    ...evidence,
    name: '질문/기준형 소제목',
    description: '질문형, 리스크형, 원리형, 기준형 소제목을 혼용',
    patterns: ['{시술명} 부작용, 왜 생길까요?', '{시술명} 전 확인해야 하는 기준', '{장비} 원리 간단 정리']
  },
  toneAndMannerFormula: {
    ...evidence,
    persona: '대표원장이 직접 설명하는 듯한 1인칭 전문가 톤',
    style: ['친근함', '전문적', '조심스러움', '교육형'],
    preferredPhrases: ['많은 분들이 걱정하시는 부분이에요', '쉽게 설명해 드릴게요'],
    endingStyle: ['해요', '답니다', '좋겠습니다'],
    empathyPatterns: ['그 걱정은 자연스러운 반응입니다'],
    emojiPolicy: { allowed: ['^^', '😊'], usage: '소량 사용' }
  },
  ctaFormula: {
    ...evidence,
    primaryStyle: '강한 예약 유도보다 선택 기준 제시형 soft CTA',
    softPatterns: [
      '병원 방문 전 이 기준만큼은 확인해 보시길 권해드립니다.',
      '오늘 글이 고민 중이신 분들께 도움이 되었으면 좋겠습니다.'
    ],
    hardReservationAllowed: false
  },
  footerFormula: {
    ...evidence,
    sequence: ['감사 인사', '의원/대표원장 서명', '신뢰 신호', '위치/연락처', '의료 고지'],
    hoursPolicy: '운영시간 충돌 가능성이 있으면 구체적 시간을 하드코딩하지 않는다.'
  },
  medicalSafetyFormula: {
    ...evidence,
    bannedClaims: ['효과보장', '100% 효과', '완전 제거', '부작용 없음', '통증 없음', '무조건 개선', '최고/1위/유일', '타 병원보다 우수'],
    requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
    reviewUsagePolicy: '방문자 리뷰를 공개 광고 문구나 치료 결과 주장으로 변환하지 않는다.'
  }
};

export const legacyFormulaFixture = {
  schemaVersion: 'blog_formula_v2.0',
  titleFormula: { ...evidence, name: '걱정 해소형 제목', description: 'd', pattern: '{메인키워드} 걱정 없이 확인할 점' },
  introFormula: { ...evidence, name: 'n', description: 'd', pattern: '고객의 핵심 걱정 → 오늘 확인할 기준 예고' },
  bodyFormula: { ...evidence, name: 'n', description: 'd', pattern: '고민 배경 → 원리 설명 → 개인별 판단 기준 → CTA' },
  headingFormula: { ...evidence, name: 'n', description: 'd', pattern: '질문형 소제목 3-4개' },
  toneAndMannerFormula: { ...evidence, name: '차분한 의료 정보 안내', description: 'd', pattern: '차분함, 구체적 안내, 과장 회피' },
  ctaFormula: { ...evidence, name: 'n', description: '상담 확인형 CTA', pattern: '본인 상태 확인 → 의료진 상담 권유' },
  footerFormula: { ...evidence, name: 'n', description: 'd', pattern: '의료정보 제공 목적 + 개인차/부작용 가능성 + 의료진 상담' },
  medicalSafetyFormula: {
    ...evidence,
    name: 'n',
    description: 'd',
    pattern: '개인차 → 부작용 가능성 → 의료진 상담',
    requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담']
  }
};

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
