import type { CollectionItem } from '../../repositories/collection_items.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';
import type { Store } from '../../repositories/stores.js';
import type { createStoreLearningRepositories } from '../../repositories/storeLearningRepositories.js';
import { sourceMatrixForFieldKey } from './rulesetSourceMatrix.js';

type Repositories = ReturnType<typeof createStoreLearningRepositories>;

const BACKFILL_SOURCE = 'ruleset_contract_backfill';
const HEALTHCARE_CATEGORY_KEYWORDS = ['병원', '의원', '클리닉', '정형외과', '피부과', '치과'];
const MEDICAL_INDUSTRY_COMMON_RULE = '블로그 하단에 반드시 의료법 관련 내용 포함';
const MEDICAL_FOOTER_LINES = [
  '*본 포스팅은 {storeName}에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.',
  '*모든 시술은 개인의 상태에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.'
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function cleanText(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function displayList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter((item): item is string => Boolean(item));
  }
  const single = cleanText(value);
  return single ? [single] : [];
}

function firstDisplayValue(...values: unknown[]) {
  for (const value of values) {
    const list = displayList(value);
    if (list.length > 0) return list.join(', ');
  }
  return null;
}

function isHealthcareStore(store: Store) {
  const category = store.category ?? cleanText(asRecord(store.metadata).category) ?? '';
  return HEALTHCARE_CATEGORY_KEYWORDS.some((keyword) => category.includes(keyword));
}

function storeArea(store: Store) {
  return store.address?.split(/\s+/).slice(0, 2).join(' ') || '지역';
}

function storeCategory(store: Store) {
  return store.category || '지역 매장';
}

function medicalFooter(storeName: string) {
  return MEDICAL_FOOTER_LINES.map((line) => line.replace('{storeName}', storeName)).join('\n');
}

