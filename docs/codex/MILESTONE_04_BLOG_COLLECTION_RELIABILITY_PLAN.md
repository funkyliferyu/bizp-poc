# Milestone 04 Blog Collection Reliability Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered Naver Blog collection more reliable by falling back to Naver Blog RSS when mobile `PostList.naver` does not expose usable post links.

**Architecture:** Keep all external Blog access behind `poc-server` provider adapters. The existing rendered/page Blog provider continues to discover post URLs from explicit URLs, direct post URLs, and mobile PostList; this milestone adds RSS post-link discovery as the next fallback before returning failed placeholder items. Collection items and browser flows remain unchanged.

**Tech Stack:** TypeScript, Vitest, Express test harness, fixture-first provider tests, static Store Learning docs.

---

## Scope

Included:

- Add deterministic RSS fixture coverage for Naver Blog post discovery.
- Add RSS fallback when mobile `PostList.naver` returns no post links.
- Add RSS fallback when mobile `PostList.naver` is restricted by Naver.
- Preserve explicit `NAVER_BLOG_POST_URLS` and direct post URL priority.
- Preserve browser boundary: no static HTML/JS calls Naver or RSS directly.
- Update Codex handoff and validation notes.

Excluded:

- Blog RAW viewer.
- Content selection UI changes.
- Analyzer/ruleset changes.
- Learning status changes.
- Naver login automation or publishing automation.
- `admin/`, `pc-web/`, and old Event-to-Operation files.

## Root Cause And Current Pattern

Current provider order:

1. `NAVER_BLOG_POST_URLS`
2. direct Naver Blog post URL
3. mobile `PostList.naver` rendered page

Current gap:

- `ownerSourcePolicy` already accepts `NAVER_BLOG_PROVIDER=rss`, and product notes mention RSS as a fallback direction.
- `naverBlogRenderedCollectionProvider` does not currently build or parse an RSS URL.
- If `PostList.naver` has no links, collection returns `rendered_blog_post_links_not_found`.
- If `PostList.naver` is restricted, collection throws and the run can fail before trying another available source.

## Task 1: Branch And Baseline

**Files:**

- Read: `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
- Read: `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`
- Read: `docs/codex/HANDOFF.md`
- Read: `docs/codex/VALIDATION.md`

- [x] Step 1: Create `codex/blog-collection-reliability` from the current Milestone 03 branch.

Expected:

- This branch is stacked on `codex/training-settings-contract` while PR #28 is open.
- Existing unrelated `.DS_Store` local modification remains unstaged.

- [x] Step 2: Confirm current provider gap.

Expected:

- `postUrlsForSource` tries explicit post URLs, a direct post URL, and then `PostList.naver`.
- No RSS URL builder or RSS parser exists.

## Task 2: TDD For RSS Fallback

**Files:**

- Create: `poc-server/test/fixtures/naver-blog-rss.xml`
- Modify: `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`

- [x] Step 1: Add the RSS fixture.

Create `poc-server/test/fixtures/naver-blog-rss.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>분당 케이크하우스</title>
    <item>
      <title>레터링 케이크 예약 안내</title>
      <link>https://blog.naver.com/demo-cake/223500000001</link>
      <guid>https://blog.naver.com/demo-cake/223500000001</guid>
    </item>
    <item>
      <title>부모님 생신 케이크 제작 후기</title>
      <link>https://blog.naver.com/demo-cake/223500000002</link>
      <guid>https://blog.naver.com/demo-cake/223500000002</guid>
    </item>
  </channel>
