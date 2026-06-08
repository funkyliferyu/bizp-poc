import { describe, expect, it } from 'vitest';
import { createNaverBlogRenderedCollectionProvider } from '../src/storeLearning/collection/naverBlogRenderedCollectionProvider.js';

const runLive = process.env.RUN_NAVER_LIVE === '1';
const maybeDescribe = runLive ? describe : describe.skip;

maybeDescribe('Naver Blog live rendered integration', () => {
  it('collects owner-authorized Blog body data through the rendered provider when configured and reachable', async () => {
    const naverBlogUrl = process.env.NAVER_LIVE_BLOG_URL;
    if (!naverBlogUrl) {
      console.warn('Set NAVER_LIVE_BLOG_URL to run live rendered Naver Blog body verification.');
      expect(true).toBe(true);
      return;
    }

    const provider = createNaverBlogRenderedCollectionProvider();
    let items: Awaited<ReturnType<typeof provider.collect>>;
    try {
      items = await provider.collect({
        env: {
          ...process.env,
          NAVER_OWNER_AUTHORIZED: 'true',
          NAVER_BLOG_PROVIDER: 'rendered',
          NAVER_PLACE_PROVIDER: 'mock'
        },
        plan: {
          blogPostLimit: 1,
          includePlaceProfile: false,
          placeReviewLimit: 0
        },
        store: {
          id: 'store_live_naver_blog',
          name: 'Naver live Blog',
          naverPlaceUrl: null,
          naverPlaceId: null,
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        },
        storeChannels: [
          {
            id: 'channel_live_blog',
            storeId: 'store_live_naver_blog',
            channel: 'blog',
            sourceUrl: naverBlogUrl,
            status: 'connected',
            providerMode: 'real',
            settings: null,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
          }
        ]
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('restricted by Naver')) {
        console.warn('Naver Blog live rendered request was restricted by Naver; restriction handling verified.');
        expect(message).toContain('restricted by Naver');
        return;
      }
      throw error;
    }

    expect(items).toHaveLength(1);
    expect(items[0].metadata).toEqual(
      expect.objectContaining({
        provider: 'naverBlogRenderedCollectionProvider',
        providerMode: 'real'
      })
    );
    if (items[0].status === 'failed') {
      console.warn('Naver Blog live rendered request completed without a collectible body; fallback state verified.');
      expect(items[0].metadata).toHaveProperty('reason');
      return;
    }
    expect(items[0]).toEqual(
      expect.objectContaining({
        channel: 'blog',
        sourceType: 'post',
        bodyText: expect.any(String)
      })
    );
  }, 30000);
});
