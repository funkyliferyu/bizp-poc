import type { LlmCallAuditMetadata } from '../../llmAudit/llmAuditMetadata.js';
import type {
  BLOG_FORMULA_V2_DRAFT_CALL_ID,
  BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
  BlogFormulaV2DraftPromptBudgetMetadata,
  BlogFormulaV2DraftPromptInput
} from '../blogDraftPrompt.js';
import type { BlogFormulaV2PromptInputStore } from '../blogFormulaPrompt.js';
import type { BlogDraftCreativeV2 } from '../draftOutput.js';
import type {
  BlogFormulaSetV2,
  BlogRetrievedSampleV2,
  BlogTopicBriefInput,
  ModelReportedComplianceV2
} from '../types.js';

export type BlogDraftV2ProviderMode = 'safe_mock' | 'openai';
export type BlogDraftV2GenerateProviderMode = 'deterministic' | BlogDraftV2ProviderMode | 'auto';

export type BlogDraftV2ProviderProvenance = {
  name: string;
  mode: BlogDraftV2ProviderMode;
  model: string;
  callId: typeof BLOG_FORMULA_V2_DRAFT_CALL_ID;
  promptShapeVersion: typeof BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION;
  noExternalCalls: boolean;
};

export type BlogDraftV2GenerateInput = {
  store: BlogFormulaV2PromptInputStore;
  formula: BlogFormulaSetV2;
  topicBrief: BlogTopicBriefInput;
  samples: BlogRetrievedSampleV2[];
};

export type BlogDraftV2ProviderResult = {
  creative: BlogDraftCreativeV2;
  modelReportedCompliance: ModelReportedComplianceV2;
  provider: BlogDraftV2ProviderProvenance;
  inputBudget: BlogFormulaV2DraftPromptBudgetMetadata;
  promptInput: BlogFormulaV2DraftPromptInput;
};

export type BlogDraftV2Provider = {
  name: string;
  mode: BlogDraftV2ProviderMode;
  model: string;
  generateDraft(input: BlogDraftV2GenerateInput): Promise<BlogDraftV2ProviderResult>;
  getLastAuditMetadata?: () => LlmCallAuditMetadata | null;
};
