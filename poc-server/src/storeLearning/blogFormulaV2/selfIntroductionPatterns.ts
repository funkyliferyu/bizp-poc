import type { OwnerBlogPostV2 } from './sourcePosts.js';
import type { SelfIntroductionPatternV2 } from './types.js';

const GREETING = '안녕하세요';
const OPENING_WINDOW_CHARS = 200;

// Naver's mobile editor pads body text with zero-width spaces (U+200B and
// friends) used purely for line-spacing; strip them before pattern matching.
const ZERO_WIDTH_CHARS = /[​‌‍﻿]/gu;

function normalizeForAnalysis(text: string) {
  return text.replace(ZERO_WIDTH_CHARS, '').replace(/\s+/gu, ' ').trim();
}

function collapseForMatch(text: string) {
  return text.replace(ZERO_WIDTH_CHARS, '').replace(/\s+/gu, '');
}

// Try "(대표)원장 {name}입니다" first, then the reversed "{name} 원장입니다" order.
function extractDirectorName(opening: string): string | null {
  const direct = opening.match(/(?:대표)?원장\s*([가-힣]{2,4})입니다/u);
  if (direct) return direct[1];
  const reversed = opening.match(/([가-힣]{2,4})\s*원장입니다/u);
  if (reversed) return reversed[1];
  return null;
}

type PatternGroup = {
  sourcePostIds: string[];
  examples: string[];
  directorNameCounts: Map<string, number>;
};

function mostCommonDirectorName(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Discover the repeating self-introduction/greeting openers used across the
 * store's own owner_blog_post history, grouped into:
 * - `store_director_greeting`: "안녕하세요. {storeName} 대표원장 {directorName}입니다."
 * - `store_name_greeting`: "안녕하세요. {storeName}입니다." (fallback when no
 *   director name is detected near the greeting)
 *
 * Posts with no detectable "안녕하세요" opener are ignored. `usageRatio` is
 * each pattern's share among posts that DO have a detectable opener, so the
 * returned ratios sum to ~1. Results are sorted by usageRatio descending.
 */
export function analyzeSelfIntroductionPatterns(
  posts: OwnerBlogPostV2[],
  storeName: string
): SelfIntroductionPatternV2[] {
  const groups = new Map<'store_director_greeting' | 'store_name_greeting', PatternGroup>();
  const normalizedStoreName = collapseForMatch(storeName);
  let totalWithGreeting = 0;

  for (const post of posts) {
    const normalized = normalizeForAnalysis(post.bodyText);
    const greetingIndex = normalized.indexOf(GREETING);
    if (greetingIndex === -1) continue;

    const opening = normalized.slice(greetingIndex, greetingIndex + OPENING_WINDOW_CHARS);
    // Only treat this as a self-introduction opener if the store's own name
    // appears nearby - otherwise "안녕하세요" may just be a quoted greeting.
    if (!collapseForMatch(opening).includes(normalizedStoreName)) continue;
    const directorName = extractDirectorName(opening);
    const id = directorName ? 'store_director_greeting' : 'store_name_greeting';

    totalWithGreeting += 1;
    let group = groups.get(id);
    if (!group) {
      group = { sourcePostIds: [], examples: [], directorNameCounts: new Map() };
      groups.set(id, group);
    }
    group.sourcePostIds.push(post.collectionItemId);
    group.examples.push(opening.slice(0, 80));
    if (directorName) {
      group.directorNameCounts.set(directorName, (group.directorNameCounts.get(directorName) ?? 0) + 1);
    }
  }

  if (totalWithGreeting === 0) return [];

  const patterns: SelfIntroductionPatternV2[] = [];
  for (const [id, group] of groups) {
    const usageCount = group.sourcePostIds.length;
    const usageRatio = Number((usageCount / totalWithGreeting).toFixed(4));
    const directorName = id === 'store_director_greeting' ? mostCommonDirectorName(group.directorNameCounts) : null;
    const template =
      id === 'store_director_greeting'
        ? `${GREETING}. {storeName} 대표원장 {directorName}입니다.`
        : `${GREETING}. {storeName}입니다.`;

    patterns.push({
      id,
      template,
      directorName,
      example: group.examples[0] ?? '',
      sourcePostIds: group.sourcePostIds,
      usageCount,
      usageRatio,
      confidence: usageRatio,
      status: usageCount >= 3 ? 'confirmed' : 'candidate'
    });
  }

  return patterns.sort((left, right) => right.usageRatio - left.usageRatio);
}

export function fillSelfIntroductionTemplate(pattern: SelfIntroductionPatternV2, storeName: string): string {
  return pattern.template.replace('{storeName}', storeName).replace('{directorName}', pattern.directorName ?? '');
}

/**
 * Checks whether blogDraft's opening reproduces one of the store's known
 * self-introduction patterns (whitespace/zero-width-space insensitive).
 * Returns true when `patterns` is empty - there is nothing to constrain
 * against.
 */
export function matchesAnySelfIntroductionPattern(
  blogDraft: string,
  patterns: SelfIntroductionPatternV2[],
  storeName: string
): boolean {
  if (patterns.length === 0) return true;
  const opening = collapseForMatch(blogDraft.slice(0, OPENING_WINDOW_CHARS));
  return patterns.some((pattern) => opening.startsWith(collapseForMatch(fillSelfIntroductionTemplate(pattern, storeName))));
}
