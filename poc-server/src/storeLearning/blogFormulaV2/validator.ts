import { matchesAnySelfIntroductionPattern } from './selfIntroductionPatterns.js';
import type { BlogTopicBriefInput, SelfIntroductionPatternV2 } from './types.js';
import { BlogDraftValidationResultV2Schema, type BlogDraftValidationResultV2 } from './types.js';

type RetrievedSampleForValidation = {
  collectionItemId: string;
  title: string | null;
  bodyText: string;
};

export type BlogFormulaV2DraftTextInput = {
  selectedTitle: string;
  blogDraft: string;
  topicBrief: BlogTopicBriefInput;
  retrievedSamples?: RetrievedSampleForValidation[];
  selfIntroductionPatterns?: SelfIntroductionPatternV2[];
  storeName?: string;
};

const bannedMedicalAdPhrases = [
  '효과보장',
  '효능 보장',
  '100% 효과',
  '완전 제거',
  '부작용 없음',
  '100% 안전',
  '전국 최고',
  '최고의',
  '1위',
  '유일',
  '타 병원보다 우수',
  '무조건 개선'
];

const defaultRequiredDisclosures = ['개인차', '부작용 가능성', '의료진 상담'];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.replace(/(을|를|은|는|이|가|과|와|으로|로|에|의|도|만|부터|까지)$/u, ''))
    .filter((token) => token.length >= 2);
}

function includesDisclosure(candidate: string, disclosure: string) {
  if (candidate.includes(disclosure)) return true;
  if (disclosure === '부작용 가능성') return candidate.includes('부작용') && /가능|발생|생길 수/.test(candidate);
  if (disclosure === '의료진 상담') return candidate.includes('의료진') && candidate.includes('상담');
  return false;
}

function sampleOverlapEvidence(candidate: string, samples: RetrievedSampleForValidation[]) {
  const candidateTokens = new Set(tokenize(candidate));
  for (const sample of samples) {
    const sampleTokens = Array.from(new Set(tokenize(`${sample.title ?? ''} ${sample.bodyText}`))).filter(
      (token) => token.length >= 3
    );
    const overlap = sampleTokens.filter((token) => candidateTokens.has(token));
    if (overlap.length >= 2) {
      return `${sample.collectionItemId}: ${overlap.slice(0, 5).join(', ')}`;
    }
  }
  return null;
}

export function validateBlogFormulaV2DraftText(input: BlogFormulaV2DraftTextInput): BlogDraftValidationResultV2 {
  const issues: BlogDraftValidationResultV2['issues'] = [];
  const candidateText = `${input.selectedTitle}\n${input.blogDraft}`;
  const normalizedCandidate = normalizeText(candidateText);
  const requiredDisclosures = Array.from(new Set([...defaultRequiredDisclosures, ...input.topicBrief.mustInclude]));

  if (/[\u0400-\u04FF]|\uFFFD/.test(candidateText)) {
    issues.push({
      code: 'broken_unicode',
      severity: 'error',
      message: '본문에 깨진 문자열이나 비정상 스크립트 문자가 포함되어 있습니다.'
    });
  }

  for (const phrase of bannedMedicalAdPhrases) {
    if (candidateText.includes(phrase)) {
      issues.push({
        code: 'banned_medical_ad_phrase',
        severity: 'error',
        message: `의료광고 리스크가 있는 표현을 제거해야 합니다: ${phrase}`,
        evidence: phrase
      });
    }
  }

  const missingDisclosures = requiredDisclosures.filter((disclosure) => !includesDisclosure(candidateText, disclosure));
  if (missingDisclosures.length > 0) {
    issues.push({
      code: 'missing_required_disclosure',
      severity: 'error',
      message: `필수 고지 문구가 부족합니다: ${missingDisclosures.join(', ')}`,
      evidence: missingDisclosures.join(', ')
    });
  }

  const overlapEvidence = sampleOverlapEvidence(candidateText, input.retrievedSamples ?? []);
  if (overlapEvidence) {
    issues.push({
      code: 'sample_copy_overlap',
      severity: 'warning',
      message: '검색 샘플과 겹치는 핵심 표현이 많아 문장 복사 여부를 검토해야 합니다.',
      evidence: overlapEvidence
    });
  }

  if (
    input.selfIntroductionPatterns &&
    input.selfIntroductionPatterns.length > 0 &&
    input.storeName &&
    !matchesAnySelfIntroductionPattern(input.blogDraft, input.selfIntroductionPatterns, input.storeName)
  ) {
    issues.push({
      code: 'self_introduction_pattern_mismatch',
      severity: 'warning',
      message: '본문 도입부 인사가 기존 블로그의 자기소개 패턴(introFormula.selfIntroductionPatterns)과 일치하지 않습니다.'
    });
  }

  if (/\b\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}\b/.test(candidateText)) {
    issues.push({
      code: 'hardcoded_operating_hours',
      severity: 'warning',
      message: '진료시간을 본문에 하드코딩했습니다. 최신 Place/매장 정보와 다를 수 있어 검토가 필요합니다.'
    });
  }

  if (!input.selectedTitle.includes(input.topicBrief.mainKeyword)) {
    issues.push({
      code: 'main_keyword_missing_from_title',
      severity: 'warning',
      message: '제목에 메인 키워드가 그대로 포함되어 있지 않습니다.'
    });
  }

  const firstParagraph = input.blogDraft.split(/\n{2,}/)[0] ?? input.blogDraft;
  if (!firstParagraph.includes(input.topicBrief.mainKeyword)) {
    issues.push({
      code: 'main_keyword_missing_from_intro',
      severity: 'warning',
      message: '첫 문단에 메인 키워드가 포함되어 있지 않습니다.'
    });
  }

  for (const phrase of input.topicBrief.mustAvoid) {
    if (phrase && normalizedCandidate.includes(normalizeText(phrase))) {
      issues.push({
        code: 'brief_must_avoid_phrase',
        severity: 'error',
        message: `Brief에서 피하라고 지정한 표현이 포함되어 있습니다: ${phrase}`,
        evidence: phrase
      });
    }
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const result: BlogDraftValidationResultV2 = {
    status: hasError ? 'failed' : hasWarning ? 'needs_human_review' : 'pass',
    riskLevel: hasError ? 'high' : hasWarning ? 'medium' : 'low',
    issues,
    summary: hasError
      ? '게시 전 필수 수정이 필요합니다.'
      : hasWarning
        ? '자동 생성은 가능하지만 사람 검수가 필요합니다.'
        : 'V2 deterministic 검수 기준을 통과했습니다.'
  };

  return BlogDraftValidationResultV2Schema.parse(result);
}
