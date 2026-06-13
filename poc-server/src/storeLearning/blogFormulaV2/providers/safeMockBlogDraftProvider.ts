import { BLOG_FORMULA_V2_DRAFT_CALL_ID, BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION, buildBlogFormulaV2DraftPromptInput } from '../blogDraftPrompt.js';
import { buildDeterministicDraftCreative, deriveDraftReports } from '../draftOutput.js';
import type {
  BlogDraftV2GenerateInput,
  BlogDraftV2Provider,
  BlogDraftV2ProviderProvenance
} from './blogDraftV2Provider.js';

const SAFE_MOCK_MODEL = 'safe-mock-blog-draft-v2';

function provenance(): BlogDraftV2ProviderProvenance {
  return {
    name: 'safeMockBlogDraftV2Provider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    callId: BLOG_FORMULA_V2_DRAFT_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION,
    noExternalCalls: true
  };
}

export function createSafeMockBlogDraftV2Provider(): BlogDraftV2Provider {
  return {
    name: 'safeMockBlogDraftV2Provider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    async generateDraft(input: BlogDraftV2GenerateInput) {
      const prompt = buildBlogFormulaV2DraftPromptInput({
        store: input.store,
        formula: input.formula,
        topicBrief: input.topicBrief,
        samples: input.samples
      });
      const creative = buildDeterministicDraftCreative(input.formula, input.topicBrief, input.samples);
      const reports = deriveDraftReports({
        formulaSetId: 'safe_mock',
        formula: input.formula,
        topicBrief: input.topicBrief,
        samples: input.samples,
        selectedTitle: creative.selectedTitle,
        blogDraft: creative.blogDraft
      });
      const modelReportedCompliance = {
        styleComplianceReport: { appliedBlocks: reports.styleComplianceReport.appliedBlocks },
        safetyCheck: reports.safetyCheck,
        seoCheck: reports.seoCheck
      };
      return {
        creative,
        modelReportedCompliance,
        provider: provenance(),
        inputBudget: prompt.metadata,
        promptInput: prompt.promptInput
      };
    }
  };
}
