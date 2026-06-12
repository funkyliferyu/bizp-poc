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

const DEFAULT_MODEL = 'gpt-4o-mini';

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
  const evidenceSchema = z.object({
    collectionItemId: itemIdSchema,
    evidenceType: z.string().min(1),
    summary: z.string().min(1),
    score: z.number().min(0).max(1).nullable()
  });
  const rulesetFieldValueSchema = z.object({
    aiValue: z.string().min(1),
    finalValue: z.string().min(1),
    evidenceItemIds: z.array(itemIdSchema).min(1),
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

function normalizeOpenAIAnalyzerOutput(
  parsed: unknown,
  evidenceItemIds: readonly string[],
  requestedRulesetFieldKeys: readonly string[]
) {
  const output = createOpenAIAnalyzerOutputSchema(evidenceItemIds, requestedRulesetFieldKeys).parse(parsed);
  const { rulesetFieldsByKey, ...analysis } = output;
  return {
    ...analysis,
    rulesetFields: requestedRulesetFieldKeys.map((fieldKey) => {
      const field = rulesetFieldsByKey[fieldKey];
      return {
        fieldKey,
        aiValue: field.aiValue,
        userValue: null,
        finalValue: field.finalValue,
        source: 'openai_analysis',
        locked: false,
        evidenceItemIds: field.evidenceItemIds,
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
              'Populate every requested ruleset field in rulesetFieldsByKey exactly once. Do not populate blocked fields.'
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
          prompt.promptInput.requestedRulesetFieldKeys
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
