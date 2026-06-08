import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProviderReadiness } from '../src/storeLearning/readiness/providerReadiness.js';
import { createStoreLearningReadinessRoutes } from '../src/storeLearning/routes/readiness.js';

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

describe('Store Learning provider readiness', () => {
  let server: ReturnType<express.Express['listen']> | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  });

  it('reports safe mock readiness and fallback requirements without exposing secrets', () => {
    const readiness = buildProviderReadiness({}, () => '2026-06-06T00:00:00.000Z');

    expect(readiness).toMatchObject({
      productFlow: 'Store Learning & Blog Content Automation PoC',
      mode: 'mock',
      credentials: {
        openaiConfigured: false,
        naverSearchConfigured: false
      },
      providers: {
        placeImport: {
          selectedProvider: 'mockPlaceProvider',
          status: 'mock_ready'
        },
        collection: {
          selectedProvider: 'mockCollectionProvider',
          status: 'mock_ready'
        },
        analysis: {
          selectedProvider: 'mockDeterministicAnalyzer',
          status: 'mock_ready'
        },
        blogGeneration: {
          selectedProvider: 'mock_ruleset_blog_generator',
          status: 'mock_ready'
        },
        imageGeneration: {
          selectedProvider: null,
          status: 'placeholder_only'
        },
        publishing: {
          selectedProvider: null,
          status: 'local_status_only'
        }
      }
    });
    expect(readiness.officialNaverLimitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'full_blog_body',
          requiredApproach: 'fallback_provider_required'
        }),
        expect.objectContaining({
          capability: 'place_reviews',
          requiredApproach: 'fallback_provider_required'
        })
      ])
    );
    expect(JSON.stringify(readiness)).not.toContain('sk-test-secret');
    expect(JSON.stringify(readiness)).not.toContain('naver-secret');
  });

  it('reports configured real providers without leaking credentials', () => {
    const readiness = buildProviderReadiness(
      {
        STORE_LEARNING_MOCK_MODE: 'false',
        NAVER_CLIENT_ID: 'naver-client',
        NAVER_CLIENT_SECRET: 'naver-secret',
        OPENAI_API_KEY: 'sk-test-secret',
        OPENAI_MODEL: 'gpt-4.1-mini'
      },
      () => '2026-06-06T00:00:00.000Z'
    );

    expect(readiness).toMatchObject({
      mode: 'real_configured',
      credentials: {
        openaiConfigured: true,
        naverSearchConfigured: true
      },
      providers: {
        placeImport: {
          selectedProvider: 'naverLocalSearchProvider',
          status: 'ready'
        },
        collection: {
          selectedProvider: 'naverSearchCollectionProvider',
          status: 'partial_ready'
        },
        analysis: {
          selectedProvider: 'openAIAnalysisProvider',
          status: 'ready',
          model: 'gpt-4.1-mini'
        },
        blogGeneration: {
          selectedProvider: 'openAIBlogProvider',
          status: 'ready',
          model: 'gpt-4.1-mini'
        }
      }
    });
    expect(readiness.providers.collection.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'naver_blog_search',
          status: 'ready',
          dataAvailability: 'snippet_only'
        }),
        expect.objectContaining({
          key: 'place_reviews',
          status: 'fallback_required',
          dataAvailability: 'official_api_unsupported'
        })
      ])
    );
    expect(readiness.nextActions).toEqual(expect.arrayContaining(['select_approved_fallback_provider_for_place_reviews']));
    expect(JSON.stringify(readiness)).not.toContain('sk-test-secret');
    expect(JSON.stringify(readiness)).not.toContain('naver-secret');
  });

  it('reports explicit owner-authorized rendered Place review and Blog body collection', () => {
    const readiness = buildProviderReadiness(
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered',
        NAVER_BLOG_PROVIDER: 'page'
      },
      () => '2026-06-06T00:00:00.000Z'
    );

    expect(readiness.ownerSourcePolicy).toEqual({
      ownerAuthorized: true,
      placeProvider: 'rendered',
      blogProvider: 'page'
    });
    expect(readiness.providers.placeImport).toMatchObject({
      selectedProvider: 'naverPlaceRenderedProvider',
      status: 'ready',
      mode: 'real'
    });
    expect(readiness.providers.collection).toMatchObject({
      selectedProvider: 'naverPlaceRenderedCollectionProvider',
      status: 'ready',
      mode: 'real'
    });
    expect(readiness.providers.collection.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'owner_authorized_place_data',
          status: 'ready',
          dataAvailability: 'store_profile_snapshot_plus_rendered_review_tab'
        }),
        expect.objectContaining({
          key: 'place_visitor_reviews',
          status: 'ready',
          dataAvailability: 'rendered_place_visitor_reviews'
        }),
        expect.objectContaining({
          key: 'owner_blog_body',
          status: 'ready',
          dataAvailability: 'rendered_blog_full_body'
        })
      ])
    );
  });

  it('reports rendered Blog collection when only the Blog provider is real', () => {
    const readiness = buildProviderReadiness(
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'mock',
        NAVER_BLOG_PROVIDER: 'rendered'
      },
      () => '2026-06-06T00:00:00.000Z'
    );

    expect(readiness.providers.collection).toMatchObject({
      selectedProvider: 'naverBlogRenderedCollectionProvider',
      status: 'ready',
      mode: 'real'
    });
    expect(readiness.providers.collection.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'owner_blog_body',
          status: 'ready',
          dataAvailability: 'rendered_blog_full_body'
        }),
        expect.objectContaining({
          key: 'place_visitor_reviews',
          status: 'mock'
        })
      ])
    );
    expect(readiness.nextActions).not.toContain('select_approved_fallback_provider_for_full_blog_body');
  });

  it('reports manual publish export readiness and unsupported Naver Blog write actions', () => {
    const manualReadiness = buildProviderReadiness(
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_BLOG_PUBLISH_PROVIDER: 'manual_export'
      },
      () => '2026-06-06T00:00:00.000Z'
    );
    const naverWriteReadiness = buildProviderReadiness(
      {
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_BLOG_PUBLISH_PROVIDER: 'naver_blog_write'
      },
      () => '2026-06-06T00:00:00.000Z'
    );

    expect(manualReadiness.providers.publishing).toMatchObject({
      selectedProvider: 'manualExportBlogPublishProvider',
      status: 'ready',
      mode: 'manual_export'
    });
    expect(manualReadiness.providers.publishing.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'publish_payload_export',
          status: 'ready',
          dataAvailability: 'manual_export_payload'
        })
      ])
    );
    expect(naverWriteReadiness.providers.publishing).toMatchObject({
      selectedProvider: 'unsupportedNaverBlogWriteProvider',
      status: 'fallback_required',
      mode: 'real'
    });
    expect(naverWriteReadiness.providers.publishing.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'real_naver_blog_publish',
          status: 'fallback_required',
          dataAvailability: 'official_blog_write_api_ended',
          fallbackRequired: true
        })
      ])
    );
  });

  it('serves readiness through a poc-server API route only', async () => {
    const app = express();
    app.use('/api/store-learning', createStoreLearningReadinessRoutes({ env: {}, now: () => '2026-06-06T00:00:00.000Z' }));
    server = app.listen(0);
    const address = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${address.port}/api/store-learning/provider-readiness`);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      productFlow: 'Store Learning & Blog Content Automation PoC',
      mode: 'mock'
    });
  });
});
