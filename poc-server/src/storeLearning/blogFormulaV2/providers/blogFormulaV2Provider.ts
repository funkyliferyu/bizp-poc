import type { LlmCallAuditMetadata } from '../../llmAudit/llmAuditMetadata.js';
import type { OwnerBlogPostV2 } from '../sourcePosts.js';
import type { BlogFormulaSetV2 } from '../types.js';
import type {
  BLOG_FORMULA_V2_CALL_ID,
  BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
  BlogFormulaV2PromptBudgetMetadata,
  BlogFormulaV2PromptInput,
  BlogFormulaV2PromptInputStore
} from '../blogFormulaPrompt.js';

export type BlogFormulaV2ProviderMode = 'deterministic' | 'safe_mock' | 'openai';
export type BlogFormulaV2ExtractProviderMode = BlogFormulaV2ProviderMode | 'auto';

export type BlogFormulaV2ProviderProvenance = {
  name: string;
  mode: BlogFormulaV2ProviderMode;
  model: string;
  callId: typeof BLOG_FORMULA_V2_CALL_ID;
  promptShapeVersion: typeof BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION;
  noExternalCalls: boolean;
};

export type BlogFormulaV2ExtractInput = {
  store: BlogFormulaV2PromptInputStore;
  ownerBlogPosts: OwnerBlogPostV2[];
};

export type BlogFormulaV2ProviderResult = {
  output: BlogFormulaSetV2;
  provider: BlogFormulaV2ProviderProvenance;
  inputBudget: BlogFormulaV2PromptBudgetMetadata;
  promptInput: BlogFormulaV2PromptInput;
};

export type BlogFormulaV2Provider = {
  name: string;
  mode: BlogFormulaV2ProviderMode;
  model: string;
  extractFormula(input: BlogFormulaV2ExtractInput): Promise<BlogFormulaV2ProviderResult>;
  getLastAuditMetadata?: () => LlmCallAuditMetadata | null;
};
