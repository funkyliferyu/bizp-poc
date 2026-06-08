# Codex Handoff

## Current Scope

NAVER-BLOG-001 adds server-side rendered Naver Blog body collection for the Store Learning & Blog Content Automation PoC.

This change implements collection-run integration when `NAVER_BLOG_PROVIDER=page` or `NAVER_BLOG_PROVIDER=rendered`. It discovers Naver Blog post links from a configured owner Blog URL, renders individual post pages, stores full blog bodies as `collection_items`, keeps browser pages calling `poc-server` APIs only, and preserves mock mode. It does not implement Naver Blog publishing, Naver login automation, UI redesign, `admin/`, `pc-web/`, or old Event-to-Operation workflow changes.

## NAVER-BLOG-001 Runtime Pieces

- `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
  - Adds `naverBlogRenderedCollectionProvider`.
  - Normalizes Naver Blog root/list/post URLs.
  - Uses `NAVER_BLOG_RENDERER_ENDPOINT` when provided. The endpoint receives `?url=...` and may return JSON `{ finalUrl, html, bodyText }` or raw HTML.
  - Falls back to the existing Playwright renderer path when no renderer endpoint is configured.
  - Extracts post title, full body text, author, published date, tags, image URLs, blogId, and logNo from rendered Blog snapshots.
  - Detects Naver restriction pages and throws instead of saving restricted HTML as successful Blog data.
- `poc-server/src/storeLearning/collection/collectionRunner.ts`
  - Passes `storeChannels` into collection providers so the Blog channel URL can be used as the owner Blog source.
  - Selects `naverBlogRenderedCollectionProvider` when only the Blog provider is rendered/page.
- `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
  - Uses rendered Blog body collection when both `NAVER_PLACE_PROVIDER=rendered` and `NAVER_BLOG_PROVIDER=page|rendered` are configured.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Reports rendered/page Blog body collection as `ready`.
  - Keeps RSS collection, Naver Blog publishing, and image generation as separate provider work.
- `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`
  - Fixture-first tests for Blog URL normalization, post link/body parsing, and API-backed collection item persistence.
- `poc-server/test/naverBlogLiveIntegration.test.ts`
  - Extends opt-in `npm run naver:verify` for Blog body collection when `NAVER_LIVE_BLOG_URL` is provided.

## NAVER-BLOG-001 Operating Notes

Rendered Blog body collection configuration:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_BLOG_PROVIDER=rendered
```

Equivalent page-provider configuration:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_BLOG_PROVIDER=page
```

Optional deterministic/external Blog renderer configuration:

```text
NAVER_BLOG_RENDERER_ENDPOINT=http://127.0.0.1:PORT/render-blog
```

Optional explicit post URL list:

```text
NAVER_BLOG_POST_URLS=https://blog.naver.com/blogId/123,https://blog.naver.com/blogId/456
```

If `NAVER_BLOG_POST_URLS` is not set, the provider uses the store's `blog` channel `sourceUrl`, or `NAVER_BLOG_URL`, to render a mobile `PostList.naver` page and discover post URLs.

## Next Suggested Task

NAVER-REPLY-001 or PUBLISH-REAL-001 should add owner-authorized server-side provider design for Naver owner reply/publishing actions. Real write actions must stay explicitly gated and should not run from browser JavaScript.

## Previous Scope

NAVER-REVIEW-001 adds server-side rendered Naver Place visitor review collection for the Store Learning & Blog Content Automation PoC.

This change implements collection-run integration when `NAVER_PLACE_PROVIDER=rendered`. It renders/parses the Place visitor review tab, stores visitor reviews as `collection_items` with reply/keyword metadata, keeps browser pages calling `poc-server` APIs only, and preserves mock mode. It does not implement owner reply publishing, Naver Blog body collection, UI redesign, `admin/`, `pc-web/`, or old Event-to-Operation workflow changes.

## NAVER-REVIEW-001 Runtime Pieces

