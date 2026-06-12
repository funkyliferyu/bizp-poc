import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../rulesets/rulesetSourceMatrix.js';

export const REQUIRED_NEW_BLOG_POST_COUNT = 3;
export const REQUIRED_NEW_PLACE_REVIEW_COUNT = 10;
export const INSUFFICIENT_NEW_EVIDENCE_MESSAGE =
  '재학습을 위해서는 블로그 3개, 리뷰 10개 이상의 신규 에셋이 필요합니다.';

export type AnalysisDecisionAction =
  | 'reuse_latest_learning'
  | 'backfill_latest_ruleset'
  | 'run_analyzer'
  | 'block';

export type AnalysisDecisionReason =
  | 'no_meaningful_collection_changes'
  | 'place_profile_fact_change_only'
  | 'latest_ruleset_contract_incomplete'
  | 'initial_learning_with_selected_evidence'
  | 'initial_profile_only_analysis'
  | 'new_selected_evidence'
  | 'manual_ruleset_relearn_existing_assets'
  | 'insufficient_new_evidence_for_ruleset_regeneration'
  | 'no_previous_learning_to_reuse'
  | 'no_collected_selected_items'
  | 'unsupported_selected_items';

export type AnalysisDecisionItem = {
  id: string;
  channel: string;
  sourceType: string;
  status?: string | null;
  metadata?: unknown;
};

export type AnalysisDecisionLatestLearning = {
  analysisRunId?: string | null;
  learningSnapshotId?: string | null;
  marketingRulesetId?: string | null;
  rulesetFieldKeys?: readonly string[] | null;
} | null;

export type AnalysisDecisionInput = {
  collectionSummary?: unknown;
  selectedItems: readonly AnalysisDecisionItem[];
  latestLearning?: AnalysisDecisionLatestLearning;
};

export type AnalysisSelectedCounts = {
  blogPosts: number;
  placeProfiles: number;
  placeReviews: number;
  total: number;
  failed: number;
};

export type AnalysisNewEvidenceCounts = {
  blogPosts: number;
  placeReviews: number;
  requiredBlogPosts: number;
  requiredPlaceReviews: number;
};

