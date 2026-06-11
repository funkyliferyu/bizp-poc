import type { JsonValue } from '../../repositories/base.js';
import type { AnalysisEvidence } from '../../repositories/analysis_evidence.js';
import type { CollectionItem } from '../../repositories/collection_items.js';
import type { MarketingRuleset } from '../../repositories/marketing_rulesets.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import {
  canonicalRulesetFieldKey,
  serializeRulesetSourceMatrix,
  sourceMatrixForFieldKey
} from './rulesetSourceMatrix.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;
type StoreRecord = NonNullable<ReturnType<Repositories['stores']['findById']>>;
type SerializedRulesetField = ReturnType<typeof serializeField>;
type WritingStyleCurrentValueStatus = 'inferred' | 'user_edited' | 'placeholder' | 'empty';
type WritingStyleSuggestionJudgment = 'maintain' | 'improve';

const HEALTHCARE_CATEGORY_KEYWORDS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'];
const MEDICAL_INDUSTRY_COMMON_RULE = '블로그 하단에 반드시 의료법 관련 내용 포함';
const MEDICAL_BLOG_FOOTER_EXAMPLE_STORE_NAME = '테라스의원';
const MEDICAL_BLOG_FOOTER_LINES = [
  '*본 포스팅은 {storeName}에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
  '*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.'
];

const WRITING_STYLE_INSIGHT_FIELD_KEYS = [
  'blogPurpose',
  'blogWritingStyle',
  'blogPreferredLength',
  'blogHashtags',
  'blogEmojiPolicy',
  'seoKeywords',
  'ctaStyle',
  'industryCommonRules',
  'blogRequiredIntroCopy',
  'blogRequiredFooterCopy'
] as const;

const WRITING_PLACEHOLDER_VALUES: Record<string, string> = {
  blogRequiredIntroCopy: '브랜드 소개나 반복 인트로가 있을 때만 직접 입력',
  blogRequiredFooterCopy: '예약, 문의, 운영 안내 등 반복 푸터가 있을 때만 직접 입력'
};

const WRITING_STYLE_SUGGESTIONS: Record<
  string,
  {
    judgment: WritingStyleSuggestionJudgment;
    value: string;
    evidence: string;
  }
> = {
  blogPurpose: {
    judgment: 'improve',
    value: '검색 유입, 예약/전화 문의, 신뢰 형성 목적을 분리하고 포스팅 주제마다 복수 목표를 선택합니다.',
    evidence: '블로그 목적은 검색 유입과 상담 전환 신호가 함께 쓰이므로 목적을 분리하면 CTA가 더 명확해집니다.'
  },
  blogWritingStyle: {
    judgment: 'maintain',
    value: '현재처럼 정보 전달을 중심으로 쉬운 설명과 단정한 안내 문체를 유지합니다.',
    evidence: '기존 블로그 문체가 설명형으로 안정적이며, 과장보다 명확한 안내가 업종 신뢰도에 더 적합합니다.'
  },
  blogPreferredLength: {
    judgment: 'maintain',
    value: '현재 길이 범위를 유지하고, 마무리 문단에 상담/예약 안내를 일관되게 배치합니다.',
    evidence: '검색형 블로그는 너무 짧은 글보다 핵심 정보와 안내 문단을 함께 담는 구조가 안정적입니다.'
  },
  blogHashtags: {
    judgment: 'improve',
    value: '지역+업종 태그와 포스팅 주제 태그를 분리해 반복 태그를 줄입니다.',
    evidence: '동일한 지역 태그만 반복하면 탐색 범위가 좁아지므로 주제별 보조 태그를 함께 쓰는 편이 좋습니다.'
  },
  blogEmojiPolicy: {
    judgment: 'maintain',
    value: '본문에서는 이모지를 쓰지 않고, 정보 구분용 기호도 최소화합니다.',
    evidence: '정보성 블로그는 장식 표현보다 문장 구조와 소제목으로 가독성을 확보하는 편이 안전합니다.'
  },
  seoKeywords: {
    judgment: 'improve',
    value: '대표 지역 키워드 1-2개와 주제 키워드 2-3개를 나눠 제목/본문 반복을 제어합니다.',
    evidence: '현재 키워드는 지역과 업종 표현이 함께 묶여 있어 포스팅별 자연스러운 반복 횟수 제어가 필요합니다.'
  },
  ctaStyle: {
    judgment: 'improve',
    value: '운영시간, 전화번호, 예약 가능 여부가 있는 글에서는 마지막 문단에 다음 행동을 구체적으로 안내합니다.',
    evidence: 'CTA가 추상적이면 사용자가 문의, 예약, 방문 중 어떤 행동을 해야 하는지 판단하기 어렵습니다.'
  },
  industryCommonRules: {
    judgment: 'maintain',
    value: '업종 필수 고지는 브랜드 톤과 분리해 별도 규칙으로 유지합니다.',
    evidence: '정책성 문구는 글쓰기 톤과 섞지 않고 생성 단계에서 별도 검증하는 편이 안전합니다.'
  },
  blogRequiredIntroCopy: {
    judgment: 'maintain',
    value: '반복 인트로는 실제로 모든 글에 들어갈 확정 문구가 있을 때만 사용합니다.',
    evidence: '반복 문구가 없는 상태에서 예시 문장을 저장하면 포스팅마다 불필요한 고정 문장이 삽입될 수 있습니다.'
  },
  blogRequiredFooterCopy: {
    judgment: 'maintain',
    value: '반복 푸터는 업종 필수 고지나 매장별 안내가 확인된 경우에만 사용합니다.',
    evidence: '푸터 문구는 모든 글에 반복 적용되므로 실제 정책 문구와 연락/운영 정보가 확인된 뒤 고정해야 합니다.'
  }
};