- `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
  - Adds `naverPlaceRenderedCollectionProvider`.
  - Builds `/review/visitor` URLs from full Naver Place URLs and can resolve short URLs through the renderer's final URL.
  - Parses rendered visitor review cards into body text, reviewer/date/rating, review keywords, media/video flags, owner reply text, `hasOwnerReply`, and `replyStatus`.
  - Emits place profile snapshot items from the stored store record.
  - Keeps blog collection mocked or official-search-only in this step; full owner Blog body collection remains separate.
  - Detects Naver restriction pages and fails the collection run instead of saving partial restricted HTML as successful review data.
- `poc-server/src/storeLearning/collection/collectionRunner.ts`
  - Selects `naverPlaceRenderedCollectionProvider` when `NAVER_PLACE_PROVIDER=rendered`.
  - Existing source metadata enrichment stores `sourceKind=place_visitor_review`, `sourceOwnership=user_generated`, and owner authorization metadata.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Reports rendered Place visitor review collection as ready.
  - Continues to report full owner Blog body collection as future provider work.
- `poc-server/test/naverPlaceRenderedCollectionProvider.test.ts`
  - Fixture-first tests for review URL construction, review parsing, and API-backed collection item persistence.
- `poc-server/test/naverPlaceLiveIntegration.test.ts`
  - Extends opt-in `npm run naver:verify` to cover visitor review collection behavior or Naver restriction handling.

## NAVER-REVIEW-001 Operating Notes

Rendered review collection configuration:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
```

Optional renderer endpoint for deterministic or externally managed browser rendering:

```text
NAVER_PLACE_RENDERER_ENDPOINT=http://127.0.0.1:PORT/render-place
```

The rendered review provider stores visitor reviews as user-generated source data. Actual owner reply automation and Naver Blog body crawling are still not implemented.

## Next Suggested Task

NAVER-BLOG-001 should add owner-authorized Naver Blog body collection behind a server-side provider adapter, keeping official Blog Search as snippet-only and preserving mock mode.

## Previous Scope

NAVER-PLACE-001 adds a server-side rendered Naver Place import provider for the Store Learning & Blog Content Automation PoC.

This change implements `NAVER_PLACE_PROVIDER=rendered` for store registration/import. It parses rendered Naver Place profile snapshots into store fields, supports an optional renderer endpoint for deterministic tests or external browser workers, and uses Playwright as the default local renderer. It does not connect collection runs to rendered Place data yet, does not collect visitor reviews yet, does not collect Naver Blog bodies, does not modify browser-side external provider rules, and does not modify `admin/`, `pc-web/`, or old Event-to-Operation workflows.

## NAVER-PLACE-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Adds `naverPlaceRenderedProvider`.
  - Extracts store name, category, address, phone, directions/description, business hours, homepage, convenience, rating, review counts, and image URLs from rendered Place snapshots.
  - Uses `NAVER_PLACE_RENDERER_ENDPOINT` when provided. The endpoint receives `?url=...` and may return JSON `{ finalUrl, html, bodyText }` or raw HTML.
  - Falls back to Playwright rendering when no renderer endpoint is configured.
  - Detects Naver restriction pages and throws instead of saving partial metadata as a successful import.
- `poc-server/src/storeLearning/providers/placeImportService.ts`
  - Routes `NAVER_PLACE_PROVIDER=rendered` to `naverPlaceRenderedProvider`.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Reports rendered Place import as `ready`.
  - Keeps collection runner rendered/page/RSS capabilities as `fallback_required` until later collection PRs.
- `poc-server/package.json`
  - Adds Playwright runtime dependency.
  - Adds `npm run naver:verify` for opt-in live rendered Place verification.
- `poc-server/test/naverPlaceRenderedProvider.test.ts`
  - Fixture-first parser and API coverage for rendered Place import.
- `poc-server/test/naverPlaceLiveIntegration.test.ts`
  - Opt-in live verification. Normal `npm test` skips it unless `RUN_NAVER_LIVE=1`.

## NAVER-PLACE-001 Operating Notes

Default local tests do not require browser rendering or live Naver access.

