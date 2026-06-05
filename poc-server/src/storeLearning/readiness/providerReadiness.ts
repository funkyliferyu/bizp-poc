import { canUseRealNaverCollection } from '../collection/collectionProviders.js';
import { canUseNaverLocalSearchProvider } from '../providers/naverLocalSearchProvider.js';
import type { ProviderEnv } from '../providers/placeImportTypes.js';

type ProviderStatus =
  | 'ready'
  | 'partial_ready'
  | 'mock_ready'
  | 'not_configured'
  | 'fallback_required'
  | 'placeholder_only'
  | 'local_status_only';

type CapabilityStatus = 'ready' | 'mock' | 'not_configured' | 'fallback_required' | 'placeholder_only' | 'local_status_only';

type ProviderCapability = {
  key: string;
  status: CapabilityStatus;
  dataAvailability: string;
  officialApi?: string | null;
  fallbackRequired?: boolean;
};

type ProviderReadinessEntry = {
  selectedProvider: string | null;
  status: ProviderStatus;
  mode: 'mock' | 'parser' | 'real' | 'openai' | 'placeholder' | 'local_status';
  capabilities: ProviderCapability[];
  model?: string;
  notes: string[];
};

type NaverLimitation = {
  capability: string;
  officialApiCoverage: string;
  requiredApproach: 'fallback_provider_required' | 'provider_adapter_required';
};

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function openaiConfigured(env: ProviderEnv) {
  return Boolean(env.OPENAI_API_KEY);
}

