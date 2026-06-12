import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getOpenAIClient } from '../../ai/openaiClient.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import {
  durationMs,
  nowIso,
  sanitizedProviderError,
  summarizeResponseFormat,
  toJsonValue,
  type LlmCallAuditMetadata
} from '../llmAudit/llmAuditMetadata.js';
import { buildAnalysisPromptInput, type AnalysisPromptBudgetMetadata } from './analysisPromptBudget.js';
import { AnalyzerOutputSchema, createMockAnalysisProvider, type AnalysisProvider } from './analyzer.js';
import {
  MEDICAL_INDUSTRY_COMMON_RULES,
  MEDICAL_NEGATIVE_EXPRESSIONS,
  POLICY_GUARDRAIL_FIELD_KEYS,
  REVIEW_INSIGHT_FIELD_KEYS,
  policyRefsForMetadata,
  semanticValueToDisplay,
  uniqueStrings,
  type RulesetFieldMetadata,
  type RulesetFieldSourceStatus,
  type RulesetFieldUsage
} from '../rulesets/rulesetFieldMetadata.js';

type ParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAIAnalysisProviderOptions = {
  client?: ParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-5.4-mini';

function promptItemIdSchema(promptItemIds: readonly string[]) {
  const uniqueIds = Array.from(new Set(promptItemIds.filter(Boolean)));
  if (uniqueIds.length === 0) return z.string().min(1);
  return z.enum(uniqueIds as [string, ...string[]]);
}

export function createOpenAIAnalyzerOutputSchema(
  evidenceItemIds: readonly string[],
  requestedRulesetFieldKeys: readonly string[]
) {
  const itemIdSchema = promptItemIdSchema(evidenceItemIds);
  const objectValueSchema = z.object({
    summary: z.string().nullable(),
    items: z.array(z.string()),
    notes: z.array(z.string())
  });
  const rulesetSemanticValueSchema = z.union([
    z.string().min(1),
    z.array(z.string().min(1)).min(1),
    objectValueSchema,
    z.null()
  ]);
  const evidenceSchema = z.object({
    collectionItemId: itemIdSchema,
    evidenceType: z.string().min(1),
    summary: z.string().min(1),
    score: z.number().min(0).max(1).nullable()
  });
  const rulesetFieldValueSchema = z.object({
    aiValue: rulesetSemanticValueSchema,
    finalValue: rulesetSemanticValueSchema,
    sourceStatus: z.enum([
      'direct_fact',
      'inferred_from_pattern',
      'computed',
      'default_policy',
      'policy_default',
      'weak_inference',
      'insufficient_evidence',
      'input_blocked'
    ]),
    evidenceItemIds: z.array(itemIdSchema),
    policyRefs: z.array(z.string().min(1)),
    usage: z.enum(['public_copy_source', 'internal_only', 'policy_guardrail']),
    reason: z.string().min(1).nullable(),
    validation: z.object({
      status: z.enum(['pass', 'warn', 'fail']),
      notes: z.array(z.string())
    }),
    confidence: z.number().min(0).max(1).nullable()
  });
  const rulesetFieldsByKeyShape: Record<string, typeof rulesetFieldValueSchema> = {};
  for (const fieldKey of requestedRulesetFieldKeys) {
    rulesetFieldsByKeyShape[fieldKey] = rulesetFieldValueSchema;
  }

  return AnalyzerOutputSchema.omit({ evidence: true, rulesetFields: true }).extend({
    evidence: z.array(evidenceSchema).min(1),
    rulesetFieldsByKey: z.object(rulesetFieldsByKeyShape)
  });
}

function policyDefaultValue(fieldKey: string, useMedicalPolicyDefaults: boolean) {
  if (!useMedicalPolicyDefaults) return null;
  if (fieldKey === 'negativeExpressions') return MEDICAL_NEGATIVE_EXPRESSIONS;
  if (fieldKey === 'industryCommonRules') return MEDICAL_INDUSTRY_COMMON_RULES;
  return null;
}

function normalizeFieldMetadata(
  fieldKey: string,
  field: {
    aiValue: unknown;
    finalValue: unknown;
    sourceStatus: RulesetFieldSourceStatus;
    policyRefs: string[];
    usage: RulesetFieldUsage;
    reason: string | null;
    validation: RulesetFieldMetadata['validation'];
  },
  useMedicalPolicyDefaults: boolean
): RulesetFieldMetadata {
  const policyValue = policyDefaultValue(fieldKey, useMedicalPolicyDefaults);
  const sourceStatus = policyValue ? 'policy_default' : field.sourceStatus;
  const usage = policyValue ? 'policy_guardrail' : REVIEW_INSIGHT_FIELD_KEYS.has(fieldKey) ? 'internal_only' : 'public_copy_source';
  const semanticFinalValue = policyValue ?? field.finalValue;
  const semanticAiValue = policyValue ?? field.aiValue;
  const baseMetadata: RulesetFieldMetadata = {
    semanticAiValue: semanticAiValue as RulesetFieldMetadata['semanticAiValue'],
    semanticFinalValue: semanticFinalValue as RulesetFieldMetadata['semanticFinalValue'],
    sourceStatus,
    usage,
    reason: field.reason,
    validation: field.validation
  };
  const policyRefs = policyRefsForMetadata(
    {
      ...baseMetadata,
      policyRefs: field.policyRefs
    },
    fieldKey
  );
  if (policyRefs.length > 0) baseMetadata.policyRefs = uniqueStrings(policyRefs);
  return baseMetadata;
}

function normalizeOpenAIAnalyzerOutput(
  parsed: unknown,
  evidenceItemIds: readonly string[],
  requestedRulesetFieldKeys: readonly string[],
  useMedicalPolicyDefaults: boolean
) {
  const output = createOpenAIAnalyzerOutputSchema(evidenceItemIds, requestedRulesetFieldKeys).parse(parsed);
  const { rulesetFieldsByKey, ...analysis } = output;
  return {
    ...analysis,
    negativeExpressions: useMedicalPolicyDefaults ? MEDICAL_NEGATIVE_EXPRESSIONS : analysis.negativeExpressions,
    rulesetFields: requestedRulesetFieldKeys.map((fieldKey) => {
      const field = rulesetFieldsByKey[fieldKey];
      const metadata = normalizeFieldMetadata(fieldKey, field, useMedicalPolicyDefaults);
      const semanticFinalValue = metadata.semanticFinalValue;
      const semanticAiValue = metadata.semanticAiValue;
      const fallback = metadata.reason ?? '';
      const finalValue = semanticValueToDisplay(semanticFinalValue, fallback);
      const aiValue = semanticValueToDisplay(semanticAiValue, finalValue);
      return {
        fieldKey,
        aiValue,
        userValue: null,
        finalValue,
        source: 'openai_analysis',
        locked: false,
        evidenceItemIds: POLICY_GUARDRAIL_FIELD_KEYS.has(fieldKey) ? [] : field.evidenceItemIds,
        metadata,
        confidence: field.confidence
      };
    })
  };
}

export function createOpenAIAnalysisProvider(options: OpenAIAnalysisProviderOptions = {}): AnalysisProvider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  let lastRunMetadata: AnalysisPromptBudgetMetadata | null = null;
  let lastAuditMetadata: LlmCallAuditMetadata | null = null;

  return {
    name: 'openAIAnalysisProvider',
    mode: 'openai',
    model,
    getLastRunMetadata: () => lastRunMetadata,
    getLastAuditMetadata: () => lastAuditMetadata,
    async analyze(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }
      const prompt = buildAnalysisPromptInput(input);
      lastRunMetadata = prompt.metadata;
      lastAuditMetadata = null;
      const responseFormat = zodResponseFormat(
        createOpenAIAnalyzerOutputSchema(prompt.promptInput.evidenceItemIds, prompt.promptInput.requestedRulesetFieldKeys),
        'store_learning_analysis'
      );
      const requestPayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content:
              'You are a Korean local-store marketing strategist. Analyze collected blog/place evidence and return a strict JSON ruleset. ' +
              'Use only provided collection items as evidence. Avoid unsupported superlatives and medical/legal/guarantee claims. ' +
              'Return semantic finalValue values: use null with sourceStatus=insufficient_evidence when evidence is not enough. ' +
              'When a semantic value must be an object, use { summary: string|null, items: string[], notes: string[] }. ' +
              'Use Place visitor reviews only for reviewStrength/reviewWeakness; if only Blog evidence supports a review field, return null, insufficient_evidence, and empty evidenceItemIds. ' +
              'Use owner Blog evidence for Blog SOP fields, and policy_default with empty evidence for policy guardrails. ' +
              'For medical/skin-clinic policy, ban definitive guarantee expressions such as 부작용 없음, 효과보장, 100% 효과, 완전 제거, not the word 부작용 by itself.'
          },
          {
            role: 'user' as const,
            content: JSON.stringify(prompt.promptInput, null, 2)
          }
        ],
        response_format: responseFormat
      };
      const requestStartedAt = nowIso();
      let parsedOutput: unknown = null;

      try {
        const completion = await client.beta.chat.completions.parse(requestPayload);

        parsedOutput = completion.choices[0]?.message.parsed ?? null;
        const output = normalizeOpenAIAnalyzerOutput(
          parsedOutput,
          prompt.promptInput.evidenceItemIds,
          prompt.promptInput.requestedRulesetFieldKeys,
          prompt.promptInput.industryPolicy.isHealthcare
        );
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_analysis'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: toJsonValue(output),
          parsedOutputJson: toJsonValue(output),
          errorJson: null
        };
        return output;
      } catch (error) {
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, 'store_learning_analysis'),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: null,
          parsedOutputJson: toJsonValue(parsedOutput),
          errorJson: sanitizedProviderError(error)
        };
        throw error;
      }
    }
  };
}

export function createAnalysisProvider(env: ProviderEnv = process.env): AnalysisProvider {
  if (env.OPENAI_API_KEY) {
    return createOpenAIAnalysisProvider({ model: env.OPENAI_MODEL });
  }
  return createMockAnalysisProvider();
}
