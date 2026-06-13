import {
  BlogDraftOutputV2Schema,
  type BlogDraftOutputV2,
  type BlogFormulaSetV2,
  type BlogRetrievedSampleV2,
  type BlogTopicBriefInput,
  type ModelReportedComplianceV2
} from './types.js';

export type BlogDraftCreativeV2 = {
  titleCandidates: string[];
  selectedTitle: string;
  blogDraft: string;
};

export type BlogDraftReportsV2 = {
  styleComplianceReport: {
    formulaSetId: string;
    sourcePostIds: string[];
    appliedBlocks: string[];
  };
  safetyCheck: {
    requiredDisclosures: string[];
    bannedPhrasesAvoided: boolean;
  };
  seoCheck: {
    mainKeywordInTitle: boolean;
    mainKeywordInIntro: boolean;
    secondaryKeywordsUsed: string[];
  };
};

const SLOT_FILL_MAP: Record<string, (brief: BlogTopicBriefInput) => string> = {
  시술명: (brief) => brief.topic,
  주제: (brief) => brief.topic,
  메인키워드: (brief) => brief.mainKeyword
};

function fillTitleSlots(pattern: string, brief: BlogTopicBriefInput) {
  return pattern
    .replace(/\{([^}]+)\}/gu, (_, rawSlot: string) => {
      const slot = rawSlot.split('/')[0].trim();
      const fill = SLOT_FILL_MAP[slot];
      if (fill) return fill(brief);
      if (rawSlot.includes('부작용') || rawSlot.includes('실패')) return brief.coreConcern ?? '부작용 걱정';
      return brief.mainKeyword;
    })
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

export function buildDeterministicDraftCreative(
  formula: BlogFormulaSetV2,
  topicBrief: BlogTopicBriefInput,
  samples: BlogRetrievedSampleV2[]
): BlogDraftCreativeV2 {
  const fallbackTitle = `${topicBrief.mainKeyword} 걱정 없이 확인할 점`;
  const secondary = topicBrief.secondaryKeywords.slice(0, 2).join(', ');
  const targetReader = topicBrief.targetReader ?? `${topicBrief.topic}을 고민하는 고객`;
  const concern = topicBrief.coreConcern ?? `${topicBrief.mainKeyword} 관련 걱정`;
  const angle = topicBrief.mainAngle ?? '원리와 상담 기준을 차분히 설명';
  const sampleTitles = samples.map((sample) => sample.title).filter(Boolean).slice(0, 3);
  const cta = topicBrief.ctaDirection ?? '상담 예약';

  const slotFilledTitles = formula.titleFormula.map((title) => fillTitleSlots(title.pattern, topicBrief));
  const fallbackTitleCandidates = [
    fallbackTitle,
    `${topicBrief.topic} 전 ${concern}를 먼저 확인해야 하는 이유`,
    `${topicBrief.topic} 상담 전 알아둘 기준`
  ];
  const titleCandidates = Array.from(new Set([...slotFilledTitles, ...fallbackTitleCandidates]));
  const selectedTitle =
    titleCandidates.find(
      (candidate) => candidate.includes(topicBrief.mainKeyword) || candidate.includes(topicBrief.topic)
    ) ?? fallbackTitle;

  const preferredPhrase = formula.toneAndMannerFormula.preferredPhrases[0];
  const softCta = formula.ctaFormula.softPatterns[0];

  const baseDisclosureLine =
    '개인차가 있으며 피부 상태에 따라 붉어짐, 열감, 색소 변화 등 부작용 가능성이 있을 수 있으므로 의료진 상담 후 결정해 주세요.';
  const missingDisclosures = formula.medicalSafetyFormula.requiredDisclosures.filter(
    (disclosure) => !baseDisclosureLine.includes(disclosure)
  );
  const disclosureLine =
    missingDisclosures.length > 0
      ? `${baseDisclosureLine} (${missingDisclosures.join(', ')})`
      : baseDisclosureLine;

  const blogDraft = [
    `${topicBrief.mainKeyword}을 검색하는 ${targetReader}이라면 ${concern}가 가장 먼저 떠오를 수 있습니다.`,
    `${preferredPhrase ? `${preferredPhrase} ` : ''}오늘은 ${angle}하는 방향으로 ${topicBrief.topic} 상담 전 확인할 내용을 정리하겠습니다.`,
    `먼저 기존 블로그에서는 ${sampleTitles.join(', ') || '고객 걱정과 판단 기준'}처럼 걱정을 먼저 다루고 원리와 주의사항을 이어서 설명하는 흐름이 반복됩니다.`,
    secondary
      ? `${secondary} 같은 보조 키워드는 본문 중간에서 자연스럽게 연결하고, 같은 표현을 과하게 반복하지 않습니다.`
      : '보조 키워드는 본문 흐름에 맞는 위치에만 자연스럽게 배치합니다.',
    disclosureLine,
    `${cta}을 원하시면 현재 피부 상태와 기대 범위를 함께 확인한 뒤 계획을 세우는 방식으로 안내드립니다.${softCta ? `\n\n${softCta}` : ''}`
  ].join('\n\n');

  return { titleCandidates, selectedTitle, blogDraft };
}