</rss>
```

- [x] Step 2: Read the RSS fixture in the test file.

Add:

```ts
const rssFixturePath = fileURLToPath(new URL('./fixtures/naver-blog-rss.xml', import.meta.url));
const rssFixtureXml = readFileSync(rssFixturePath, 'utf8');
const blogRssUrl = 'https://rss.blog.naver.com/demo-cake.xml';
```

- [x] Step 3: Add a failing test for empty PostList fallback.

Add:

```ts
it('falls back to Naver Blog RSS when PostList has no post links', async () => {
  const requestedUrls: string[] = [];
  const items = await collectRenderedBlogItems({
    env: {
      NAVER_OWNER_AUTHORIZED: 'true',
      NAVER_BLOG_PROVIDER: 'rendered',
      NAVER_PLACE_PROVIDER: 'mock'
    },
    plan: {
      blogPostLimit: 2,
      includePlaceProfile: false,
      placeReviewLimit: 0
    },
    store: {
      id: 'store_rss_blog',
      name: 'RSS Blog Store',
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
        id: 'channel_rss_blog',
        storeId: 'store_rss_blog',
        channel: 'blog',
        sourceUrl: blogRootUrl,
        status: 'connected',
        providerMode: 'real',
        settings: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }
    ],
    renderer: async (url) => {
      requestedUrls.push(url);
      if (url === blogListUrl) return { finalUrl: blogListUrl, html: '<html><body>no posts</body></html>', bodyText: null };
      if (url === blogRssUrl) return { finalUrl: blogRssUrl, html: rssFixtureXml, bodyText: null };
      if (url === blogPostOneUrl) return { finalUrl: blogPostOneUrl, html: postOneFixtureHtml, bodyText: null };
      if (url === blogPostTwoUrl) return { finalUrl: blogPostTwoUrl, html: postTwoFixtureHtml, bodyText: null };
      throw new Error(`unexpected rendered URL: ${url}`);
    }
  });

  expect(requestedUrls).toContain(blogListUrl);
  expect(requestedUrls).toContain(blogRssUrl);
  expect(items).toHaveLength(2);
  expect(items.map((item) => item.status ?? 'pending')).toEqual(['pending', 'pending']);
  expect(items.map((item) => item.sourceUrl)).toEqual([blogPostOneUrl, blogPostTwoUrl]);
  expect(items[0].metadata).toEqual(expect.objectContaining({ blogSourceDiscovery: 'rss' }));
});
```

- [x] Step 4: Add a failing test for restricted PostList fallback.

Add:

```ts
it('falls back to Naver Blog RSS when PostList is restricted', async () => {
  const items = await collectRenderedBlogItems({
    env: {
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
      id: 'store_restricted_blog',
      name: 'Restricted Blog Store',
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
        id: 'channel_restricted_blog',
        storeId: 'store_restricted_blog',
        channel: 'blog',
        sourceUrl: blogRootUrl,
        status: 'connected',
        providerMode: 'real',
        settings: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }
    ],
    renderer: async (url) => {
      if (url === blogListUrl) {
        return { finalUrl: blogListUrl, html: '<html><body>서비스 이용이 제한되었습니다</body></html>', bodyText: '서비스 이용이 제한되었습니다' };
      }
      if (url === blogRssUrl) return { finalUrl: blogRssUrl, html: rssFixtureXml, bodyText: null };
      if (url === blogPostOneUrl) return { finalUrl: blogPostOneUrl, html: postOneFixtureHtml, bodyText: null };
      throw new Error(`unexpected rendered URL: ${url}`);
    }
  });

  expect(items).toHaveLength(1);
  expect(items[0]).toEqual(
    expect.objectContaining({
      sourceUrl: blogPostOneUrl,
      title: '레터링 케이크 예약 안내',
      bodyText: expect.stringContaining('최소 하루 전 예약을 권장합니다.')
    })
  );
  expect(items[0].metadata).toEqual(expect.objectContaining({ blogSourceDiscovery: 'rss' }));
});
```

- [x] Step 5: Run the focused tests and verify RED.

Run from `poc-server/`:

```bash
npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"
```

Expected:

- FAIL because the provider does not request `https://rss.blog.naver.com/demo-cake.xml` and returns failed placeholders or throws on restriction.

## Task 3: Implement RSS Discovery

**Files:**

- Modify: `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`

- [x] Step 1: Export `toNaverBlogRssUrl`.

Add after `toNaverBlogListUrl`:

