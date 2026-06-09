import { describe, expect, it } from 'vitest';
import { selectReviewSample } from '../src/storeLearning/rag/reviewSampler.js';

type ReviewFixture = {
  id: string;
  newestRank: number;
};

function reviews(count: number): ReviewFixture[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `review_${index + 1}`,
    newestRank: index + 1
  }));
}

describe('RAG review sampler', () => {
  it('keeps every collected review when there are at most 100', () => {
    const selected = selectReviewSample(reviews(50), { seed: 'store:run' });

    expect(selected).toHaveLength(50);
    expect(selected.map((review) => review.id)).toEqual(reviews(50).map((review) => review.id));
  });

  it('keeps latest 20 and samples 80 older reviews when there are more than 100', () => {
    const selected = selectReviewSample(reviews(120), { seed: 'store:run' });

    expect(selected).toHaveLength(100);
    expect(selected.slice(0, 20).map((review) => review.id)).toEqual(reviews(20).map((review) => review.id));
    expect(new Set(selected.map((review) => review.id)).size).toBe(100);
  });

  it('is deterministic for the same seed', () => {
    const first = selectReviewSample(reviews(150), { seed: 'store:run' }).map((review) => review.id);
    const second = selectReviewSample(reviews(150), { seed: 'store:run' }).map((review) => review.id);

    expect(second).toEqual(first);
  });
});
