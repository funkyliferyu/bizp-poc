import type { JsonValue } from '../../repositories/base.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { getLatestAnalysisArtifacts } from '../analysis/analysisExecutionService.js';
import {
  canonicalRulesetFieldKey,
  serializeRulesetSourceMatrix,
  sourceMatrixForFieldKey
} from './rulesetSourceMatrix.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;
type StoreRecord = NonNullable<ReturnType<Repositories['stores']['findById']>>;

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function asRecord(value: JsonValue | null | undefined): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function asStringArray(value: JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asString(value: JsonValue | null | undefined) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function businessHourRecordText(value: JsonValue) {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;
  const day = asString(record.day) ?? asString(record.dayOfWeek) ?? asString(record.name) ?? asString(record.label);
  const openClose = [asString(record.openTime), asString(record.closeTime)].filter(Boolean).join('-') || null;
  const businessRange =
    asString(record.businessHours) ??
    asString(record.hours) ??
    asString(record.time) ??
    openClose;
  const description = asString(record.description) ?? asString(record.status);
  const text = [day, businessRange || description].filter(Boolean).join(' ');
  return text || null;
}

function asDisplayList(value: JsonValue | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item) ?? businessHourRecordText(item))
      .filter((item): item is string => Boolean(item));
  }
  const single = asString(value);
  return single ? [single] : [];
}

function firstDisplayValue(...values: Array<JsonValue | null | undefined>) {
  for (const value of values) {
    const displayList = asDisplayList(value);
    if (displayList.length > 0) return displayList.join(', ');
  }
  return null;
}

function parkingValue(...values: Array<JsonValue | null | undefined>) {
  const value = firstDisplayValue(...values);
  if (value === 'y' || value === 'available') return '주차 가능';
  if (value === 'n' || value === 'none') return '주차 불가';
  if (value === 'near') return '인근 주차';
  return value;
}

function representativeTreatmentSubjectsValue(metadata: Record<string, JsonValue>, parsed: Record<string, JsonValue>) {
  const metadataHospital = asRecord(metadata.hospitalInfo);
  const parsedHospital = asRecord(parsed.hospitalInfo);
  return firstDisplayValue(
    metadata.representativeTreatmentSubjects,
    parsed.representativeTreatmentSubjects,
    metadata.treatmentSubjects,
    parsed.treatmentSubjects,
    metadata.medicalSubjects,
    parsed.medicalSubjects,
    metadataHospital.subjects,
    parsedHospital.subjects,
    metadataHospital.sortedSubjects,
    parsedHospital.sortedSubjects,
    metadataHospital.processedSubjects,
    parsedHospital.processedSubjects
  );
}

