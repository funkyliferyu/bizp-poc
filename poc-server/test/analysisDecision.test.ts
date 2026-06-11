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