function appliedFormulaBlocks(formula: BlogFormulaSetV2): string[] {
  const blocks: string[] = [];
  if (formula.titleFormula.length > 0) blocks.push('titleFormula');
  if (formula.introFormula.sequence.length > 0) blocks.push('introFormula');
  if (formula.bodyFormula.sequence.length > 0) blocks.push('bodyFormula');
  if (formula.headingFormula.patterns.length > 0) blocks.push('headingFormula');
  if (formula.toneAndMannerFormula.preferredPhrases.length > 0 || formula.toneAndMannerFormula.style.length > 0) {
    blocks.push('toneAndMannerFormula');
  }
  if (formula.ctaFormula.softPatterns.length > 0) blocks.push('ctaFormula');
  if (formula.footerFormula.sequence.length > 0) blocks.push('footerFormula');
  if (formula.medicalSafetyFormula.requiredDisclosures.length > 0) blocks.push('medicalSafetyFormula');
  return blocks;
}

// A banned claim like "최고/1위/유일" packs several phrases; split on "/" so each
// is checked independently against the generated text.
function bannedClaimMentioned(text: string, bannedClaims: string[]) {
  return bannedClaims.some((claim) => {
    const parts = claim.includes('/') ? claim.split('/').map((part) => part.trim()) : [claim];
    return parts.some((part) => part.length > 0 && text.includes(part));
  });
}

type DeriveDraftReportsInput = {
  formulaSetId: string;
  formula: BlogFormulaSetV2;
  topicBrief: BlogTopicBriefInput;
  samples: BlogRetrievedSampleV2[];
  selectedTitle: string;
  blogDraft: string;
};

export function deriveDraftReports(input: DeriveDraftReportsInput): BlogDraftReportsV2 {
  const { formulaSetId, formula, topicBrief, samples, selectedTitle, blogDraft } = input;
  const combinedText = `${selectedTitle}\n${blogDraft}`;
  const firstParagraph = blogDraft.split(/\n{2,}/)[0] ?? blogDraft;

  return {
    styleComplianceReport: {
      formulaSetId,
      sourcePostIds: samples.map((sample) => sample.collectionItemId),
      appliedBlocks: appliedFormulaBlocks(formula)
    },
    safetyCheck: {
      requiredDisclosures: formula.medicalSafetyFormula.requiredDisclosures,
      bannedPhrasesAvoided: !bannedClaimMentioned(combinedText, formula.medicalSafetyFormula.bannedClaims)
    },
    seoCheck: {
      mainKeywordInTitle: selectedTitle.includes(topicBrief.mainKeyword),
      mainKeywordInIntro: firstParagraph.includes(topicBrief.mainKeyword),
      secondaryKeywordsUsed: topicBrief.secondaryKeywords.filter((keyword) => combinedText.includes(keyword))
    }
  };
}

export function assembleDraftOutput(
  creative: BlogDraftCreativeV2,
  reports: BlogDraftReportsV2,
  modelReportedCompliance?: ModelReportedComplianceV2 | null
): BlogDraftOutputV2 {
  return BlogDraftOutputV2Schema.parse({
    titleCandidates: creative.titleCandidates,
    selectedTitle: creative.selectedTitle,
    blogDraft: creative.blogDraft,
    styleComplianceReport: reports.styleComplianceReport,
    safetyCheck: reports.safetyCheck,
    seoCheck: reports.seoCheck,
    modelReportedCompliance: modelReportedCompliance ?? null
  });
}
