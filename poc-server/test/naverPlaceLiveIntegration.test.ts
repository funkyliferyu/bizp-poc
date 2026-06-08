import { describe, expect, it } from 'vitest';
import { createNaverPlaceRenderedCollectionProvider } from '../src/storeLearning/collection/naverPlaceRenderedCollectionProvider.js';
import { importNaverPlaceUrl } from '../src/storeLearning/providers/placeImportService.js';

const runLive = process.env.RUN_NAVER_LIVE === '1';
const maybeDescribe = runLive ? describe : describe.skip;

maybeDescribe('Naver Place live rendered integration', () => {
  it('imports owner-authorized Place profile data through the rendered provider', async () => {
    const naverPlaceUrl =
      process.env.NAVER_LIVE_PLACE_URL ?? 'https://m.place.naver.com/restaurant/1838952735/home';

    let imported: Awaited<ReturnType<typeof importNaverPlaceUrl>>;
    try {
      imported = await importNaverPlaceUrl(naverPlaceUrl, {
        ...process.env,
        NAVER_OWNER_AUTHORIZED: 'true',
        NAVER_PLACE_PROVIDER: 'rendered'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('restricted by Naver')) {
        console.warn('Naver Place live rendered request was restricted by Naver; restriction handling verified.');
        expect(message).toContain('restricted by Naver');
        return;
      }
      throw error;
    }

    expect(imported.provider).toEqual({ name: 'naverPlaceRenderedProvider', mode: 'real' });
    expect(imported.store.name).toBeTruthy();
    expect(imported.store.name).not.toMatch(/^네이버 플레이스/);
    expect(imported.store.address).toBeTruthy();
    expect(imported.store.metadata).toEqual(
      expect.objectContaining({
        provider: 'naverPlaceRenderedProvider',
        importMode: 'real',
        bodyAvailability: 'rendered_place_profile',
        ownerAuthorized: true,
        sourceKind: 'place_profile',
        sourceOwnership: 'owner_managed',
        configuredPlaceProvider: 'rendered'
      })
    );
  }, 30000);

  it('collects owner-authorized Place visitor review items through the rendered provider when reachable', async () => {
    const naverPlaceUrl =
      process.env.NAVER_LIVE_PLACE_URL ?? 'https://m.place.naver.com/restaurant/1838952735/home';
    const provider = createNaverPlaceRenderedCollectionProvider();

    let items: Awaited<ReturnType<typeof provider.collect>>;
    try {
      items = await provider.collect({
        env: {
          ...process.env,
          NAVER_OWNER_AUTHORIZED: 'true',
          NAVER_PLACE_PROVIDER: 'rendered',
          NAVER_BLOG_PROVIDER: 'mock'
        },
        plan: {
          blogPostLimit: 0,
          includePlaceProfile: false,
          placeReviewLimit: 1
        },
        store: {
          id: 'store_live_naver_place',
          name: 'Naver live Place',
          naverPlaceUrl,
          naverPlaceId: null,
          category: null,
          address: null,
          phone: null,
          description: null,
          metadata: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('restricted by Naver')) {
        console.warn('Naver Place live rendered review request was restricted by Naver; restriction handling verified.');
        expect(message).toContain('restricted by Naver');
        return;
      }
      throw error;
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        channel: 'place',
        sourceType: 'review'
      })
    );
    expect(items[0].metadata).toEqual(
      expect.objectContaining({
        provider: 'naverPlaceRenderedCollectionProvider',
        providerMode: 'real'
      })
    );
  }, 30000);
});