function excerpt(value: string | null | undefined, maxLength = 160) {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function serializeField(field: RulesetField, fieldKeyOverride?: string) {
  return {
    id: field.id,
    fieldKey: fieldKeyOverride ?? field.fieldKey,
    aiValue: field.aiValue,
    userValue: field.userValue,
    finalValue: field.finalValue,
    source: field.source,
    locked: field.locked === 1,
    evidenceItemIds: asStringArray(field.evidenceItemIds),
    confidence: field.confidence,
    sourceMatrix: sourceMatrixForFieldKey(fieldKeyOverride ?? field.fieldKey),
    updatedAt: field.updatedAt
  };
}

function serializeStoreFacts(store: StoreRecord) {
  const metadata = asRecord(store.metadata);
  const parsed = asRecord(metadata.naverPlaceParsed);
  return {
    name: store.name,
    category: store.category ?? firstDisplayValue(parsed.category, metadata.category),
    address: store.address ?? firstDisplayValue(parsed.address, metadata.address),
    phone: store.phone ?? firstDisplayValue(parsed.phone, metadata.phone),
    storeIntro: firstDisplayValue(
      store.description,
      metadata.placeIntro,
      parsed.placeIntro,
      metadata.introduction,
      parsed.introduction,
      metadata.description,
      parsed.description
    ),
    operatingHours: firstDisplayValue(
      metadata.operatingHours,
      parsed.operatingHours,
      metadata.businessHours,
      parsed.businessHours,
      metadata.weeklyBusinessHours,
      parsed.weeklyBusinessHours,
      metadata.openHours,
      parsed.openHours,
      metadata.hours,
      parsed.hours
    ),
    closedDays: firstDisplayValue(metadata.closedDays, parsed.closedDays),
    parking: parkingValue(metadata.parkingNote, parsed.parkingNote, metadata.parking, parsed.parking),
    representativeTreatmentSubjects: representativeTreatmentSubjectsValue(metadata, parsed)
  };
}

function sourceMatrixWithCurrentValues(storeFacts: Record<string, unknown>, fields: ReturnType<typeof serializeField>[]) {
  const fieldValues = new Map<string, string | null>(
    fields.map((field) => [field.fieldKey, field.finalValue || field.aiValue])
  );
  return serializeRulesetSourceMatrix().map((row) => {
    const canonicalFieldKey = canonicalRulesetFieldKey(row.fieldKey);
    const aliasedField = fields.find((field) => canonicalRulesetFieldKey(field.fieldKey) === canonicalFieldKey);
    const currentValue =
      fieldValues.get(row.fieldKey)
      ?? (aliasedField ? aliasedField.finalValue || aliasedField.aiValue : null)
      ?? storeFacts[row.fieldKey]
      ?? null;
    return {
      ...row,
      currentValue
    };
  });
}

function latestRulesetContext(repos: Repositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;

  const latestArtifacts = getLatestAnalysisArtifacts(repos, store.id);
  const marketingRuleset =
    latestArtifacts?.marketingRuleset ?? latestByUpdatedAt(repos.marketingRulesets.listByStoreId(store.id));
  if (!marketingRuleset) return { store, marketingRuleset: null, learningSnapshot: null, analysisRun: null, fields: [] };

  const learningSnapshot = marketingRuleset.learningSnapshotId
    ? repos.learningSnapshots.findById(marketingRuleset.learningSnapshotId)
    : null;
  const analysisRun = learningSnapshot ? repos.analysisRuns.findById(learningSnapshot.analysisRunId) : null;
  const fields = repos.rulesetFields
    .listByRulesetId(marketingRuleset.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    store,
    marketingRuleset,
    learningSnapshot,
    analysisRun,
    fields
  };
}

function rulesetFieldContext(repos: Repositories, storeId: string, fieldKey: string) {
  const context = latestRulesetContext(repos, storeId);
  if (!context?.marketingRuleset) return null;
  const canonicalFieldKey = canonicalRulesetFieldKey(fieldKey);
  const field = context.fields.find(
    (item) => item.fieldKey === fieldKey || canonicalRulesetFieldKey(item.fieldKey) === canonicalFieldKey
  );
  if (!field) return { ...context, field: null };
  return { ...context, field };
}

export function buildMarketingRulesetPayload(repos: Repositories, storeId: string) {
  const context = latestRulesetContext(repos, storeId);
  if (!context) return null;
  const { store, marketingRuleset, learningSnapshot, analysisRun, fields } = context;
  if (!marketingRuleset) {
    const storeFacts = serializeStoreFacts(store);
    return {
      store: {
        id: store.id,
        name: store.name,
        category: store.category,
        address: store.address
      },
      storeFacts,
      ruleset: null,
      learningSnapshot: null,
      analysis: null,
      fields: [],
      sourceMatrix: sourceMatrixWithCurrentValues(storeFacts, [])
    };
  }

  const storeFacts = serializeStoreFacts(store);
  const serializedFields = fields.map((field) => serializeField(field));

  return {
    store: {
      id: store.id,
      name: store.name,
      category: store.category,
      address: store.address
    },
    storeFacts,
    ruleset: {
      id: marketingRuleset.id,
      status: marketingRuleset.status,
      version: marketingRuleset.version,
      updatedAt: marketingRuleset.updatedAt
    },
    learningSnapshot: learningSnapshot
      ? {
          id: learningSnapshot.id,
          status: learningSnapshot.status,
          updatedAt: learningSnapshot.updatedAt
        }
      : null,
    analysis: analysisRun
      ? {
          id: analysisRun.id,
          status: analysisRun.status,
          completedAt: analysisRun.completedAt,
          updatedAt: analysisRun.updatedAt
        }
      : null,
    fields: serializedFields,
    sourceMatrix: sourceMatrixWithCurrentValues(storeFacts, serializedFields)
  };
}

export function updateRulesetFieldValue(
  repos: Repositories,
  storeId: string,
  fieldKey: string,
  userValue: string
) {
  const context = rulesetFieldContext(repos, storeId, fieldKey);
  if (!context) return null;
  if (!context.field) return { field: null };

  const updated = repos.rulesetFields.update(context.field.id, {
    userValue,
    finalValue: userValue,
    fieldValue: userValue,
    source: 'user_edited',
    locked: 1
  });

  return {
    field: serializeField(updated, fieldKey)
  };
}

export function resetRulesetFieldValue(repos: Repositories, storeId: string, fieldKey: string) {
  const context = rulesetFieldContext(repos, storeId, fieldKey);
  if (!context) return null;
  if (!context.field) return { field: null };

  const updated = repos.rulesetFields.update(context.field.id, {
    userValue: null,
    finalValue: context.field.aiValue,
    fieldValue: context.field.aiValue,
    source: 'ai_generated',
    locked: 0
  });

  return {
    field: serializeField(updated, fieldKey)
  };
}

function itemPayload(item: CollectionItem, analysisSummary: string | null, score: number | null) {
  return {
    collectionItemId: item.id,
    channel: item.channel,
    sourceType: item.sourceType,
    title: item.title,
    sourceUrl: item.sourceUrl,
    excerpt: excerpt(item.bodyText) ?? item.title,
    analysisSummary,
    score
  };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function fieldSpecificAnalysisSummary(metadata: JsonValue, candidateFieldKeys: string[]) {
  const metadataRecord = asRecord(metadata);
  const fieldEvidence = asRecord(metadataRecord.fieldEvidence);
  for (const fieldKey of candidateFieldKeys) {
    const evidence = asRecord(fieldEvidence[fieldKey]);
    const summary = asString(evidence.summary);
    if (summary) return summary;
  }
  return null;
}

function fallbackFieldSpecificSummary(field: RulesetField, requestedFieldKey: string, baseSummary: string | null | undefined) {
  if (!baseSummary) return null;
  const label = sourceMatrixForFieldKey(requestedFieldKey)?.label
    ?? sourceMatrixForFieldKey(field.fieldKey)?.label
    ?? requestedFieldKey;
  const fieldValue = excerpt(field.finalValue || field.aiValue || field.fieldValue, 120);
  const separator = fieldValue && /[.!?。？！.]$/.test(fieldValue) ? ' ' : '. ';
  return fieldValue
    ? `${label} 산출 근거: ${fieldValue}${separator}수집 근거: ${baseSummary}`
    : `${label} 산출 근거: ${baseSummary}`;
}

export function buildRulesetFieldEvidence(repos: Repositories, storeId: string, fieldKey: string) {
  const context = rulesetFieldContext(repos, storeId, fieldKey);
  if (!context) return null;
  if (!context.field) return { field: null };

  const evidenceItemIds = asStringArray(context.field.evidenceItemIds);
  const evidenceRows = context.analysisRun ? repos.analysisEvidence.listByAnalysisRunId(context.analysisRun.id) : [];
  const evidenceByItemId = new Map(
    evidenceRows
      .filter((item) => item.collectionItemId)
      .map((item) => [item.collectionItemId as string, item])
  );
  const candidateFieldKeys = unique([
    fieldKey,
    context.field.fieldKey,
    canonicalRulesetFieldKey(fieldKey),
    canonicalRulesetFieldKey(context.field.fieldKey)
  ]);

  const evidence = evidenceItemIds
    .map((itemId) => {
      const item = repos.collectionItems.findById(itemId);
      if (!item) return null;
      const analysisEvidence = evidenceByItemId.get(item.id);
      const analysisSummary = analysisEvidence
        ? fieldSpecificAnalysisSummary(analysisEvidence.metadata, candidateFieldKeys)
          ?? fallbackFieldSpecificSummary(context.field, fieldKey, analysisEvidence.summary)
        : null;
      return itemPayload(item, analysisSummary, analysisEvidence?.score ?? null);
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    field: serializeField(context.field, fieldKey),
    evidence
  };
}
