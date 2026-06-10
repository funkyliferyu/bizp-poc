import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../ai/openaiClient.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
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

export function createOpenAIAnalysisProvider(options: OpenAIAnalysisProviderOptions = {}): AnalysisProvider {
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  let lastRunMetadata: AnalysisPromptBudgetMetadata | null = null;

  return {
    name: 'openAIAnalysisProvider',
    mode: 'openai',
    model,
    getLastRunMetadata: () => lastRunMetadata,
    async analyze(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }
      const prompt = buildAnalysisPromptInput(input);
      lastRunMetadata = prompt.metadata;

      const completion = await client.beta.chat.completions.parse({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a Korean local-store marketing strategist. Analyze collected blog/place evidence and return a strict JSON ruleset. ' +
              'Use only provided collection items as evidence. Avoid unsupported superlatives and medical/legal/guarantee claims.'
          },
          {
            role: 'user',
            content: JSON.stringify(prompt.promptInput, null, 2)
          }
        ],
        response_format: zodResponseFormat(AnalyzerOutputSchema, 'store_learning_analysis')
      });

      return completion.choices[0]?.message.parsed;
    }
  };
}

export function createAnalysisProvider(env: ProviderEnv = process.env): AnalysisProvider {
  if (env.OPENAI_API_KEY) {
    return createOpenAIAnalysisProvider({ model: env.OPENAI_MODEL });
  }
  return createMockAnalysisProvider();
}
