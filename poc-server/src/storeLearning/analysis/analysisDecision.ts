import { REQUIRED_ANALYZER_RULESET_FIELD_KEYS } from '../rulesets/rulesetSourceMatrix.js';

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

export type AnalysisExecutionDecision = {
  action: AnalysisDecisionAction;
  reason: AnalysisDecisionReason;
  hasPreviousLearning: boolean;
  rulesetContractComplete: boolean;
  missingRulesetFieldKeys: string[];
  hasNewBlogOrReviewEvidence: boolean;
  selectedCounts: AnalysisSelectedCounts;
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

function collectionHasMeaningfulChanges(collectionSummary: unknown) {
  const collectionDelta = asRecord(asRecord(collectionSummary).collectionDelta);
  return collectionDelta.hasMeaningfulChanges === false ? false : collectionDelta.hasMeaningfulChanges === true ? true : null;
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
  }
): AnalysisExecutionDecision {
  return {
    action,
    reason,
    hasPreviousLearning: input.hasPreviousLearningValue,
    rulesetContractComplete: input.rulesetContractComplete,
    missingRulesetFieldKeys: input.missingRulesetFieldKeysValue,
    hasNewBlogOrReviewEvidence: input.hasNewBlogOrReviewEvidence,
    selectedCounts: input.counts
  };
}

export function decideAnalysisExecution(input: AnalysisDecisionInput): AnalysisExecutionDecision {
  const selectedItems = input.selectedItems;
  const collectedItems = selectedItems.filter(isCollected);
  const counts = selectedCounts(selectedItems);
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

  if (canReusePath) {
    if (!hasPreviousLearningValue) {
      return decision('block', 'no_previous_learning_to_reuse', {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts
      });
    }
    if (!rulesetContractComplete) {
      return decision('backfill_latest_ruleset', 'latest_ruleset_contract_incomplete', {
        hasPreviousLearningValue,
        rulesetContractComplete,
        missingRulesetFieldKeysValue,
        hasNewBlogOrReviewEvidence,
        counts
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
        counts
      }
    );
  }

  if (counts.total === 0) {
    return decision('block', 'no_collected_selected_items', {
      hasPreviousLearningValue,
      rulesetContractComplete,
      missingRulesetFieldKeysValue,
      hasNewBlogOrReviewEvidence,
      counts
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
        counts
      }
    );
  }

  if (!hasPreviousLearningValue && hasOnlyPlaceProfiles) {
    return decision('run_analyzer', 'initial_profile_only_analysis', {
      hasPreviousLearningValue,
      rulesetContractComplete,
      missingRulesetFieldKeysValue,
      hasNewBlogOrReviewEvidence,
      counts
    });
  }

  return decision('block', 'unsupported_selected_items', {
    hasPreviousLearningValue,
    rulesetContractComplete,
    missingRulesetFieldKeysValue,
    hasNewBlogOrReviewEvidence,
    counts
  });
}
