import { createOpenAIBlogFormulaV2Provider, type OpenAIBlogFormulaParseClient } from './openAIBlogFormulaProvider.js';
import { createSafeMockBlogFormulaV2Provider } from './safeMockBlogFormulaProvider.js';
import type {
  BlogFormulaV2ExtractProviderMode,
  BlogFormulaV2Provider
} from './blogFormulaV2Provider.js';

export type BlogFormulaV2ProviderFactoryEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type BlogFormulaV2ProviderFactoryOptions = {
  env?: BlogFormulaV2ProviderFactoryEnv;
  openAIClient?: OpenAIBlogFormulaParseClient | null;
  model?: string;
};

function createOpenAIProvider(options: BlogFormulaV2ProviderFactoryOptions) {
  const env = options.env ?? process.env;
  const providerOptions: Parameters<typeof createOpenAIBlogFormulaV2Provider>[0] = {
    model: options.model ?? env.OPENAI_MODEL
  };
  if ('openAIClient' in options) {
    providerOptions.client = options.openAIClient;
  }
  return createOpenAIBlogFormulaV2Provider(providerOptions);
}

export function createBlogFormulaV2ProviderForMode(
  providerMode: BlogFormulaV2ExtractProviderMode | undefined,
  options: BlogFormulaV2ProviderFactoryOptions = {}
): BlogFormulaV2Provider | null {
  if (!providerMode || providerMode === 'deterministic') return null;
  if (providerMode === 'safe_mock') return createSafeMockBlogFormulaV2Provider();
  if (providerMode === 'openai') return createOpenAIProvider(options);

  const env = options.env ?? process.env;
  if (env.OPENAI_API_KEY) return createOpenAIProvider(options);
  return createSafeMockBlogFormulaV2Provider();
}
