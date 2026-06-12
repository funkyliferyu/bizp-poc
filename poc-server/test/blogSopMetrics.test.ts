import { describe, expect, it } from 'vitest';
import {
  buildBlogSopAggregates,
  buildBlogSopMetrics
} from '../src/storeLearning/analysis/blogSopMetrics.js';

describe('blog SOP metrics', () => {
  it('computes body length, paragraphs, headings, hashtags, emoji, questions, and CTA candidates', () => {
    const metrics = buildBlogSopMetrics({
      title: '분당 레터링 케이크 예약 안내',
      bodyText: [
        '분당 레터링 케이크 찾고 계신가요?',
        '',
        '예약 전에는 픽업 시간과 문구를 먼저 확인해 주세요.',
        '#분당케이크 #레터링케이크 😊'
      ].join('\n')
    });

    expect(metrics.charCount).toBeGreaterThan(0);
    expect(metrics.paragraphCount).toBe(3);
    expect(metrics.headingLikeLineCount).toBe(0);
    expect(metrics.averageParagraphCharCount).toBeGreaterThan(0);
    expect(metrics.hashtags).toEqual(['#분당케이크', '#레터링케이크']);
    expect(metrics.emojiCount).toBe(1);
    expect(metrics.questionSentenceCount).toBe(1);
    expect(metrics.ctaCandidates.join(' ')).toContain('예약');
  });

  it('builds aggregate length and symbol policies without LLM inference', () => {
    const aggregate = buildBlogSopAggregates([
      buildBlogSopMetrics({ title: 'A', bodyText: '첫 문단\n\n예약 문의 주세요. #분당케이크' }),
      buildBlogSopMetrics({ title: 'B', bodyText: '첫 문단\n\n둘째 문단\n\n전화 상담 가능합니다.' })
    ]);

    expect(aggregate.lengthPolicy.source).toBe('computed');
    expect(aggregate.lengthPolicy.medianCharCount).toBeGreaterThan(0);
    expect(aggregate.symbolPolicy.source).toBe('computed');
    expect(aggregate.hashtagCandidates).toContain('#분당케이크');
    expect(aggregate.ctaCandidates.join(' ')).toContain('예약');
  });
});
