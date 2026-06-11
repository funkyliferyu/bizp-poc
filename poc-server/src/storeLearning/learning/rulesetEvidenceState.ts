import type { CollectionItem } from '../../repositories/collection_items.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { collectionItemIdentity } from '../collection/collectionItemIdentity.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

export const ALREADY_LEARNED_RULESET_EVIDENCE = 'already_learned';
export const NEW_RULESET_EVIDENCE = 'new_evidence';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function latestMarketingRuleset(repos: Repositories, storeId: string) {
  return repos.marketingRulesets
    .listByStoreId(storeId)
    .sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      return a.updatedAt.localeCompare(b.updatedAt);
    })
    .at(-1) ?? null;
}

function evidenceItemIds(fields: RulesetField[]) {
  return new Set(fields.flatMap((field) => stringArray(field.evidenceItemIds)));
}

export function createRulesetEvidenceClassifier(repos: Repositories, storeId: string) {
  const ruleset = latestMarketingRuleset(repos, storeId);
  const fields = ruleset ? repos.rulesetFields.listByRulesetId(ruleset.id) : [];
  const learnedItemIds = evidenceItemIds(fields);
  const learnedIdentities = new Set<string>();

  for (const itemId of learnedItemIds) {
    const item = repos.collectionItems.findById(itemId);
    if (!item) continue;
    const identity = collectionItemIdentity(item);
    if (identity) learnedIdentities.add(identity);
  }

  function isAlreadyLearned(item: CollectionItem) {
    if (learnedItemIds.has(item.id)) return true;
    const identity = collectionItemIdentity(item);
    return Boolean(identity && learnedIdentities.has(identity));
  }

  function stateFor(item: CollectionItem) {
    return isAlreadyLearned(item) ? ALREADY_LEARNED_RULESET_EVIDENCE : NEW_RULESET_EVIDENCE;
  }

  function withState<T extends CollectionItem>(item: T): T {
    return {
      ...item,
      metadata: {
        ...asRecord(item.metadata),
        rulesetEvidenceState: stateFor(item)
      }
    };
  }

  return {
    rulesetId: ruleset?.id ?? null,
    learnedItemIds,
    learnedIdentities,
    isAlreadyLearned,
    stateFor,
    withState
  };
}
