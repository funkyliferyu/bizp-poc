import { describe, expect, it } from 'vitest';
import { decideAnalysisExecution } from '../src/storeLearning/analysis/analysisDecision.js';
import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../src/storeLearning/rulesets/rulesetSourceMatrix.js';

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: String(overrides.id ?? 'item_profile'),
    channel: String(overrides.channel ?? 'place'),
    sourceType: String(overrides.sourceType ?? 'profile'),
    status: String(overrides.status ?? 'collected'),
    metadata: overrides.metadata ?? { collectionDelta: 'changed' }
  };
}

function latestLearning(fieldKeys: readonly string[] = REQUIRED_ANALYZER_RULESET_FIELD_KEYS) {
  return {
    analysisRunId: 'analysis_run_previous',
    learningSnapshotId: 'learning_snapshot_previous',
    marketingRulesetId: 'marketing_ruleset_previous',
    rulesetFieldKeys: fieldKeys
  };
}

function blogPost(id: string, delta = 'new') {
  return item({ id, channel: 'blog', sourceType: 'post', metadata: { collectionDelta: delta } });
}

function placeReview(id: string, delta = 'new') {
  return item({ id, channel: 'place', sourceType: 'review', metadata: { collectionDelta: delta } });
}

describe('analysis execution decision', () => {
  it('reuses complete previous learning when the collection run has no meaningful changes', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: false,
          counts: { new: 0, duplicate: 50, unchanged: 1, changed: 0 }
        }
      },
      selectedItems: [],
      latestLearning: latestLearning()
    });

    expect(decision).toMatchObject({
      action: 'reuse_latest_learning',
      reason: 'no_meaningful_collection_changes',
      hasPreviousLearning: true,
      rulesetContractComplete: true
    });
  });

  it('reuses complete previous learning when only Place profile facts changed', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 0, duplicate: 100, unchanged: 0, changed: 1 }
        }
      },
      selectedItems: [
        item({
          id: 'profile_changed',
          metadata: { collectionDelta: 'changed', profileFingerprint: 'abc123' }
        })
      ],
      latestLearning: latestLearning()
    });

    expect(decision).toMatchObject({
      action: 'reuse_latest_learning',
      reason: 'place_profile_fact_change_only',
      selectedCounts: { blogPosts: 0, placeProfiles: 1, placeReviews: 0, total: 1 },
      hasNewBlogOrReviewEvidence: false
    });
  });

  it('routes incomplete previous learning to ruleset contract backfill before reuse', () => {
    const incompleteKeys = REQUIRED_ANALYZER_RULESET_FIELD_KEYS.filter((fieldKey) => fieldKey !== 'reviewWeakness');

    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 0, duplicate: 100, unchanged: 0, changed: 1 }
        }
      },
      selectedItems: [item({ id: 'profile_changed' })],
      latestLearning: latestLearning(incompleteKeys)
    });

    expect(decision).toMatchObject({
      action: 'backfill_latest_ruleset',
      reason: 'latest_ruleset_contract_incomplete',
      rulesetContractComplete: false,
      missingRulesetFieldKeys: ['reviewWeakness']
    });
  });

  it('runs the analyzer for first learning when selected Blog or review evidence exists', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 11, duplicate: 9, unchanged: 0, changed: 1 }
        }
      },
      selectedItems: [
        item({ id: 'profile_changed', sourceType: 'profile', metadata: { collectionDelta: 'changed' } }),
        item({ id: 'blog_new', channel: 'blog', sourceType: 'post', metadata: { collectionDelta: 'new' } }),
        item({ id: 'review_new', channel: 'place', sourceType: 'review', metadata: { collectionDelta: 'new' } })
      ],
      latestLearning: null
    });

    expect(decision).toMatchObject({
      action: 'run_analyzer',
      reason: 'initial_learning_with_selected_evidence',
      hasPreviousLearning: false,
      hasNewBlogOrReviewEvidence: true,
      selectedCounts: { blogPosts: 1, placeProfiles: 1, placeReviews: 1, total: 3 }
    });
  });

  it('runs the analyzer for first learning from cached selected evidence even when the latest collection has no meaningful changes', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: false,
          counts: { new: 0, duplicate: 60, unchanged: 1, changed: 0 }
        }
      },
      selectedItems: [
        item({
          id: 'cached_profile',
          sourceType: 'profile',
          metadata: { collectionDelta: 'unchanged' }
        }),
        item({
          id: 'cached_blog_unlearned',
          channel: 'blog',
          sourceType: 'post',
          metadata: { provider: 'naverBlogRenderedCollectionProvider' }
        })
      ],
      latestLearning: null
    });

    expect(decision).toMatchObject({
      action: 'run_analyzer',
      reason: 'initial_learning_with_selected_evidence',
      hasPreviousLearning: false,
      hasNewBlogOrReviewEvidence: true,
      selectedCounts: { blogPosts: 1, placeProfiles: 1, placeReviews: 0, total: 2 }
    });
  });

  it('reuses previous learning when existing learned stores have insufficient new evidence for ruleset regeneration', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 10, duplicate: 0, unchanged: 0, changed: 0 }
        }
      },
      selectedItems: [
        item({ id: 'profile_changed', sourceType: 'profile', metadata: { collectionDelta: 'changed' } }),
        blogPost('blog_new_1'),
        ...Array.from({ length: 9 }, (_, index) => placeReview(`review_new_${index + 1}`))
      ],
      latestLearning: latestLearning()
    });

    expect(decision).toMatchObject({
      action: 'reuse_latest_learning',
      reason: 'insufficient_new_evidence_for_ruleset_regeneration',
      hasPreviousLearning: true,
      hasNewBlogOrReviewEvidence: true,
      newEvidenceCounts: {
        blogPosts: 1,
        placeReviews: 9,
        requiredBlogPosts: 3,
        requiredPlaceReviews: 10
      }
    });
  });

  it('runs the analyzer for existing learned stores when new Blog and review thresholds are met', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 13, duplicate: 0, unchanged: 0, changed: 0 }
        }
      },
      selectedItems: [
        item({ id: 'profile_changed', sourceType: 'profile', metadata: { collectionDelta: 'changed' } }),
        ...Array.from({ length: 3 }, (_, index) => blogPost(`blog_new_${index + 1}`)),
        ...Array.from({ length: 10 }, (_, index) => placeReview(`review_new_${index + 1}`))
      ],
      latestLearning: latestLearning()
    });

    expect(decision).toMatchObject({
      action: 'run_analyzer',
      reason: 'new_selected_evidence',
      hasPreviousLearning: true,
      newEvidenceCounts: {
        blogPosts: 3,
        placeReviews: 10,
        requiredBlogPosts: 3,
        requiredPlaceReviews: 10
      }
    });
  });

  it('blocks analysis when there is no previous learning and no collected selected item', () => {
    const decision = decideAnalysisExecution({
      collectionSummary: {
        collectionDelta: {
          hasMeaningfulChanges: true,
          counts: { new: 0, duplicate: 0, unchanged: 0, changed: 0 }
        }
      },
      selectedItems: [item({ id: 'failed_blog', channel: 'blog', sourceType: 'post', status: 'failed' })],
      latestLearning: null
    });

    expect(decision).toMatchObject({
      action: 'block',
      reason: 'no_collected_selected_items',
      selectedCounts: { blogPosts: 0, placeProfiles: 0, placeReviews: 0, total: 0, failed: 1 }
    });
  });
});