export type AnalysisExecutionDecision = {
  action: AnalysisDecisionAction;
  reason: AnalysisDecisionReason;
  hasPreviousLearning: boolean;
  rulesetContractComplete: boolean;
  missingRulesetFieldKeys: string[];
  hasNewBlogOrReviewEvidence: boolean;
  selectedCounts: AnalysisSelectedCounts;
  newEvidenceCounts: AnalysisNewEvidenceCounts;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasPreviousLearning(latestLearning: AnalysisDecisionLatestLearning) {
  if (!latestLearning) return false;
  return Boolean(
    asString(latestLearning.analysisRunId) &&
      asString(latestLearning.learningSnapshotId) &&
      asString(latestLearning.marketingRulesetId)
  );
}

function missingRulesetFieldKeys(latestLearning: AnalysisDecisionLatestLearning) {
  const presentFieldKeys = new Set(latestLearning?.rulesetFieldKeys ?? []);
  return REQUIRED_ANALYZER_RULESET_FIELD_KEYS.filter((fieldKey) => !presentFieldKeys.has(fieldKey));
}

function isCollected(item: AnalysisDecisionItem) {
  return !item.status || item.status === 'collected';
}

function isFailed(item: AnalysisDecisionItem) {
  return item.status === 'failed';
}

function itemDeltaState(item: AnalysisDecisionItem) {
  return asString(asRecord(item.metadata).collectionDelta);
}

function itemRulesetEvidenceState(item: AnalysisDecisionItem) {
  return asString(asRecord(item.metadata).rulesetEvidenceState);
}

function isBlogPost(item: AnalysisDecisionItem) {
  return item.channel === 'blog' && item.sourceType === 'post';
}

function isPlaceProfile(item: AnalysisDecisionItem) {
  return item.channel === 'place' && item.sourceType === 'profile';
}

function isPlaceReview(item: AnalysisDecisionItem) {
  return item.channel === 'place' && item.sourceType === 'review';
}

function hasNewOrChangedDelta(item: AnalysisDecisionItem) {
  const deltaState = itemDeltaState(item);
  return !deltaState || deltaState === 'new' || deltaState === 'changed';
}

function hasNewDelta(item: AnalysisDecisionItem) {
  return itemRulesetEvidenceState(item) !== 'already_learned' && itemDeltaState(item) === 'new';
}

function selectedCounts(items: readonly AnalysisDecisionItem[]): AnalysisSelectedCounts {
  const collected = items.filter(isCollected);
  return {
    blogPosts: collected.filter(isBlogPost).length,
    placeProfiles: collected.filter(isPlaceProfile).length,
    placeReviews: collected.filter(isPlaceReview).length,
    total: collected.length,
    failed: items.filter(isFailed).length
  };
}

export function collectionHasMeaningfulChanges(collectionSummary: unknown) {
  const collectionDelta = asRecord(asRecord(collectionSummary).collectionDelta);
  return collectionDelta.hasMeaningfulChanges === false ? false : collectionDelta.hasMeaningfulChanges === true ? true : null;
}

export function newEvidenceCounts(items: readonly AnalysisDecisionItem[]): AnalysisNewEvidenceCounts {
  const collected = items.filter(isCollected).filter(hasNewDelta);
  return {
    blogPosts: collected.filter(isBlogPost).length,
    placeReviews: collected.filter(isPlaceReview).length,
    requiredBlogPosts: REQUIRED_NEW_BLOG_POST_COUNT,
    requiredPlaceReviews: REQUIRED_NEW_PLACE_REVIEW_COUNT
  };
}

export function hasSufficientNewEvidence(counts: AnalysisNewEvidenceCounts) {
  return counts.blogPosts >= counts.requiredBlogPosts && counts.placeReviews >= counts.requiredPlaceReviews;
}

function decision(
  action: AnalysisDecisionAction,
  reason: AnalysisDecisionReason,
  input: {
    hasPreviousLearningValue: boolean;
    rulesetContractComplete: boolean;
    missingRulesetFieldKeysValue: string[];
    hasNewBlogOrReviewEvidence: boolean;
    counts: AnalysisSelectedCounts;
    newCounts: AnalysisNewEvidenceCounts;
  }
): AnalysisExecutionDecision {
  return {
    action,
    reason,
    hasPreviousLearning: input.hasPreviousLearningValue,
    rulesetContractComplete: input.rulesetContractComplete,
    missingRulesetFieldKeys: input.missingRulesetFieldKeysValue,
    hasNewBlogOrReviewEvidence: input.hasNewBlogOrReviewEvidence,
    selectedCounts: input.counts,
    newEvidenceCounts: input.newCounts
  };
}

export function decideAnalysisExecution(input: AnalysisDecisionInput): AnalysisExecutionDecision {
  const selectedItems = input.selectedItems;
  const collectedItems = selectedItems.filter(isCollected);
  const counts = selectedCounts(selectedItems);
  const newCounts = newEvidenceCounts(selectedItems);
  const hasPreviousLearningValue = hasPreviousLearning(input.latestLearning ?? null);
  const missingRulesetFieldKeysValue = hasPreviousLearningValue ? missingRulesetFieldKeys(input.latestLearning ?? null) : [];
  const rulesetContractComplete = hasPreviousLearningValue && missingRulesetFieldKeysValue.length === 0;
  const hasNewBlogOrReviewEvidence = collectedItems.some(
    (item) => (isBlogPost(item) || isPlaceReview(item)) && hasNewOrChangedDelta(item)
  );
  const hasOnlyPlaceProfiles = counts.total > 0 && counts.total === counts.placeProfiles;
  const hasChangedPlaceProfile = collectedItems.some((item) => isPlaceProfile(item) && itemDeltaState(item) === 'changed');
  const meaningfulChanges = collectionHasMeaningfulChanges(input.collectionSummary);
  const canReusePath = meaningfulChanges === false || (meaningfulChanges === true && hasOnlyPlaceProfiles && hasChangedPlaceProfile);
  const requiresNewEvidenceForRegeneration =
    hasPreviousLearningValue && meaningfulChanges === true && hasNewBlogOrReviewEvidence;

  if (canReusePath) {
    if (!hasPreviousLearningValue) {
      return decision('block', 'no_previous_learning_to_reuse', {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts,
        newCounts
      });
    }
    if (!rulesetContractComplete) {
      return decision('backfill_latest_ruleset', 'latest_ruleset_contract_incomplete', {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts,
        newCounts
      });
    }
    return decision(
      'reuse_latest_learning',
      meaningfulChanges === false ? 'no_meaningful_collection_changes' : 'place_profile_fact_change_only',
      {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts,
        newCounts
      }
    );
  }

  if (counts.total === 0) {
    return decision('block', 'no_collected_selected_items', {
      hasPreviousLearningValue,
      rulesetContractComplete,
      missingRulesetFieldKeysValue,
      hasNewBlogOrReviewEvidence,
      counts,
      newCounts
    });
  }

  if (requiresNewEvidenceForRegeneration && !hasSufficientNewEvidence(newCounts)) {
    return decision('reuse_latest_learning', 'insufficient_new_evidence_for_ruleset_regeneration', {
      hasPreviousLearningValue,
      rulesetContractComplete,
      missingRulesetFieldKeysValue,
      hasNewBlogOrReviewEvidence,
      counts,
      newCounts
    });
  }

  if (hasNewBlogOrReviewEvidence) {
    return decision(
      'run_analyzer',
      hasPreviousLearningValue ? 'new_selected_evidence' : 'initial_learning_with_selected_evidence',
      {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts,
        newCounts
      }
    );
  }

  if (!hasPreviousLearningValue && hasOnlyPlaceProfiles) {
    return decision('run_analyzer', 'initial_profile_only_analysis', {
      hasPreviousLearningValue,
      rulesetContractComplete,
      missingRulesetFieldKeysValue,
      hasNewBlogOrReviewEvidence,
      counts,
      newCounts
    });
  }

  return decision('block', 'unsupported_selected_items', {
    hasPreviousLearningValue,
    rulesetContractComplete,
    missingRulesetFieldKeysValue,
    hasNewBlogOrReviewEvidence,
    counts,
    newCounts
  });
}