function rulesetFieldId(rulesetId: string, fieldKey: string) {
  return `ruleset_field_${rulesetId}_${fieldKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function evidenceItemIds(selectedItems: readonly CollectionItem[]) {
  return selectedItems
    .filter((item) => item.status === 'collected')
    .map((item) => item.id)
    .slice(0, 5);
}

function metadataFacts(store: Store) {
  const metadata = asRecord(store.metadata);
  const parsed = asRecord(metadata.naverPlaceParsed);
  const hospitalInfo = asRecord(metadata.hospitalInfo);
  const parsedHospitalInfo = asRecord(parsed.hospitalInfo);
  return {
    representativeMenu: firstDisplayValue(
      metadata.representativeTreatmentSubjects,
      parsed.representativeTreatmentSubjects,
      metadata.treatmentSubjects,
      parsed.treatmentSubjects,
      hospitalInfo.subjects,
      parsedHospitalInfo.subjects,
      metadata.menuItems,
      parsed.menuItems
    ),
    parking: firstDisplayValue(metadata.parkingNote, parsed.parkingNote, metadata.parking, parsed.parking),
    intro: firstDisplayValue(store.description, metadata.placeIntro, parsed.placeIntro, metadata.description, parsed.description)
  };
}

function fallbackValue(fieldKey: string, store: Store) {
  const facts = metadataFacts(store);
  const healthcare = isHealthcareStore(store);
  const area = storeArea(store);
  const category = storeCategory(store);
  const storeName = store.name;
  const localTags = [area, category, storeName].filter(Boolean).join(', ');

  switch (fieldKey) {
    case 'storePositioning':
      return `${area} ${category} 매장`;
    case 'keyStrengths':
      return facts.intro ?? `${storeName}의 수집 근거 기반 강점 보완 필요`;
    case 'representativeMenu':
      return facts.representativeMenu ?? '대표 서비스 확인 필요';
    case 'targetCustomers':
      return `${area}에서 ${category} 정보를 찾는 고객`;
    case 'contentKeywords':
    case 'seoKeywords':
      return localTags;
    case 'keywordMap':
      return `${category} 안내 | SEO: ${localTags} | 해시태그: ${localTags
        .split(', ')
        .filter(Boolean)
        .map((item) => `#${item.replace(/\s+/g, '')}`)
        .join(' ')} | 검색의도: ${area}에서 ${category} 정보를 찾는 고객`;
    case 'reviewStrength':
      return '수집 리뷰 기반 강점 보완 필요';
    case 'reviewWeakness':
      return '리뷰 약점을 판단할 수집 근거가 아직 없습니다';
    case 'toneAndManner':
      return healthcare ? '전문적이고 신뢰감 있는 안내형' : '친절하고 구체적인 안내형';
    case 'catchphrase':
      return `${storeName}의 장점을 명확하게 전달하는 보수적 문구`;
    case 'industryCommonRules':
      return healthcare ? MEDICAL_INDUSTRY_COMMON_RULE : '업종 공통 필수 고지 없음';
    case 'blogRequiredIntroCopy':
      return '브랜드 소개나 반복 인트로가 있을 때만 직접 입력';
    case 'blogRequiredFooterCopy':
      return healthcare ? medicalFooter(storeName) : '예약, 문의, 운영 안내 등 반복 푸터가 있을 때만 직접 입력';
    case 'negativeExpressions':
      return '전국 최고, 무조건 가능, 효능 보장, 과장된 원조 표현';
    case 'humorLevel':
      return healthcare ? '낮음 - 정보 전달 중심' : '낮음 - 가벼운 표현만 허용';
    case 'trendSensitivity':
      return '중간 - 매장과 주제에 맞는 트렌드만 선별 반영';
    case 'blogPurpose':
      return '검색 유입, 신뢰 형성, 문의 전환';
    case 'titlePatterns':
      return '{지역키워드} {대표서비스} 안내, {상황}에 맞는 {대표서비스} 선택 기준, {지역키워드}에서 {서비스} 찾는 분들을 위한 안내';
    case 'introPattern':
      return '고객 상황 제시 -> 자주 묻는 질문 제시 -> 이 글에서 안내할 내용 예고';
    case 'bodyOutlinePattern':
      return '고객 상황 설명, 상품/서비스 선택 기준, 예약 또는 상담 필요 정보, 주의사항, CTA';
    case 'headingPattern':
      return '3~5개 소제목, 질문형 또는 안내형';
    case 'blogWritingStyle':
      return healthcare ? '근거와 주의사항을 함께 안내하는 정보형 문장' : '검색 유입형 정보 전달 문장';
    case 'blogPreferredLength':
      return '본문 700-1,000자 권장';
    case 'blogHashtags':
      return localTags
        .split(', ')
        .filter(Boolean)
        .map((item) => `#${item.replace(/\s+/g, '')}`)
        .join(' ');
    case 'blogEmojiPolicy':
      return '검색형 본문에서는 이모지 사용 안 함';
    case 'seoPlacementPolicy':
      return '제목과 도입부에 핵심 키워드를 자연스럽게 포함하고, 소제목과 본문에는 보조 키워드를 무리 없이 분산합니다. 무의미한 반복과 관련 없는 키워드는 피합니다.';
    case 'ctaStyle':
      return facts.parking ? '운영정보와 문의 방법을 확인하도록 안내' : '문의 또는 예약 가능 여부 확인 유도';
    default:
      return `${sourceMatrixForFieldKey(fieldKey)?.label ?? fieldKey} 보수적 기본값`;
  }
}

export function backfillRulesetContractFields(
  repos: Repositories,
  input: {
    store: Store;
    rulesetId: string;
    missingFieldKeys: readonly string[];
    selectedItems: readonly CollectionItem[];
  }
) {
  const existingFieldKeys = new Set(repos.rulesetFields.listByRulesetId(input.rulesetId).map((field) => field.fieldKey));
  const evidenceIds = evidenceItemIds(input.selectedItems);
  const fields: RulesetField[] = [];

  for (const fieldKey of input.missingFieldKeys) {
    if (existingFieldKeys.has(fieldKey)) continue;
    const value = fallbackValue(fieldKey, input.store);
    fields.push(
      repos.rulesetFields.upsert({
        id: rulesetFieldId(input.rulesetId, fieldKey),
        rulesetId: input.rulesetId,
        fieldKey,
        fieldValue: value,
        aiValue: value,
        userValue: null,
        finalValue: value,
        source: BACKFILL_SOURCE,
        locked: 0,
        evidenceItemIds: evidenceIds,
        confidence: 0.35
      })
    );
  }

  return {
    source: BACKFILL_SOURCE,
    applied: fields.length > 0,
    fieldIds: fields.map((field) => field.id),
    fieldKeys: fields.map((field) => field.fieldKey)
  };
}
