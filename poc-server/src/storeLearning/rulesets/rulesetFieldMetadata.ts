import type { JsonValue } from '../../repositories/base.js';
import type { RulesetField } from '../../repositories/ruleset_fields.js';

export type RulesetFieldSourceStatus =
  | 'direct_fact'
  | 'inferred_from_pattern'
  | 'computed'
  | 'default_policy'
  | 'policy_default'
  | 'weak_inference'
  | 'insufficient_evidence'
  | 'input_blocked';

export type RulesetFieldUsage = 'public_copy_source' | 'internal_only' | 'policy_guardrail';

export type RulesetFieldValidationStatus = 'pass' | 'warn' | 'fail';

export type RulesetFieldValidation = {
  status: RulesetFieldValidationStatus;
  notes: string[];
};

export type RulesetFieldMetadata = {
  semanticAiValue?: JsonValue;
  semanticFinalValue?: JsonValue;
  sourceStatus?: RulesetFieldSourceStatus;
  policyRefs?: string[];
  usage?: RulesetFieldUsage;
  reason?: string | null;
  validation?: RulesetFieldValidation;
};

export const MEDICAL_POLICY_REF = 'kr_medical_ad_policy.v1';

export const MEDICAL_NEGATIVE_EXPRESSIONS = [
  '부작용 없음',
  '효과보장',
  '100% 효과',
  '완전 제거',
  '무조건 개선'
];

export const MEDICAL_INDUSTRY_COMMON_RULES = [
  '의료/피부과 콘텐츠는 개인별 결과 차이를 명시합니다.',
  '상담 필요성과 부작용 가능성을 함께 안내합니다.',
  '리뷰 표현을 치료 효과 주장으로 전환하지 않습니다.'
];

export const REVIEW_INSIGHT_FIELD_KEYS = new Set(['reviewStrength', 'reviewWeakness']);
export const POLICY_GUARDRAIL_FIELD_KEYS = new Set(['industryCommonRules', 'negativeExpressions']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asSourceStatus(value: unknown): RulesetFieldSourceStatus | undefined {
  if (
    value === 'direct_fact' ||
    value === 'inferred_from_pattern' ||
    value === 'computed' ||
    value === 'default_policy' ||
    value === 'policy_default' ||
    value === 'weak_inference' ||
    value === 'insufficient_evidence' ||
    value === 'input_blocked'
  ) {
    return value;
  }
  return undefined;
}

function asUsage(value: unknown): RulesetFieldUsage | undefined {
  if (value === 'public_copy_source' || value === 'internal_only' || value === 'policy_guardrail') return value;
  return undefined;
}

function asValidation(value: unknown): RulesetFieldValidation | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  if (status !== 'pass' && status !== 'warn' && status !== 'fail') return undefined;
  return {
    status,
    notes: asStringArray(value.notes)
  };
}

export function readRulesetFieldMetadata(value: JsonValue | unknown): RulesetFieldMetadata {
  if (!isRecord(value)) return {};
  const metadata: RulesetFieldMetadata = {};
  if ('semanticAiValue' in value) metadata.semanticAiValue = value.semanticAiValue as JsonValue;
  if ('semanticFinalValue' in value) metadata.semanticFinalValue = value.semanticFinalValue as JsonValue;
  const sourceStatus = asSourceStatus(value.sourceStatus);
  if (sourceStatus) metadata.sourceStatus = sourceStatus;
  const policyRefs = asStringArray(value.policyRefs);
  if (policyRefs.length > 0) metadata.policyRefs = policyRefs;
  const usage = asUsage(value.usage);
  if (usage) metadata.usage = usage;
  if (typeof value.reason === 'string' || value.reason === null) metadata.reason = value.reason;
  const validation = asValidation(value.validation);
  if (validation) metadata.validation = validation;
  return metadata;
}

export function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim())));
}

export function semanticValueToDisplay(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback.trim();
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  if (isRecord(value)) return JSON.stringify(value);
  return String(value).trim();
}

export function semanticFinalValueForField(field: RulesetField) {
  const metadata = readRulesetFieldMetadata(field.metadata);
  return Object.prototype.hasOwnProperty.call(metadata, 'semanticFinalValue')
    ? metadata.semanticFinalValue
    : field.finalValue || field.fieldValue || field.aiValue;
}

export function sourceStatusForMetadata(metadata: RulesetFieldMetadata, fieldKey: string): RulesetFieldSourceStatus | null {
  if (metadata.sourceStatus) return metadata.sourceStatus;
  if (POLICY_GUARDRAIL_FIELD_KEYS.has(fieldKey)) return 'policy_default';
  if (REVIEW_INSIGHT_FIELD_KEYS.has(fieldKey)) return 'inferred_from_pattern';
  return null;
}

export function usageForMetadata(metadata: RulesetFieldMetadata, fieldKey: string): RulesetFieldUsage {
  if (metadata.usage) return metadata.usage;
  if (POLICY_GUARDRAIL_FIELD_KEYS.has(fieldKey)) return 'policy_guardrail';
  if (REVIEW_INSIGHT_FIELD_KEYS.has(fieldKey)) return 'internal_only';
  return 'public_copy_source';
}

export function policyRefsForMetadata(metadata: RulesetFieldMetadata, fieldKey: string) {
  const refs = metadata.policyRefs ?? [];
  return POLICY_GUARDRAIL_FIELD_KEYS.has(fieldKey) ? uniqueStrings([...refs, MEDICAL_POLICY_REF]) : refs;
}