```ts
export function toNaverBlogRssUrl(value: string | null) {
  const url = naverBlogUrl(value);
  if (!url) return null;

  const params = postParamsFrom(value);
  const blogId = params?.blogId ?? cleanText(url.searchParams.get('blogId')) ?? firstPathSegment(url);
  if (!blogId) return null;
  return `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
}
```

- [x] Step 2: Add `extractRenderedBlogRssPostLinks`.

Add near `extractRenderedBlogPostLinks`:

```ts
export function extractRenderedBlogRssPostLinks(input: { html: string; finalUrl: string }) {
  const urls = new Set<string>();
  for (const match of input.html.matchAll(/<(?:link|guid)\\b[^>]*>([\\s\\S]*?)<\\/(?:link|guid)>/gi)) {
    const rawLink = stripTags(match[1]);
    if (!rawLink) continue;
    const postUrl = toNaverBlogPostUrl(rawLink);
    if (postUrl) urls.add(postUrl);
  }
  return Array.from(urls);
}
```

- [x] Step 3: Add RSS fallback to `postUrlsForSource`.

Replace the PostList-only block with:

```ts
  const listUrl = toNaverBlogListUrl(sourceUrl);
  const rssUrl = toNaverBlogRssUrl(sourceUrl);
  const listPostUrls: string[] = [];

  if (listUrl) {
    try {
      const snapshot = await renderer(listUrl, env);
      if (!isRestrictedSnapshot(snapshot)) {
        listPostUrls.push(
          ...extractRenderedBlogPostLinks({
            html: snapshot.html,
            finalUrl: snapshot.finalUrl || listUrl
          })
        );
      }
    } catch (error) {
      if (!rssUrl) throw error;
    }
  }
  if (listPostUrls.length > 0) return listPostUrls.slice(0, limit);

  if (!rssUrl) return [];
  const rssSnapshot = await renderer(rssUrl, env);
  return extractRenderedBlogRssPostLinks({
    html: rssSnapshot.html,
    finalUrl: rssSnapshot.finalUrl || rssUrl
  }).slice(0, limit);
```

- [x] Step 4: Preserve discovery metadata.

Update URL discovery to return `{ url, discovery }` records or otherwise set each collected item metadata to include:

```ts
blogSourceDiscovery: 'direct_post' | 'post_list' | 'rss' | 'explicit_env'
```

Expected:

- RSS-sourced collection items include `blogSourceDiscovery: 'rss'`.
- Existing direct URL behavior still works.

## Task 4: GREEN And Regression Validation

**Files:**

- Read: `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`
- Read: `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`

- [x] Step 1: Run focused RSS tests.

Run from `poc-server/`:

```bash
npm test -- naverBlogRenderedCollectionProvider.test.ts -t "RSS"
```

Expected: PASS.

- [x] Step 2: Run full rendered Blog provider tests.

Run from `poc-server/`:

```bash
npm test -- naverBlogRenderedCollectionProvider.test.ts
```

Expected: PASS.

- [x] Step 3: Run collection progress API tests.

Run from `poc-server/`:

```bash
npm test -- collectionProgressApi.test.ts
```

Expected: PASS.

- [x] Step 4: Run typecheck.

Run from `poc-server/`:

```bash
npm run typecheck
```

Expected: PASS.

- [x] Step 5: Check whitespace.

Run from repo root:

```bash
git diff --check
```

Expected: no output and exit code `0`.

## Task 5: Update Operating Docs

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Add Milestone 04 scope to `HANDOFF.md`.
- [x] Step 2: Add Milestone 04 commands and validation evidence to `VALIDATION.md`.

Expected:

- Future sessions know rendered Blog collection now uses RSS as a fallback for post discovery.

## Task 6: Publish

**Files:**

- Stage only milestone files.

- [x] Step 1: Confirm staged files exclude `.DS_Store`.

Expected milestone files:

- `docs/codex/MILESTONE_04_BLOG_COLLECTION_RELIABILITY_PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
- `poc-server/test/fixtures/naver-blog-rss.xml`
- `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`

- [ ] Step 2: Commit.

Use:

```bash
git commit -m "feat: add blog rss collection fallback"
```

- [ ] Step 3: Push and open a draft PR.

Expected:

- Push `codex/blog-collection-reliability`.
- Open a draft PR stacked on `codex/training-settings-contract` while PR #28 is open.
- After PR #28 merges, retarget this PR to `develop`.
