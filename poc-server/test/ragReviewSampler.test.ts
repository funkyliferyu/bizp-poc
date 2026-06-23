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
  it('keeps every collected review when there are at most 200', () => {
    const selected = selectReviewSample(reviews(200), { seed: 'store:run' });

    expect(selected).toHaveLength(200);
    expect(selected.map((review) => review.id)).toEqual(reviews(200).map((review) => review.id));
  });

  it('keeps latest 20 and samples 180 older reviews when there are more than 200', () => {
    const selected = selectReviewSample(reviews(240), { seed: 'store:run' });

    expect(selected).toHaveLength(200);
    expect(selected.slice(0, 20).map((review) => review.id)).toEqual(reviews(20).map((review) => review.id));
    expect(new Set(selected.map((review) => review.id)).size).toBe(200);
  });

  it('is deterministic for the same seed', () => {
    const first = selectReviewSample(reviews(240), { seed: 'store:run' }).map((review) => review.id);
    const second = selectReviewSample(reviews(240), { seed: 'store:run' }).map((review) => review.id);

    expect(second).toEqual(first);
  });
});
