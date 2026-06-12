import {
  BLOG_FORMULA_V2_CALL_ID,
  BLOG_FORMULA_V2_PROMPT_SCHEMA_VERSION,
  buildBlogFormulaV2PromptInput
} from '../blogFormulaPrompt.js';
import { BlogFormulaSetV2Schema, type BlogFormulaSetV2 } from '../types.js';
import type {
  BlogFormulaV2ExtractInput,
  BlogFormulaV2Provider,
  BlogFormulaV2ProviderProvenance
} from './blogFormulaV2Provider.js';

const SAFE_MOCK_MODEL = 'safe-mock-blog-formula-v2';

function sourceIds(input: BlogFormulaV2ExtractInput) {
  return input.ownerBlogPosts.map((post) => post.collectionItemId);
}

export function buildSafeMockBlogFormulaV2(input: BlogFormulaV2ExtractInput): BlogFormulaSetV2 {
  const ids = sourceIds(input);
  const firstTitle = input.ownerBlogPosts[0]?.title ?? '{주제} 안내';
  const common = {
    sourcePostIds: ids,
    confidence: input.ownerBlogPosts.length >= 3 ? 0.88 : 0.62,
    status: input.ownerBlogPosts.length >= 3 ? ('confirmed' as const) : ('candidate' as const)
  };

  return BlogFormulaSetV2Schema.parse({
    schemaVersion: 'blog_formula_v2.0',
    titleFormula: {
      ...common,
      name: '걱정 해소형 제목',
      description: '주요 시술명과 고객 우려를 제목 앞쪽에 두고, 확인 기준을 약속합니다.',
      pattern: firstTitle.includes('부작용') ? '{메인키워드} 걱정 없이 확인할 점' : '{주제} 전 먼저 확인해야 하는 기준'
    },
    introFormula: {
      ...common,
      name: '고객 걱정 선제 제시',
      description: '첫 문단에서 검색자가 가진 걱정을 먼저 언급한 뒤 오늘 확인할 기준을 예고합니다.',
      pattern: '고객의 핵심 걱정 → 오늘 확인할 기준 예고'
    },
    bodyFormula: {
      ...common,
      name: '원리-판단기준-주의사항 전개',
      description: '장비나 시술 원리를 짧게 설명하고, 개인별 판단 기준과 주의사항으로 이어갑니다.',
      pattern: '고민 배경 → 원리 설명 → 개인별 판단 기준 → 회복/주의사항 → CTA'
    },
    headingFormula: {
      ...common,
      name: '질문형 소제목',
      description: '고객이 실제로 묻는 질문을 소제목으로 사용하고, 각 소제목 아래 2문단 내외로 답합니다.',
      pattern: '질문형 또는 기준 제시형 소제목 3-4개'
    },
    toneAndMannerFormula: {
      ...common,
      name: '차분한 의료 정보 안내',
      description: '단정적인 보장 표현보다 상담 기준과 확인 사항을 설명하는 톤을 유지합니다.',
      pattern: '차분함, 구체적 안내, 과장 회피'
    },
    ctaFormula: {
      ...common,
      name: '상담 확인형 CTA',
      description: '마지막 문단에서 본인 상태에 맞는 상담을 권합니다.',
      pattern: '본인 상태 확인 → 의료진 상담 권유'
    },
    footerFormula: {
      ...common,
      name: '의료광고 안전 푸터',
      description: '개인차와 부작용 가능성을 하단에 반복 고지합니다.',
      pattern: '의료정보 제공 목적 + 개인차/부작용 가능성 + 의료진 상담'
    },
    medicalSafetyFormula: {
      ...common,
      name: '의료 안전 공식',
      description: '효과 보장이나 부작용 부정 표현을 피하고 개인차, 부작용 가능성, 상담 필요성을 포함합니다.',
      pattern: '개인차 → 부작용 가능성 → 의료진 상담',
      requiredDisclosures: ['개인차', '부작용 가능성', '의료진 상담']
    }
  });
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
