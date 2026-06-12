import {
  BLOG_FORMULA_V2_CALL_ID,
  BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
  buildBlogFormulaV2PromptInput
} from '../blogFormulaPrompt.js';
import { buildGenerationReadyMockFormula } from '../mockFormulaBuilder.js';
import type { BlogFormulaSetV2 } from '../types.js';
import type {
  BlogFormulaV2ExtractInput,
  BlogFormulaV2Provider,
  BlogFormulaV2ProviderProvenance
} from './blogFormulaV2Provider.js';

const SAFE_MOCK_MODEL = 'safe-mock-blog-formula-v2';

export function buildSafeMockBlogFormulaV2(input: BlogFormulaV2ExtractInput): BlogFormulaSetV2 {
  return buildGenerationReadyMockFormula(input.ownerBlogPosts);
}

function provenance(): BlogFormulaV2ProviderProvenance {
  return {
    name: 'safeMockBlogFormulaV2Provider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    callId: BLOG_FORMULA_V2_CALL_ID,
    promptShapeVersion: BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
    noExternalCalls: true
  };
}

export function createSafeMockBlogFormulaV2Provider(): BlogFormulaV2Provider {
  return {
    name: 'safeMockBlogFormulaV2Provider',
    mode: 'safe_mock',
    model: SAFE_MOCK_MODEL,
    async extractFormula(input) {
      const prompt = buildBlogFormulaV2PromptInput(input);
      const postsById = new Map(input.ownerBlogPosts.map((post) => [post.collectionItemId, post]));
      const promptBoundedInput = {
        ...input,
        ownerBlogPosts: prompt.promptInput.sourcePostIds
          .map((sourcePostId) => postsById.get(sourcePostId))
          .filter((post): post is BlogFormulaV2ExtractInput['ownerBlogPosts'][number] => Boolean(post))
      };
      return {
        output: buildSafeMockBlogFormulaV2(promptBoundedInput),
        provider: provenance(),
        inputBudget: prompt.metadata,
        promptInput: prompt.promptInput
      };
    }
  };
}