Rendered provider configuration:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
```

Optional deterministic/external renderer configuration:

```text
NAVER_PLACE_RENDERER_ENDPOINT=http://127.0.0.1:PORT/render-place
```

Optional Playwright knobs:

```text
NAVER_PLACE_RENDERER_CHANNEL=chrome
NAVER_PLACE_RENDERER_CHROME_PATH=/path/to/chrome
NAVER_PLACE_RENDERER_TIMEOUT_MS=15000
NAVER_PLACE_RENDERER_SETTLE_MS=1200
NAVER_PLACE_RENDERER_HEADLESS=true
```

Current live smoke note: in this local environment, Naver returned a restriction page for the Playwright-rendered request. `npm run naver:verify` passed by verifying that restriction handling works and does not persist partial metadata as a successful import.

## Next Suggested Task

NAVER-REVIEW-001 should connect rendered Place review-page collection behind `NAVER_PLACE_PROVIDER=rendered`, store visitor review items with reply metadata, and keep fixture tests plus opt-in live verification separate.

## Previous Scope

OWNER-SOURCE-001 adds owner-authorized Naver source routing metadata for the Store Learning & Blog Content Automation PoC.

This change prepares the codebase for real owner-managed Naver Place, Naver Blog, and visitor review collection without implementing rendered page crawling yet. It keeps browser pages calling `poc-server` only, preserves mock mode, and does not modify `admin/`, `pc-web/`, static page design, or the old Event-to-Operation workflow.

## OWNER-SOURCE-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/ownerSourcePolicy.ts`
  - Centralizes `NAVER_OWNER_AUTHORIZED`, `NAVER_PLACE_PROVIDER`, and `NAVER_BLOG_PROVIDER` parsing.
  - Supports place provider values: `mock`, `official_search`, `rendered`.
  - Supports blog provider values: `mock`, `official_search`, `rss`, `page`, `rendered`.
  - Provides source metadata for `owner_blog_post`, `place_profile`, `place_visitor_review`, and `place_blog_review`.
- `poc-server/src/storeLearning/providers/placeImportService.ts`
  - Honors explicit `NAVER_PLACE_PROVIDER=official_search` even when legacy mock mode is unset.
  - Adds owner/source metadata to imported store metadata.
- `poc-server/src/storeLearning/routes/stores.ts`
  - Stores owner/source metadata on the Place channel settings.
  - Persists `summary.sourcePolicy` when creating collection runs.
- `poc-server/src/storeLearning/collection/collectionRunner.ts`
  - Enriches collection item metadata with `ownerAuthorized`, `sourceKind`, `sourceOwnership`, configured provider fields, and default `bodyAvailability`.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Exposes `ownerSourcePolicy`.
  - Shows selected rendered/page/RSS provider adapters as `fallback_required` until those adapters are implemented.

## OWNER-SOURCE-001 Env Contract

Default local demo still works without external keys:

```text
NAVER_OWNER_AUTHORIZED unset => false
NAVER_PLACE_PROVIDER unset => mock when STORE_LEARNING_MOCK_MODE is not false
NAVER_BLOG_PROVIDER unset => mock when STORE_LEARNING_MOCK_MODE is not false
```

Explicit owner-authorized configuration examples:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=official_search
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
NAVER_BLOG_PROVIDER=page
```

The second example is intentionally readiness-only for now. Rendered Place and page/RSS Blog providers are selected as future adapters but not implemented in OWNER-SOURCE-001.

## OWNER-SOURCE-001 Follow-Up Status

NAVER-PLACE-001 has now implemented the rendered Place import provider. Rendered Place collection-run integration and visitor review collection remain separate follow-up work.

## Earlier Scope

OPS-001 adds provider readiness guardrails for the Store Learning & Blog Content Automation PoC.

This change exposes a safe server-side readiness contract that shows which mock/real providers are active, which credentials are configured, and which Naver/OpenAI-dependent capabilities still require approved fallback providers. It does not connect new UI behavior, make external provider calls, generate real images, publish to Naver Blog, modify `admin/` or `pc-web/`, or change existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/test/openaiLiveIntegration.test.ts`
  - Adds opt-in live OpenAI validation.
  - Skips during normal `npm test`.
  - Runs only when `RUN_OPENAI_INTEGRATION=1`.
  - Verifies OpenAI runtime probe, OpenAI analysis persistence, OpenAI blog generation, and OpenAI SEO rescoring.
