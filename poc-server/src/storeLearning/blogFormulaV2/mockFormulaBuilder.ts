import type { OwnerBlogPostV2 } from './sourcePosts.js';
import {
  BlogFormulaSetV2Schema,
  DEFAULT_BANNED_CLAIMS,
  DEFAULT_HOURS_POLICY,
  DEFAULT_REVIEW_USAGE_POLICY,
  type BlogFormulaSetV2
} from './types.js';

export function buildGenerationReadyMockFormula(posts: OwnerBlogPostV2[]): BlogFormulaSetV2 {
  const ids = posts.map((post) => post.collectionItemId);
  const evidence = {
    sourcePostIds: ids,
    confidence: posts.length >= 3 ? 0.88 : 0.62,
    status: posts.length >= 3 ? ('confirmed' as const) : ('candidate' as const)
  };

  return BlogFormulaSetV2Schema.parse({
    schemaVersion: 'blog_formula_v2.1',
    titleFormula: [
      {
        ...evidence,
        name: 'risk_avoidance_method',
        pattern: '{지역키워드}{시술명}, {부작용/실패} 없이 {효과/만족도}를 높이는 방법은 따로 있습니다'
      },
      {
        ...evidence,
        name: 'criteria_before_decision',
        pattern: '{시술명}{가격/샷수}, 그보다 먼저 확인해야 하는 {숫자}가지'
      }
    ],
    introFormula: {
      ...evidence,
      name: '걱정 공감형 도입',
      description: '인사-소개-걱정 제시-공감-예고 순서의 도입 무브',
      sequence: ['짧은 인사', '매장/대표자 소개', '독자가 실제로 가질 법한 걱정 제시', '그 걱정이 타당하다고 공감', '오늘 다룰 내용 예고']
    },
    bodyFormula: {
      ...evidence,
      name: '고민-원리-판단기준 전개',
      description: '독자 고민에서 원리, 판단 기준, soft CTA로 이어지는 전개',
      sequence: [
        '독자의 고민/오해 제시',
        '왜 그런 고민이 생기는지 설명',
        '시술/서비스 원리 설명',
        '부작용 또는 불만족이 생기는 이유 설명',
        '선택 기준 2~3개 제시',
        'soft CTA',
        '위치/연락처와 의료 고지'
      ]
    },
    headingFormula: {
      ...evidence,
      name: '질문/기준형 소제목',
      description: '질문형, 리스크형, 원리형, 기준형 소제목 혼용',
      patterns: ['{시술명} 부작용, 왜 생길까요?', '{시술명} 전 확인해야 하는 기준', '{시술명/장비} 원리 간단 정리']
    },
    toneAndMannerFormula: {
      ...evidence,
      persona: '담당자가 직접 설명하는 듯한 1인칭 전문가 톤',
      style: ['친근함', '전문적', '조심스러움', '교육형'],
      preferredPhrases: ['많은 분들이 걱정하시는 부분이에요', '쉽게 설명해 드릴게요', '꼼꼼히 확인하셨으면 좋겠습니다'],
      endingStyle: ['해요', '답니다', '좋겠습니다'],
      empathyPatterns: ['그런 걱정이 드는 것은 자연스럽습니다'],
      emojiPolicy: { allowed: ['^^', '😊'], usage: '소량 사용' }
    },
    ctaFormula: {
      ...evidence,
      primaryStyle: '강한 예약 유도보다 선택 기준 제시형 soft CTA',
      softPatterns: [
        '방문 전 이 기준만큼은 확인해 보시길 권해드립니다.',
        '오늘 글이 고민 중이신 분들께 도움이 되었으면 좋겠습니다.'
      ],
      hardReservationAllowed: false
    },
    footerFormula: {
      ...evidence,
      sequence: ['감사 인사', '매장/대표자 서명', '신뢰 신호', '위치/연락처', '의료 고지'],
      hoursPolicy: DEFAULT_HOURS_POLICY
    },
    medicalSafetyFormula: {
      ...evidence,
      bannedClaims: DEFAULT_BANNED_CLAIMS,
      requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담'],
      reviewUsagePolicy: DEFAULT_REVIEW_USAGE_POLICY
    }
  });
}
