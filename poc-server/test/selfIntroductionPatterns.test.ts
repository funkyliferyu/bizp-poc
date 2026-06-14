import { describe, expect, it } from 'vitest';
import {
  analyzeSelfIntroductionPatterns,
  fillSelfIntroductionTemplate,
  matchesAnySelfIntroductionPattern
} from '../src/storeLearning/blogFormulaV2/selfIntroductionPatterns.js';
import type { OwnerBlogPostV2 } from '../src/storeLearning/blogFormulaV2/sourcePosts.js';

const STORE_NAME = '테라스의원';

function post(collectionItemId: string, bodyText: string): OwnerBlogPostV2 {
  return {
    collectionItemId,
    title: null,
    sourceUrl: null,
    bodyText,
    charCount: bodyText.length,
    isTruncated: false,
    sourceKind: 'owner_blog_post',
    publishedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z'
  };
}

describe('analyzeSelfIntroductionPatterns', () => {
  it('returns [] when no posts have a detectable greeting', () => {
    const posts = [post('p1', '리팟레이저 부작용을 검색하는 분들은 흑자 치료 후 색소침착을 가장 걱정합니다.')];
    expect(analyzeSelfIntroductionPatterns(posts, STORE_NAME)).toEqual([]);
  });

  it('discovers the director-greeting and name-greeting patterns with usage ratios', () => {
    const posts = [
      post('p1', '안녕하세요. 테라스의원 대표원장 권유정입니다.\n\n오늘은 리팟레이저를 다룹니다.'),
      post('p2', '안녕하세요. 테라스의원 대표원장 권유정입니다.\n\n오늘은 흑자 치료를 다룹니다.'),
      post('p3', '안녕하세요. 테라스의원 대표원장 권유정입니다.\n\n오늘은 색소침착을 다룹니다.'),
      // Reversed word order: "{name} 원장입니다" instead of "원장 {name}입니다".
      post('p4', '안녕하세요. 인모드 공식 인증 피부과, 테라스의원 권유정 원장입니다.\n\n오늘은 인모드를 다룹니다.'),
      // No director name detected near the greeting.
      post('p5', '안녕하세요. 테라스의원입니다.\n\n오늘은 흑자 제거를 다룹니다.'),
      // Badge before the store name, still no director name.
      post('p6', '안녕하세요. [리팟레이저 공식 인증 피부과] 테라스의원입니다.\n\n오늘은 리팟레이저를 다룹니다.'),
      // No "안녕하세요" at all - excluded from both groups and the denominator.
      post('p7', '리팟레이저는 흑자 치료에 사용되는 장비입니다.')
    ];

    const patterns = analyzeSelfIntroductionPatterns(posts, STORE_NAME);

    expect(patterns).toHaveLength(2);
    const [top, second] = patterns;

    expect(top.id).toBe('store_director_greeting');
    expect(top.directorName).toBe('권유정');
    expect(top.template).toBe('안녕하세요. {storeName} 대표원장 {directorName}입니다.');
    expect(top.sourcePostIds).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(top.usageCount).toBe(4);
    expect(top.usageRatio).toBeCloseTo(4 / 6);
    expect(top.status).toBe('confirmed');

    expect(second.id).toBe('store_name_greeting');
    expect(second.directorName).toBeNull();
    expect(second.template).toBe('안녕하세요. {storeName}입니다.');
    expect(second.sourcePostIds).toEqual(['p5', 'p6']);
    expect(second.usageCount).toBe(2);
    expect(second.usageRatio).toBeCloseTo(2 / 6);

    // Sorted by usageRatio descending.
    expect(top.usageRatio).toBeGreaterThan(second.usageRatio);
  });

  it('ignores "안녕하세요" that is not near the store name', () => {
    const posts = [post('p1', '환자분이 진료실에 들어오며 "안녕하세요"라고 인사했습니다.\n\n오늘은 시술을 다룹니다.')];
    expect(analyzeSelfIntroductionPatterns(posts, STORE_NAME)).toEqual([]);
  });

  it('strips zero-width spaces before matching', () => {
    const zwsp = '​';
    const posts = [post('p1', `안녕하세요${zwsp}.${zwsp} 테라스의원${zwsp} 대표원장${zwsp} 권유정입니다.`)];
    const patterns = analyzeSelfIntroductionPatterns(posts, STORE_NAME);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].id).toBe('store_director_greeting');
    expect(patterns[0].directorName).toBe('권유정');
  });
});

describe('fillSelfIntroductionTemplate', () => {
  it('fills storeName and directorName placeholders', () => {
    const pattern = analyzeSelfIntroductionPatterns(
      [post('p1', '안녕하세요. 테라스의원 대표원장 권유정입니다.')],
      STORE_NAME
    )[0];
    expect(fillSelfIntroductionTemplate(pattern, STORE_NAME)).toBe('안녕하세요. 테라스의원 대표원장 권유정입니다.');
  });

  it('fills storeName only for the name-greeting pattern', () => {
    const pattern = analyzeSelfIntroductionPatterns([post('p1', '안녕하세요. 테라스의원입니다.')], STORE_NAME)[0];
    expect(fillSelfIntroductionTemplate(pattern, STORE_NAME)).toBe('안녕하세요. 테라스의원입니다.');
  });
});

describe('matchesAnySelfIntroductionPattern', () => {
  const patterns = analyzeSelfIntroductionPatterns(
    [
      post('p1', '안녕하세요. 테라스의원 대표원장 권유정입니다.'),
      post('p2', '안녕하세요. 테라스의원 대표원장 권유정입니다.'),
      post('p3', '안녕하세요. 테라스의원입니다.')
    ],
    STORE_NAME
  );

  it('returns true with no patterns to check against', () => {
    expect(matchesAnySelfIntroductionPattern('안녕하세요. 무엇이든 가능합니다.', [], STORE_NAME)).toBe(true);
  });

  it('matches the director-greeting opener, tolerating spacing differences', () => {
    expect(matchesAnySelfIntroductionPattern('안녕하세요. 테라스 의원 대표원장 권유정입니다.\n\n오늘은...', patterns, STORE_NAME)).toBe(
      true
    );
  });

  it('matches the name-greeting opener', () => {
    expect(matchesAnySelfIntroductionPattern('안녕하세요. 테라스의원입니다.\n\n오늘은...', patterns, STORE_NAME)).toBe(true);
  });

  it('rejects an invented self-introduction phrase', () => {
    expect(
      matchesAnySelfIntroductionPattern('안녕하세요. 😊 테라스 의원의 의료진입니다.\n\n오늘은...', patterns, STORE_NAME)
    ).toBe(false);
  });
});