- `poc-server/package.json`
  - Adds `npm run openai:verify` for the live validation set.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Builds a secret-safe provider readiness payload.
  - Reports mock vs real provider selection for Place import, collection, analysis, blog generation, image generation, and publishing.
  - Declares official Naver limitations for full blog body, full Place body, and Place reviews.
  - Lists next actions needed before fully real operation.
- `poc-server/src/storeLearning/routes/readiness.ts`
  - Adds `GET /api/store-learning/provider-readiness`.
  - Keeps readiness access behind `poc-server` APIs only.
- `poc-server/src/index.ts`
  - Mounts the Store Learning readiness route.
- `poc-server/test/providerReadinessApi.test.ts`
  - Covers no-key mock readiness.
  - Covers configured real provider readiness without leaking credentials.
  - Covers the API route response.

## Runtime Behavior

Default local demo:

```text
OPENAI_API_KEY is unset
NAVER_CLIENT_ID is unset
NAVER_CLIENT_SECRET is unset
STORE_LEARNING_MOCK_MODE is unset
```

Result:

- `mode = mock`.
- Place import reports `mockPlaceProvider`.
- Collection reports `mockCollectionProvider`.
- Analysis reports `mockDeterministicAnalyzer`.
- Blog generation reports `mock_ruleset_blog_generator`.
- Image generation reports `placeholder_only`.
- Publishing reports `local_status_only`.
- No external provider request is made.

Credentialed partial-real mode:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # optional
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
STORE_LEARNING_MOCK_MODE=false
```

Result:

- Place import reports `naverLocalSearchProvider`.
- Collection reports `naverSearchCollectionProvider` with `partial_ready`.
- Analysis reports `openAIAnalysisProvider`.
- Blog generation reports `openAIBlogProvider`.
- Full blog body and Place reviews still report `fallback_required` because official Naver APIs do not provide those bodies.
- Image generation and real publishing still require explicit provider adapters.

## Guardrails

- Browser pages still call poc-server APIs only.
- OpenAI and Naver credentials stay server-side.
- `poc-server/.env` is ignored and must not be committed.
- `poc-server/.env.example` remains trackable but must not contain real keys.
- Readiness payloads expose booleans and provider names, not secret values.
- Mock mode still works without external keys.
- Live OpenAI tests are opt-in and may consume API quota.
- Official Naver APIs remain treated as partial data sources:
  - Blog Search: snippet/metadata only.
  - Local Search: local metadata only.
  - Full blog body, full Place body, and Place reviews require fallback provider design.
- LLM output validation remains enforced in analysis and blog generation providers.
- Real image generation and real Naver Blog publishing remain out of scope.

## OpenAI Validation Operating Notes

Run from `poc-server/`:

```bash
npm run openai:verify
```

This command performs live OpenAI calls for:

- model access probe
- analysis provider structured output
- blog generation provider structured output
- SEO scoring provider structured output

Normal `npm test` remains mock-safe because `openaiLiveIntegration.test.ts` is skipped unless `RUN_OPENAI_INTEGRATION=1` is set.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Default mock smoke:

```bash
curl http://localhost:5178/api/store-learning/provider-readiness
```

Expected no-key result:

- `productFlow = Store Learning & Blog Content Automation PoC`.
- `mode = mock`.
- `credentials.openaiConfigured = false`.
- `credentials.naverSearchConfigured = false`.
- Provider statuses are mock/placeholder/local-status only.

Credentialed readiness smoke:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- Set `STORE_LEARNING_MOCK_MODE=false`.
- Repeat the readiness request.
- Expect OpenAI/Naver provider entries to show ready or partial_ready.
- Confirm full blog body and Place reviews still show fallback requirements.

## Next Suggested Task

Before any production-like pilot, decide approved fallback providers and operating policies for:

- full Naver Blog body access
- Naver Place reviews
- image generation
- Naver Blog publishing
- provider failure/error UX in the existing static pages
