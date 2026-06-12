import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../../ai/openaiClient.js';
import {
  durationMs,
  nowIso,
  sanitizedProviderError,
  summarizeResponseFormat,
  toJsonValue,
  type LlmCallAuditMetadata
} from '../../llmAudit/llmAuditMetadata.js';
import {
  BLOG_FORMULA_V2_CALL_ID,
  BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
  BLOG_FORMULA_V2_RESPONSE_FORMAT_NAME,
  buildBlogFormulaV2PromptInput
} from '../blogFormulaPrompt.js';
import { BlogFormulaSetV2Schema } from '../types.js';
import type {
  BlogFormulaV2Provider,
  BlogFormulaV2ProviderProvenance
} from './blogFormulaV2Provider.js';

export type OpenAIBlogFormulaParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type OpenAIBlogFormulaProviderOptions = {
  client?: OpenAIBlogFormulaParseClient | null;
  model?: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const systemPrompt =
  'You are a Korean local-store blog formula analyst. Extract reusable writing formula blocks from the provided owner Blog posts only. ' +
  'Return strict structured Blog Formula V2 JSON. Do not invent evidence, customer reviews, or provider facts. ' +
  'Keep medical, legal, and guarantee claims conservative.';

function provenance(model: string): BlogFormulaV2ProviderProvenance {
  return {
    name: 'openAIBlogFormulaV2Provider',
    mode: 'openai',
    model,
    callId: BLOG_FORMULA_V2_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: false
  };
}

export function createOpenAIBlogFormulaV2Provider(
  options: OpenAIBlogFormulaProviderOptions = {}
): BlogFormulaV2Provider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  let lastAuditMetadata: LlmCallAuditMetadata | null = null;

  return {
    name: 'openAIBlogFormulaV2Provider',
    mode: 'openai',
    model,
    getLastAuditMetadata: () => lastAuditMetadata,
    async extractFormula(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const prompt = buildBlogFormulaV2PromptInput(input);
      lastAuditMetadata = null;
      const responseFormat = zodResponseFormat(BlogFormulaSetV2Schema, BLOG_FORMULA_V2_RESPONSE_FORMAT_NAME);
      const provider = provenance(model);
      const requestPayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content: systemPrompt
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
        const output = BlogFormulaSetV2Schema.parse(parsedOutput);
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, BLOG_FORMULA_V2_RESPONSE_FORMAT_NAME),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: toJsonValue(output),
          parsedOutputJson: toJsonValue(output),
          errorJson: null,
          providerMetadataJson: toJsonValue(provider)
        };
        return {
          output,
          provider,
          inputBudget: prompt.metadata,
          promptInput: prompt.promptInput
        };
      } catch (error) {
        const responseCompletedAt = nowIso();
        lastAuditMetadata = {
          requestStartedAt,
          responseCompletedAt,
          durationMs: durationMs(requestStartedAt, responseCompletedAt),
          inputBudget: toJsonValue(prompt.metadata),
          promptInputJson: toJsonValue(prompt.promptInput),
          responseFormatJson: summarizeResponseFormat(responseFormat, BLOG_FORMULA_V2_RESPONSE_FORMAT_NAME),
          rawRequestedJson: toJsonValue(requestPayload),
          rawParsedOutputJson: toJsonValue(parsedOutput),
          normalizedOutputJson: null,
          parsedOutputJson: toJsonValue(parsedOutput),
          errorJson: sanitizedProviderError(error),
          providerMetadataJson: toJsonValue(provider)
        };
        throw error;
      }
    }
  };
}