function naverSearchConfigured(env: ProviderEnv) {
  return Boolean(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
}

function mockModeForced(env: ProviderEnv) {
  return env.STORE_LEARNING_MOCK_MODE !== 'false';
}

function placeImportReadiness(env: ProviderEnv): ProviderReadinessEntry {
  if (canUseNaverLocalSearchProvider(env) && !mockModeForced(env)) {
    return {
      selectedProvider: 'naverLocalSearchProvider',
      status: 'ready',
      mode: 'real',
      capabilities: [
        {
          key: 'place_url_resolution',
          status: 'ready',
          dataAvailability: 'official_local_search_metadata_only',
          officialApi: 'Naver Search API - Local'
        }
      ],
      notes: ['Full Place body and reviews are not available from the official Local Search API.']
    };
  }

  return {
    selectedProvider: 'mockPlaceProvider',
    status: 'mock_ready',
    mode: 'mock',
    capabilities: [
      {
        key: 'place_url_resolution',
        status: 'mock',
        dataAvailability: 'deterministic_demo_store'
      },
      {
        key: 'place_url_candidate_parsing',
        status: 'ready',
        dataAvailability: 'url_metadata_only',
        officialApi: null
      }
    ],
    notes: ['Set STORE_LEARNING_MOCK_MODE=false and Naver credentials to enable official Naver Local Search import.']
  };
}

function collectionReadiness(env: ProviderEnv): ProviderReadinessEntry {
  if (canUseRealNaverCollection(env)) {
    return {
      selectedProvider: 'naverSearchCollectionProvider',
      status: 'partial_ready',
      mode: 'real',
      capabilities: [
        {
          key: 'naver_blog_search',
          status: 'ready',
          dataAvailability: 'snippet_only',
          officialApi: 'Naver Search API - Blog'
        },
        {
          key: 'naver_place_profile',
          status: 'ready',
          dataAvailability: 'official_local_search_metadata_only',
          officialApi: 'Naver Search API - Local'
        },
        {
          key: 'full_blog_body',
          status: 'fallback_required',
          dataAvailability: 'official_api_unsupported',
          officialApi: 'Naver Search API - Blog',
          fallbackRequired: true
        },
        {
          key: 'place_reviews',
          status: 'fallback_required',
          dataAvailability: 'official_api_unsupported',
          officialApi: 'Naver Search API - Local',
          fallbackRequired: true
        }
      ],
      notes: ['Official Naver APIs provide search snippets/metadata, not full blog bodies or Place reviews.']
    };
  }

  return {
    selectedProvider: 'mockCollectionProvider',
    status: 'mock_ready',
    mode: 'mock',
    capabilities: [
      {
        key: 'naver_blog_search',
        status: 'mock',
        dataAvailability: 'deterministic_demo_items'
      },
      {
        key: 'naver_place_profile',
        status: 'mock',
        dataAvailability: 'deterministic_demo_profile'
      },
      {
        key: 'place_reviews',
        status: 'mock',
        dataAvailability: 'deterministic_demo_reviews'
      }
    ],
    notes: ['Mock collection remains available without external keys.']
  };
}

function analysisReadiness(env: ProviderEnv): ProviderReadinessEntry {
  if (openaiConfigured(env)) {
    return {
      selectedProvider: 'openAIAnalysisProvider',
      status: 'ready',
      mode: 'openai',
      model: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      capabilities: [
        {
          key: 'learning_snapshot_generation',
          status: 'ready',
          dataAvailability: 'zod_validated_structured_output'
        },
        {
          key: 'marketing_ruleset_generation',
          status: 'ready',
          dataAvailability: 'zod_validated_structured_output'
        }
      ],
      notes: ['Analysis outputs are validated with Zod before persistence.']
    };
  }

  return {
    selectedProvider: 'mockDeterministicAnalyzer',
    status: 'mock_ready',
    mode: 'mock',
    capabilities: [
      {
        key: 'learning_snapshot_generation',
        status: 'mock',
        dataAvailability: 'deterministic_demo_analysis'
      },
      {
        key: 'marketing_ruleset_generation',
        status: 'mock',
        dataAvailability: 'deterministic_demo_ruleset'
      }
    ],
    notes: ['Set OPENAI_API_KEY to enable OpenAI analysis.']
  };
}

function blogGenerationReadiness(env: ProviderEnv): ProviderReadinessEntry {
  if (openaiConfigured(env)) {
    return {
      selectedProvider: 'openAIBlogProvider',
      status: 'ready',
      mode: 'openai',
      model: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      capabilities: [
        {
          key: 'blog_draft_generation',
          status: 'ready',
          dataAvailability: 'zod_validated_structured_output'
        },
        {
          key: 'blog_text_regeneration',
          status: 'ready',
          dataAvailability: 'zod_validated_structured_output'
        },
        {
          key: 'seo_rescoring',
          status: 'ready',
          dataAvailability: 'zod_validated_structured_output'
        }
      ],
      notes: ['Blog draft and SEO outputs are validated with Zod before persistence.']
    };
  }

  return {
    selectedProvider: 'mock_ruleset_blog_generator',
    status: 'mock_ready',
    mode: 'mock',
    capabilities: [
      {
        key: 'blog_draft_generation',
        status: 'mock',
        dataAvailability: 'deterministic_ruleset_based_draft'
      },
      {
        key: 'blog_text_regeneration',
        status: 'mock',
        dataAvailability: 'deterministic_text_revision'
      },
      {
        key: 'seo_rescoring',
        status: 'mock',
        dataAvailability: 'deterministic_local_score'
      }
    ],
    notes: ['Set OPENAI_API_KEY to enable OpenAI blog generation and SEO scoring.']
  };
}

function imageGenerationReadiness(): ProviderReadinessEntry {
  return {
    selectedProvider: null,
    status: 'placeholder_only',
    mode: 'placeholder',
    capabilities: [
      {
        key: 'image_prompt_regeneration',
        status: 'placeholder_only',
        dataAvailability: 'local_prompt_placeholder_only'
      },
      {
        key: 'real_image_generation',
        status: 'not_configured',
        dataAvailability: 'provider_adapter_not_implemented',
        fallbackRequired: true
      }
    ],
    notes: ['Real image generation must be added behind an explicit server-side provider adapter.']
  };
}

function publishingReadiness(): ProviderReadinessEntry {
  return {
    selectedProvider: null,
    status: 'local_status_only',
    mode: 'local_status',
    capabilities: [
      {
        key: 'publish_request_state',
        status: 'local_status_only',
        dataAvailability: 'sqlite_status_transition'
      },
      {
        key: 'real_naver_blog_publish',
        status: 'not_configured',
        dataAvailability: 'provider_adapter_not_implemented',
        fallbackRequired: true
      }
    ],
    notes: ['Real Naver Blog publishing must stay server-side and behind an explicit provider adapter.']
  };
}

function officialNaverLimitations(): NaverLimitation[] {
  return [
    {
      capability: 'full_blog_body',
      officialApiCoverage: 'Naver Blog Search returns search result snippets and metadata only.',
      requiredApproach: 'fallback_provider_required'
    },
    {
      capability: 'place_reviews',
      officialApiCoverage: 'Naver Local Search does not return Place review bodies.',
      requiredApproach: 'fallback_provider_required'
    },
    {
      capability: 'full_place_body',
      officialApiCoverage: 'Naver Local Search returns local metadata only.',
      requiredApproach: 'fallback_provider_required'
    }
  ];
}

function nextActions(env: ProviderEnv) {
  const actions: string[] = [];
  if (!openaiConfigured(env)) actions.push('configure_openai_api_key_for_real_llm_outputs');
  if (!naverSearchConfigured(env)) actions.push('configure_naver_search_credentials_for_real_official_search');
  if (mockModeForced(env) && naverSearchConfigured(env)) actions.push('set_store_learning_mock_mode_false_for_real_naver_search');
  actions.push('select_approved_fallback_provider_for_full_blog_body');
  actions.push('select_approved_fallback_provider_for_place_reviews');
  actions.push('define_server_side_image_generation_provider_before_real_images');
  actions.push('define_server_side_naver_blog_publish_adapter_before_real_publish');
  return actions;
}

export function buildProviderReadiness(env: ProviderEnv = process.env, now: () => string = () => new Date().toISOString()) {
  const openaiReady = openaiConfigured(env);
  const naverReady = naverSearchConfigured(env) && !mockModeForced(env);
  const mode = openaiReady || naverReady ? 'real_configured' : 'mock';

  return {
    productFlow: 'Store Learning & Blog Content Automation PoC',
    mode,
    checkedAt: now(),
    credentials: {
      openaiConfigured: openaiReady,
      naverSearchConfigured: naverSearchConfigured(env),
      storeLearningMockMode: mockModeForced(env)
    },
    providers: {
      placeImport: placeImportReadiness(env),
      collection: collectionReadiness(env),
      analysis: analysisReadiness(env),
      blogGeneration: blogGenerationReadiness(env),
      imageGeneration: imageGenerationReadiness(),
      publishing: publishingReadiness()
    },
    officialNaverLimitations: officialNaverLimitations(),
    nextActions: nextActions(env)
  };
}