const REVIEW_WEAKNESS_SIGNALS = [
  {
    label: '통증 걱정 완화 안내 필요',
    keywords: ['아파', '통증', '겁', '마취', '무섭', '위험']
  },
  {
    label: '사후관리/재발 기대치 안내 필요',
    keywords: ['재발', '붉은기', '관리', '기다리', '남은']
  },
  {
    label: '대기/혼잡 경험 관리 필요',
    keywords: ['사람이 많', '대기', '예약', '기다림', '붐']
  },
  {
    label: '방문/주차 동선 안내 보완 필요',
    keywords: ['주차', '찾기', '동선', '픽업', '위치']
  },
  {
    label: '가격/결제 안내 선명화 필요',
    keywords: ['가격', '비싸', '결제', '현금', '카드']
  }
] as const;

function latestByUpdatedAt<T extends { updatedAt: string }>(records: T[]) {
  return records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) ?? null;
}

function nowIso() {
  return new Date().toISOString();
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

function medicalBlogFooterCopy(storeName: string | null | undefined) {
  const normalizedStoreName = storeName?.trim() || '해당 병원';
  return MEDICAL_BLOG_FOOTER_LINES
    .map((line) => line.replace('{storeName}', normalizedStoreName))
    .join('\n');
}

function storeNameFromFacts(storeFacts: Record<string, unknown>) {
  const name = storeFacts.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (typeof name === 'number' && Number.isFinite(name)) return String(name);
  return '해당 병원';
}

function normalizeMedicalBlogFooterCopy(
  value: string | null | undefined,
  storeFacts: Record<string, unknown>,
  isUserEdited: boolean
) {
  const storeName = storeNameFromFacts(storeFacts);
  if (!value) return medicalBlogFooterCopy(storeName);
  if (isUserEdited) return value;
  return value.replaceAll(MEDICAL_BLOG_FOOTER_EXAMPLE_STORE_NAME, storeName);
}

function serializeFieldForStore(
  field: RulesetField,
  storeFacts: Record<string, unknown>,
  fieldKeyOverride?: string
): SerializedRulesetField {
  const serialized = serializeField(field, fieldKeyOverride);
  if (!isHealthcareStoreFacts(storeFacts) || serialized.fieldKey !== 'blogRequiredFooterCopy') return serialized;
  const isUserEdited = serialized.locked || serialized.source === 'user_edited';
  const aiValue = normalizeMedicalBlogFooterCopy(serialized.aiValue, storeFacts, false);
  const finalValue = normalizeMedicalBlogFooterCopy(serialized.finalValue || serialized.aiValue, storeFacts, isUserEdited);
  return {
    ...serialized,
    aiValue,
    finalValue,
    userValue: isUserEdited ? serialized.userValue : serialized.userValue?.replaceAll(MEDICAL_BLOG_FOOTER_EXAMPLE_STORE_NAME, storeNameFromFacts(storeFacts)) ?? null
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

function rulesetFieldId(rulesetId: string, fieldKey: string) {
  return `ruleset_field_${rulesetId}_${fieldKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function sanitizeIdPart(value: string) {
  return value.replace(/[^0-9A-Za-z_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function collectionItemSearchText(item: CollectionItem) {
  return [item.title, item.bodyText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function collectedReviewWeaknessEvidenceItems(repos: Repositories, storeId: string) {
  return repos.collectionItems
    .listByStoreId(storeId)
    .filter((item) => {
      if (item.status !== 'collected') return false;
      if (item.sourceType !== 'review' && item.sourceType !== 'post') return false;
      return Boolean(collectionItemSearchText(item));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function deriveReviewWeaknessFromCollectedItems(items: CollectionItem[]) {
  const matchedLabels: string[] = [];
  const matchedItemIds: string[] = [];

  for (const signal of REVIEW_WEAKNESS_SIGNALS) {
    const matchedItem = items.find((item) => {
      const text = collectionItemSearchText(item);
      return signal.keywords.some((keyword) => text.includes(keyword));
    });
    if (!matchedItem) continue;
    matchedLabels.push(signal.label);
    matchedItemIds.push(matchedItem.id);
  }

  if (matchedLabels.length > 0) {
    return {
      value: unique(matchedLabels).slice(0, 3).join(', '),
      evidenceItemIds: unique(matchedItemIds).slice(0, 5),
      confidence: 0.62
    };
  }

  const fallbackEvidenceItemIds = items.slice(0, 3).map((item) => item.id);
  if (fallbackEvidenceItemIds.length > 0) {
    return {
      value: '반복적으로 확인되는 리뷰 약점 없음',
      evidenceItemIds: fallbackEvidenceItemIds,
      confidence: 0.45
    };
  }

  return {
    value: '리뷰 약점을 판단할 수집 근거가 아직 없습니다',
    evidenceItemIds: [],
    confidence: 0.3
  };
}

function ensureReviewWeaknessBackfill(
  repos: Repositories,
  store: StoreRecord,
  rulesetId: string,
  fields: RulesetField[]
) {
  if (fields.some((field) => canonicalRulesetFieldKey(field.fieldKey) === 'reviewWeakness')) return null;
  const derived = deriveReviewWeaknessFromCollectedItems(collectedReviewWeaknessEvidenceItems(repos, store.id));
  return repos.rulesetFields.upsert({
    id: rulesetFieldId(rulesetId, 'reviewWeakness'),
    rulesetId,
    fieldKey: 'reviewWeakness',
    fieldValue: derived.value,
    aiValue: derived.value,
    userValue: null,
    finalValue: derived.value,
    source: 'analysis_backfill',
    locked: 0,
    evidenceItemIds: derived.evidenceItemIds,
    confidence: derived.confidence
  });
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

function isHealthcareStoreFacts(storeFacts: Record<string, unknown>) {
  const category = String(storeFacts.category ?? '').trim();
  return HEALTHCARE_CATEGORY_KEYWORDS.some((keyword) => category.includes(keyword));
}

function fieldForInsight(fieldKey: string, fields: SerializedRulesetField[]) {
  const canonicalFieldKey = canonicalRulesetFieldKey(fieldKey);
  return fields.find(
    (field) => field.fieldKey === fieldKey || canonicalRulesetFieldKey(field.fieldKey) === canonicalFieldKey
  ) ?? null;
}

function writingFieldValue(fieldKey: string, field: SerializedRulesetField | null, storeFacts: Record<string, unknown>) {
  const isHealthcare = isHealthcareStoreFacts(storeFacts);
  const fieldValue = field?.finalValue || field?.aiValue || null;
  if (fieldValue) return fieldValue;
  if (isHealthcare && fieldKey === 'industryCommonRules') return MEDICAL_INDUSTRY_COMMON_RULE;
  if (isHealthcare && fieldKey === 'blogRequiredFooterCopy') {
    return medicalBlogFooterCopy(storeNameFromFacts(storeFacts));
  }
  return null;
}

function writingPlaceholderText(fieldKey: string, value: string | null, storeFacts: Record<string, unknown>) {
  const isHealthcare = isHealthcareStoreFacts(storeFacts);
  if (fieldKey === 'blogRequiredIntroCopy') {
    if (value && value.includes('반복 인트로')) return value;
    return WRITING_PLACEHOLDER_VALUES.blogRequiredIntroCopy;
  }
  if (fieldKey === 'blogRequiredFooterCopy' && !isHealthcare) {
    if (value && value.includes('반복 푸터')) return value;
    return WRITING_PLACEHOLDER_VALUES.blogRequiredFooterCopy;
  }
  return null;
}

function writingCurrentValueStatus(
  field: SerializedRulesetField | null,
  value: string | null,
  placeholderText: string | null
): WritingStyleCurrentValueStatus {
  if (field?.locked || field?.source === 'user_edited') return 'user_edited';
  if (placeholderText && (!value || value === placeholderText)) return 'placeholder';
  if (value) return 'inferred';
  return 'empty';
}

function writingCalculationLogic(fieldKey: string) {
  const matrix = sourceMatrixForFieldKey(fieldKey);
  const label = matrix?.label ?? fieldKey;
  const inputSources = matrix?.inputSources?.join(', ') || '룰셋 필드와 수집 콘텐츠';
  return `${label}은 ${inputSources}를 기준으로 기존 룰셋 값, 매장 업종, 선택된 블로그/플레이스 근거를 함께 검토해 산출합니다.`;
}

function analysisEvidenceSignals(evidenceRows: AnalysisEvidence[], fieldKey: string) {
  const canonicalFieldKey = canonicalRulesetFieldKey(fieldKey);
  return unique(
    evidenceRows.flatMap((row) => {
      const summary =
        fieldSpecificAnalysisSummary(row.metadata, [fieldKey, canonicalFieldKey])
        ?? row.summary
        ?? null;
      return [excerpt(summary, 120)];
    })
  ).slice(0, 3);
}

function writingSuggestion(
  fieldKey: string,
  evidenceRows: AnalysisEvidence[]
) {
  const suggestion = WRITING_STYLE_SUGGESTIONS[fieldKey] ?? {
    judgment: 'maintain' as WritingStyleSuggestionJudgment,
    value: '현재 값을 유지하고 충분한 근거가 쌓이면 개선안을 다시 판단합니다.',
    evidence: '해당 항목은 보수적으로 변경 여부를 판단해야 하므로 명확한 개선 근거가 없으면 현행 유지가 우선입니다.'
  };
  const matrix = sourceMatrixForFieldKey(fieldKey);
  const inputSignals = unique([
    ...(matrix?.inputSources ?? []),
    ...analysisEvidenceSignals(evidenceRows, fieldKey)
  ]).slice(0, 5);
  return {
    ...suggestion,
    inputSignals: inputSignals.length > 0 ? inputSignals : ['ruleset field value']
  };
}

function buildWritingStyleFieldInsights(
  storeFacts: Record<string, unknown>,
  fields: SerializedRulesetField[],
  evidenceRows: AnalysisEvidence[]
) {
  return WRITING_STYLE_INSIGHT_FIELD_KEYS.map((fieldKey) => {
    const field = fieldForInsight(fieldKey, fields);
    const value = writingFieldValue(fieldKey, field, storeFacts);
    const placeholderText = writingPlaceholderText(fieldKey, value, storeFacts);
    const currentValueStatus = writingCurrentValueStatus(field, value, placeholderText);
    return {
      fieldKey,
      currentValue: currentValueStatus === 'placeholder' ? null : value,
      currentValueStatus,
      placeholderText,
      calculationLogic: writingCalculationLogic(fieldKey),
      aiSuggestion: writingSuggestion(fieldKey, evidenceRows)
    };
  });
}

function latestRulesetForStore(repos: Repositories, storeId: string) {
  return repos.marketingRulesets
    .listByStoreId(storeId)
    .sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      return a.updatedAt.localeCompare(b.updatedAt);
    })
    .at(-1) ?? null;
}

function rulesetMetadataNumber(ruleset: MarketingRuleset, key: string) {
  const value = asRecord(ruleset.ruleset)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rulesetMetadataString(ruleset: MarketingRuleset, key: string) {
  return asString(asRecord(ruleset.ruleset)[key]);
}

function rulesetSummary(repos: Repositories, ruleset: MarketingRuleset, currentRulesetId: string | null) {
  const fields = repos.rulesetFields.listByRulesetId(ruleset.id);
  const learningSnapshot = ruleset.learningSnapshotId ? repos.learningSnapshots.findById(ruleset.learningSnapshotId) : null;
  const analysisRun = learningSnapshot ? repos.analysisRuns.findById(learningSnapshot.analysisRunId) : null;
  const sourceCounts = fields.reduce<Record<string, number>>((counts, field) => {
    counts[field.source] = (counts[field.source] ?? 0) + 1;
    return counts;
  }, {});

  return {
    id: ruleset.id,
    version: ruleset.version,
    status: ruleset.status,
    learningSnapshotId: ruleset.learningSnapshotId,
    analysisRunId: analysisRun?.id ?? null,
    createdAt: ruleset.createdAt,
    updatedAt: ruleset.updatedAt,
    fieldCount: fields.length,
    sourceCounts,
    restoredFromRulesetId: rulesetMetadataString(ruleset, 'restoredFromRulesetId'),
    restoredFromVersion: rulesetMetadataNumber(ruleset, 'restoredFromVersion'),
    isCurrent: currentRulesetId === ruleset.id
  };
}

function rulesetContext(
  repos: Repositories,
  storeId: string,
  marketingRuleset: MarketingRuleset | null,
  options: { allowBackfill: boolean }
) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;
  if (!marketingRuleset) return { store, marketingRuleset: null, learningSnapshot: null, analysisRun: null, fields: [] };
  if (marketingRuleset.storeId !== store.id) return null;

  const learningSnapshot = marketingRuleset.learningSnapshotId
    ? repos.learningSnapshots.findById(marketingRuleset.learningSnapshotId)
    : null;
  const analysisRun = learningSnapshot ? repos.analysisRuns.findById(learningSnapshot.analysisRunId) : null;
  let fields = repos.rulesetFields
    .listByRulesetId(marketingRuleset.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const backfilledReviewWeakness = options.allowBackfill
    ? ensureReviewWeaknessBackfill(repos, store, marketingRuleset.id, fields)
    : null;
  if (backfilledReviewWeakness) {
    fields = [...fields, backfilledReviewWeakness].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    store,
    marketingRuleset,
    learningSnapshot,
    analysisRun,
    fields
  };
}

function latestRulesetContext(repos: Repositories, storeId: string) {
  return rulesetContext(repos, storeId, latestRulesetForStore(repos, storeId), { allowBackfill: true });
}

function rulesetVersionContext(repos: Repositories, storeId: string, rulesetId: string) {
  return rulesetContext(repos, storeId, repos.marketingRulesets.findById(rulesetId), { allowBackfill: false });
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

function marketingRulesetPayloadFromContext(
  repos: Repositories,
  context: NonNullable<ReturnType<typeof latestRulesetContext>>,
  isCurrent: boolean
) {
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
      sourceMatrix: sourceMatrixWithCurrentValues(storeFacts, []),
      writingStyleInsights: buildWritingStyleFieldInsights(storeFacts, [], [])
    };
  }

  const storeFacts = serializeStoreFacts(store);
  const serializedFields = fields.map((field) => serializeFieldForStore(field, storeFacts));
  const evidenceRows = analysisRun ? repos.analysisEvidence.listByAnalysisRunId(analysisRun.id) : [];
  const restoredFromRulesetId = rulesetMetadataString(marketingRuleset, 'restoredFromRulesetId');
  const restoredFromVersion = rulesetMetadataNumber(marketingRuleset, 'restoredFromVersion');

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
      updatedAt: marketingRuleset.updatedAt,
      createdAt: marketingRuleset.createdAt,
      learningSnapshotId: marketingRuleset.learningSnapshotId,
      restoredFromRulesetId,
      restoredFromVersion,
      isCurrent
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
    sourceMatrix: sourceMatrixWithCurrentValues(storeFacts, serializedFields),
    writingStyleInsights: buildWritingStyleFieldInsights(storeFacts, serializedFields, evidenceRows)
  };
}

export function buildMarketingRulesetPayload(repos: Repositories, storeId: string) {
  const context = latestRulesetContext(repos, storeId);
  if (!context) return null;
  return marketingRulesetPayloadFromContext(repos, context, true);
}

export function buildRulesetVersionsPayload(repos: Repositories, storeId: string) {
  const store = repos.stores.findById(storeId);
  if (!store) return null;
  const currentRuleset = latestRulesetForStore(repos, store.id);
  const versions = repos.marketingRulesets
    .listByStoreId(store.id)
    .sort((a, b) => {
      if (a.version !== b.version) return b.version - a.version;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .map((ruleset) => rulesetSummary(repos, ruleset, currentRuleset?.id ?? null));
  return {
    storeId: store.id,
    currentRulesetId: currentRuleset?.id ?? null,
    versions
  };
}

export function buildMarketingRulesetVersionPayload(repos: Repositories, storeId: string, rulesetId: string) {
  const context = rulesetVersionContext(repos, storeId, rulesetId);
  if (!context?.marketingRuleset) return context ? { ruleset: null } : null;
  const currentRuleset = latestRulesetForStore(repos, storeId);
  return marketingRulesetPayloadFromContext(repos, context, currentRuleset?.id === context.marketingRuleset.id);
}

export function restoreMarketingRulesetVersion(repos: Repositories, storeId: string, rulesetId: string) {
  const context = rulesetVersionContext(repos, storeId, rulesetId);
  if (!context?.marketingRuleset) return context ? { ruleset: null } : null;
  const versions = repos.marketingRulesets.listByStoreId(storeId);
  const nextVersion = Math.max(0, ...versions.map((ruleset) => ruleset.version)) + 1;
  const timestamp = nowIso();
  const restoredRulesetId = `marketing_ruleset_${sanitizeIdPart(storeId)}_restored_v${nextVersion}_${Date.now()}`;
  const sourceRuleset = context.marketingRuleset;
  const restoredRuleset = repos.marketingRulesets.create({
    id: restoredRulesetId,
    storeId,
    learningSnapshotId: sourceRuleset.learningSnapshotId,
    status: 'draft',
    version: nextVersion,
    ruleset: {
      ...asRecord(sourceRuleset.ruleset),
      restoredFromRulesetId: sourceRuleset.id,
      restoredFromVersion: sourceRuleset.version,
      restoredAt: timestamp,
      restoreSource: 'ruleset_version_restore'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  });

  for (const field of context.fields) {
    repos.rulesetFields.create({
      id: rulesetFieldId(restoredRuleset.id, field.fieldKey),
      rulesetId: restoredRuleset.id,
      fieldKey: field.fieldKey,
      fieldValue: field.fieldValue,
      aiValue: field.aiValue,
      userValue: field.userValue,
      finalValue: field.finalValue,
      source: field.source,
      locked: field.locked,
      evidenceItemIds: field.evidenceItemIds,
      confidence: field.confidence,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  return buildMarketingRulesetVersionPayload(repos, storeId, restoredRuleset.id);
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
    field: serializeFieldForStore(updated, serializeStoreFacts(context.store), fieldKey)
  };
}

export function resetRulesetFieldValue(repos: Repositories, storeId: string, fieldKey: string) {
  const context = rulesetFieldContext(repos, storeId, fieldKey);
  if (!context) return null;
  if (!context.field) return { field: null };
  const storeFacts = serializeStoreFacts(context.store);
  const aiValue =
    fieldKey === 'blogRequiredFooterCopy' && isHealthcareStoreFacts(storeFacts)
      ? normalizeMedicalBlogFooterCopy(context.field.aiValue, storeFacts, false)
      : context.field.aiValue;

  const updated = repos.rulesetFields.update(context.field.id, {
    userValue: null,
    finalValue: aiValue,
    fieldValue: aiValue,
    source: 'ai_generated',
    locked: 0
  });

  return {
    field: serializeFieldForStore(updated, storeFacts, fieldKey)
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
