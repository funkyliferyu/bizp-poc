export type BlogSopMetrics = {
  title: string | null;
  charCount: number;
  paragraphCount: number;
  headingLikeLineCount: number;
  averageParagraphCharCount: number;
  hashtags: string[];
  emojiCount: number;
  questionSentenceCount: number;
  ctaCandidates: string[];
};

export type BlogSopAggregates = {
  source: 'computed';
  lengthPolicy: {
    source: 'computed';
    medianCharCount: number;
    medianParagraphCount: number;
    recommendedRange: string;
  };
  symbolPolicy: {
    source: 'computed';
    emoji: 'none' | 'none_or_light' | 'moderate';
    preferredSymbols: string[];
    avoid: string[];
  };
  hashtagCandidates: string[];
  ctaCandidates: string[];
};

const CTA_KEYWORDS = ['예약', '문의', '상담', '전화', '방문', '카카오', '네이버예약', '확인'];
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() ?? '';
}

function paragraphsFrom(value: string) {
  return value
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

function headingLikeLineCount(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^#{1,6}\s+\S/.test(line)) return true;
      if (/^\d+[.)]\s+\S/.test(line)) return true;
      if (/^[가-힣A-Za-z0-9\s]{2,24}$/.test(line) && !/[.!?。！？]$/.test(line)) return true;
      return false;
    }).length;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hashtagsFrom(value: string) {
  return unique(Array.from(value.matchAll(HASHTAG_PATTERN)).map((match) => match[0]));
}

function emojiCount(value: string) {
  return Array.from(value.matchAll(EMOJI_PATTERN)).length;
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function questionSentenceCount(value: string) {
  return splitSentences(value).filter((sentence) => /[?？]|궁금|까요|나요|습니까|세요\?/u.test(sentence)).length;
}

function ctaCandidates(value: string) {
  return splitSentences(value)
    .filter((sentence) => CTA_KEYWORDS.some((keyword) => sentence.includes(keyword)))
    .slice(0, 8);
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function recommendedRange(medianCharCount: number) {
  if (medianCharCount <= 0) return '본문 길이 근거 부족';
  const lower = Math.max(300, Math.round((medianCharCount * 0.75) / 50) * 50);
  const upper = Math.max(lower + 200, Math.round((medianCharCount * 1.25) / 50) * 50);
  return `${lower.toLocaleString('ko-KR')}~${upper.toLocaleString('ko-KR')}자`;
}

function emojiPolicy(totalEmojiCount: number, articleCount: number): BlogSopAggregates['symbolPolicy']['emoji'] {
  if (totalEmojiCount === 0) return 'none';
  if (articleCount === 0 || totalEmojiCount / articleCount <= 2) return 'none_or_light';
  return 'moderate';
}

export function buildBlogSopMetrics(input: { title: string | null; bodyText: string | null }): BlogSopMetrics {
  const normalized = normalizeText(input.bodyText);
  const paragraphs = paragraphsFrom(normalized);
  const charCount = normalized.replace(/\s+/g, '').length;
  const paragraphCount = paragraphs.length;
  const averageParagraphCharCount =
    paragraphCount > 0 ? Math.round(paragraphs.reduce((total, paragraph) => total + paragraph.length, 0) / paragraphCount) : 0;

  return {
    title: input.title?.trim() || null,
    charCount,
    paragraphCount,
    headingLikeLineCount: headingLikeLineCount(normalized),
    averageParagraphCharCount,
    hashtags: hashtagsFrom(normalized),
    emojiCount: emojiCount(normalized),
    questionSentenceCount: questionSentenceCount(normalized),
    ctaCandidates: ctaCandidates(normalized)
  };
}

export function buildBlogSopAggregates(metrics: BlogSopMetrics[]): BlogSopAggregates {
  const medianCharCount = median(metrics.map((item) => item.charCount));
  const totalEmojiCount = metrics.reduce((total, item) => total + item.emojiCount, 0);
  return {
    source: 'computed',
    lengthPolicy: {
      source: 'computed',
      medianCharCount,
      medianParagraphCount: median(metrics.map((item) => item.paragraphCount)),
      recommendedRange: recommendedRange(medianCharCount)
    },
    symbolPolicy: {
      source: 'computed',
      emoji: emojiPolicy(totalEmojiCount, metrics.length),
      preferredSymbols: ['-', '·'],
      avoid: ['과도한 이모지', '광고성 장식 기호']
    },
    hashtagCandidates: unique(metrics.flatMap((item) => item.hashtags)).slice(0, 20),
    ctaCandidates: unique(metrics.flatMap((item) => item.ctaCandidates)).slice(0, 12)
  };
}
