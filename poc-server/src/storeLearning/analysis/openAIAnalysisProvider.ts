import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../../ai/openaiClient.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';
import { AnalyzerOutputSchema, createMockAnalysisProvider, type AnalysisProvider, type AnalyzerInput } from './analyzer.js';

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

function compactItem(item: AnalyzerInput['selectedItems'][number]) {
  return {
    id: item.id,
    channel: item.channel,
    sourceType: item.sourceType,
    title: item.title,
    bodyText: item.bodyText?.slice(0, 1200) ?? null,
    sourceUrl: item.sourceUrl,
    metadata: item.metadata
  };
}

function promptInput({ store, selectedItems }: AnalyzerInput) {
  return {
    task: 'Analyze selected collected content for Store Learning & Blog Content Automation PoC.',
    constraints: [
      'Return Korean marketing strategy analysis only.',
      'Every evidence.collectionItemId must be one of the provided selected item IDs.',
      'Every rulesetFields[].evidenceItemIds entry must be one of the provided selected item IDs.',
      'Do not invent customer reviews or collection items.',
      'Keep claims conservative and evidence-linked.',
      'Use source=openai_analysis for generated ruleset fields.'
    ],
    store: {
      id: store.id,
      name: store.name,
      category: store.category,
      address: store.address,
      description: store.description,
      metadata: store.metadata
    },
    selectedItemIds: selectedItems.map((item) => item.id),
    selectedItems: selectedItems.map((item) => compactItem(item)),
    requiredRulesetFieldKeys: [
      'storePositioning',
      'keyStrengths',
      'targetCustomers',
      'toneAndManner',
      'blogWritingStyle',
      'seoKeywords',
      'ctaStyle',
      'imageDirection',
      'negativeExpressions'
    ]
  };
}

export function createOpenAIAnalysisProvider(options: OpenAIAnalysisProviderOptions = {}): AnalysisProvider {
  return {
    name: 'openAIAnalysisProvider',
    mode: 'openai',
    async analyze(input) {
      const client = 'client' in options ? options.client : getOpenAIClient();
      if (!client) {
        throw new Error('OpenAI client is unavailable');
      }

      const completion = await client.beta.chat.completions.parse({
        model: options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a Korean local-store marketing strategist. Analyze collected blog/place evidence and return a strict JSON ruleset. ' +
              'Use only provided collection items as evidence. Avoid unsupported superlatives and medical/legal/guarantee claims.'
          },
          {
            role: 'user',
            content: JSON.stringify(promptInput(input), null, 2)
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
