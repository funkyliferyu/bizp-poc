# Codex Handoff

## Current Scope

MILESTONE-09-BLOG-MANAGEMENT-RESULTS makes Blog management and AI content list pages show approval-pending AI drafts as learning/ruleset-backed results.

The store blog-post list API now:

- Adds `summary.pendingApprovalCount`, `summary.firstPendingApprovalPostId`, `summary.firstPendingApprovalHref`, and `summary.generatedDraftCount`.
- Adds `generationSource` on each serialized blog post.
- Falls back from article `generatedFromRulesetId` to the linked `contentGeneration.rulesetId` so older seeded/demo posts still show their ruleset source.
- Keeps the legacy top-level `pendingApprovalCount` for existing browser compatibility.

The Blog management and AI content list pages now:

- Route the approval-pending alert CTA to the actual first pending approval post detail URL returned by the API.
- Hide the approval alert when there are no pending approval posts.
- Show a compact ruleset/source line under generated post titles.
- Expose `data-generation-source` on rendered rows for static verification.
- Keep browser calls limited to `poc-server` `/api/*` endpoints.

This milestone does not implement real Blog publishing, change provider behavior, create images, redesign the full Blog management/content pages, modify `admin/`, modify `pc-web/`, or touch old Event-to-Operation files.

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/34.

The branch is stacked on `codex/learning-status-results` while PR #33 is open. After PR #33 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-08-LEARNING-STATUS-RESULTS replaces the AI learning status completion display with persisted Store Learning results.

The learning status API now adds a `completion` contract to `GET /api/stores/:storeId/learning-status`.

Completion is computed from persisted PoC data:

- Blog collection is complete when collected Blog post items exist.
- Place profile update is complete when collected Place profile items exist.
- AI analysis is complete when the latest successful analysis artifacts exist.
- Marketing ruleset generation is complete when the latest marketing ruleset and ruleset fields exist.

The learning status page now:

- Renders an API-backed completion summary inside the existing learning status card.
- Shows compact criteria rows for Blog collection, Place information update, AI analysis, and marketing ruleset generation.
- Replaces hardcoded next collection and collection cycle KPI values with API-backed values.
- Keeps ruleset navigation behavior unchanged.
- Keeps browser calls limited to `poc-server` `/api/*` endpoints.

This milestone does not change provider behavior, run external provider calls from the browser, redesign the whole learning status page, change Blog generation/content detail behavior, modify `admin/`, modify `pc-web/`, or touch old Event-to-Operation files.

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/33.

The branch is stacked on `codex/ruleset-ui-source-matrix` while PR #32 is open. After PR #32 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-07-RULESET-UI-SOURCE-MATRIX wires the marketing strategy ruleset screen to the source matrix API contract introduced in Milestone 06.

The ruleset page now:

- Adds source matrix containers for the store, brand, writing, and image sections.
- Adds `data-ruleset-field` / `data-ruleset-value` hooks to rows that were previously static, including representative menu, catchphrase, Blog writing length, image format/style, and overlay policy rows.
- Renders `payload.sourceMatrix` from `GET /api/stores/:storeId/ruleset` into an automatic-input matrix with current value, source tier, automation status, current implementation, and future suggestion columns.
- Adds compact source guidance notes to loaded editable ruleset fields.
- Keeps browser calls limited to `poc-server` APIs and the existing local benchmark fixture.

`seedDemoStore` now seeds expanded demo ruleset fields so `store_demo_cake` has API-backed values for the rows used by the UI source matrix. Existing legacy demo keys such as `positioning` and `contentKeywords` remain for backward compatibility.

This milestone does not redesign the whole ruleset page, add provider calls, change analyzer behavior, change Blog generation, change learning-status completion semantics, modify `admin/`, modify `pc-web/`, or touch old Event-to-Operation files.

Draft PR: https://github.com/funkyliferyu/bizp-poc/pull/32.

The branch is stacked on `codex/ruleset-source-matrix` while PR #31 is open. After PR #31 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-06-RULESET-SOURCE-MATRIX expands the analyzer/ruleset contract before replacing the full strategy ruleset UI.

The new source matrix lives in:

- `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`

It defines direct Place/manual rows and AI-generated ruleset rows with:

- `fieldKey`
- `label`
- `section`
- `valueKind`
- `sourceTier`
- `currentImplementation`
- `inputSources`
- `requiresAi`
- `automationStatus`
- `futureSuggestion`
- `notes`

`GET /api/stores/:storeId/ruleset` now includes `sourceMatrix` on the top-level payload and attaches matching `sourceMatrix` metadata to each serialized ruleset field. Legacy seeded field key `positioning` maps to the canonical `storePositioning` source matrix row so older demo data still has correct source metadata.

The mock analyzer now generates expanded ruleset fields for currently static ruleset rows such as representative menu, review strengths/weaknesses, channel writing policies, colors, image style, and Blog/Instagram image format policies. The OpenAI analyzer prompt reuses the same required field-key list so live analyzer output is asked to align with the matrix.

This milestone does not replace the `web/07_마케팅전략룰셋.html` UI table, add competitor provider collection, change learning-status completion semantics, call external providers from browser pages, modify Blog generation behavior, or modify `admin/`, `pc-web/`, or old Event-to-Operation files.

The branch is stacked on `codex/blog-raw-viewer-evidence` while PR #30 is open. After PR #30 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-05-BLOG-RAW-VIEWER-EVIDENCE adds collection-run RAW data inspection and Blog evidence badges before analysis selection.

The new RAW viewer is:

- `web/collection_raw_data.html`
- `web/collection_raw_data.js`

It fetches only `poc-server` APIs:

- `GET /api/collection-runs/:runId`
- `GET /api/collection-runs/:runId/items`

The viewer has tabs for Blog items, collected Blog items, failed Blog items, all items, and collection run summary. Blog item rows normalize evidence fields such as `metadata.bodyAvailability`, `metadata.blogSourceDiscovery`, `metadata.sourceKind`, `metadata.sourceOwnership`, source URL, body length, body text, and full metadata.

The collection progress page and content selection page now expose `RAW data 보기` buttons that open `collection_raw_data.html?runId=<runId>&section=blogItems`. The content selection table also shows compact evidence badges for body availability, source discovery, and source URL presence.

This milestone does not add backend routes, change Blog collection providers, modify analyzer/ruleset or learning status behavior, call external providers from browser pages, or modify `admin/`, `pc-web/`, or old Event-to-Operation files.

The branch is stacked on `codex/blog-collection-reliability` while PR #29 is open. After PR #29 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-04-BLOG-COLLECTION-RELIABILITY adds RSS post-link discovery as a fallback inside the rendered/page Naver Blog collection provider.

The fallback order is now:

1. explicit `NAVER_BLOG_POST_URLS`;
2. direct Naver Blog post URL;
3. mobile `PostList.naver` post-link discovery;
4. `https://rss.blog.naver.com/<blogId>.xml` RSS post-link discovery.

The rendered Blog provider now:

- Builds RSS URLs from Naver Blog root/list/post URLs.
- Extracts Naver Blog post links from RSS `<link>` and `<guid>` entries.
- Falls back to RSS when `PostList.naver` returns no post links.
- Falls back to RSS when `PostList.naver` is restricted by Naver.
- Records `metadata.blogSourceDiscovery` on collected Blog items, such as `post_list` or `rss`.

This milestone does not add Blog RAW viewing, change content selection UI, implement Naver login/publishing automation, call Naver from browser pages, or modify `admin/`, `pc-web/`, or old Event-to-Operation files.

The branch is stacked on `codex/training-settings-contract` while PR #28 is open. After PR #28 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-03-TRAINING-SETTINGS-CONTRACT records configured training source URLs in the collection run summary.

The contract change is intentionally small:

- `POST /api/stores/:storeId/collection-runs` now writes `summary.sourceUrls`.
- `summary.sourceUrls` contains `naverBlog`, `naverPlace`, `instagram`, and `daangn` from the latest saved training settings.
- Existing `summary.requestedLimits`, `summary.channelPlan`, and `summary.sourcePolicy` are preserved.
- Disabled Instagram/Daangn channels can still retain stored source URLs for future provider work, but this milestone does not enable those providers.
- `web/training_settings.js` remains browser-API-only: it saves settings through `PUT /api/stores/:storeId/training-settings`, then starts collection with `POST /api/stores/:storeId/collection-runs`.

This milestone does not change Blog collection reliability, Blog RAW views, rulesets, learning status, dashboard flows, `admin/`, `pc-web/`, or old Event-to-Operation files.

The branch is stacked on `codex/store-registration-cleanup` while PR #27 is open. After PR #27 merges, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-02-STORE-REGISTRATION-CLEANUP makes `사업자번호` optional in the Store Learning store-registration browser flow.

The change is intentionally narrow:

- `web/soho_store_register.html` no longer shows the required marker on `사업자번호`.
- The legacy inline fallback validation in `web/soho_store_register.html` no longer includes `f-biz` in its required field list.
- `web/soho_store_register.js` no longer blocks save when `f-biz` is empty.
- `businessNumber: readValue('f-biz')` remains in the save payload, so an entered business number is still persisted as optional metadata.
- `poc-server/test/storeRegistrationPage.test.ts` has a static browser contract test covering the optionality.

This milestone does not change server schemas, SQLite migrations, provider adapters, Naver/OpenAI behavior, `admin/`, `pc-web/`, or old Event-to-Operation files.

The branch is stacked on `codex/store-learning-data-map-audit` while the Milestone 01 PR is open. After Milestone 01 merges to `develop`, this work can be retargeted to `develop`.

## Previous Scope

MILESTONE-01-DATA-MAP establishes the sequential baseline for replacing Store Learning static mock values with persisted Place data, collected Blog data, and AI ruleset outputs.

This milestone is documentation-only. It adds:

- `docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`: the execution plan for the first milestone.
- `docs/product/STORE_LEARNING_DATA_MAP.md`: a screen-by-screen and field-by-field data source map.

The data map records recent product PR inputs from owner source routing, rendered Naver Place import, rendered Place visitor review collection, rendered/page Naver Blog body collection, and the later Place metadata/RAW/RAG hardening work. It classifies future population sources as `Place Immediate`, `Blog Parser`, `AI Processing`, and `Deferred`.

The main follow-up order is:

1. Store registration cleanup and `사업자번호` optionality.
2. Training settings contract confirmation.
3. Blog collection reliability and fallback behavior.
4. Blog RAW viewer and selectable item evidence improvements.
5. Analyzer/ruleset field-key expansion and source matrix implementation.
6. Ruleset UI replacement.
7. Learning status completion semantics and display replacement.
8. Blog management/content detail downstream cleanup.
9. Dashboard and state-variant/reference screen cleanup.

No runtime code, browser UI behavior, providers, `admin/`, `pc-web/`, or old Event-to-Operation files are changed by this milestone.

## Previous Scope

RAG-REVIEW-COLLECTION-002 fixes the RAG review DOCX path so the review document no longer silently stops at the first 10 Naver Place visitor reviews.

Root cause: RAG document generation requested `reviewLimit=100`, but the rendered Place review provider only got the first SSR/Apollo review batch. The Playwright layer can be blocked by Naver on the local IP, and the direct mobile HTML snapshot exposes only `size=10`. The resulting collection run had 10 collected reviews and 90 failed placeholders, so `reviews_<업체명>.docx` included only 10 reviews.

The provider now treats visitor review pages as interactive-rendering candidates, attempts Playwright scroll/more expansion, and adds a server-side GraphQL fallback using the SSR Apollo `visitorReviews` input. Naver currently returns body-bearing visitor reviews reliably up to `size=50`; the fallback combines default and `recent`/other variants, dedupes by review id/body/source, and includes as many collected review bodies as possible up to 100. If Naver still returns fewer than 100, the manifest warning states how many were actually included instead of presenting a quiet success.

For `store_1824807602` (`해화로in수산`), live local generation increased the review DOCX from 10 reviews to 80 body-bearing reviews. The generated warning is: `네이버플레이스 리뷰 100개 수집을 시도했지만 80개만 수집되어 해당 리뷰만 문서에 포함했습니다.`

The registration page now shows two progressive messages in the existing RAG status area: `네이버플레이스 리뷰를 가져오는 중입니다.` and then `RAG 문서를 생성하는 중입니다.` It also appends manifest warnings to the final status. Browser code still calls only `poc-server` APIs; Naver access remains server-side.

## Previous Scope

RAG-INFO-METADATA-002 improves the static `info_<업체명>.docx` builder so the RAG info document uses more of the already-imported Naver Place metadata.

Root cause: rendered Place imports stored scalar fields such as `openTime`, `closeTime`, `breakStart`, `breakEnd`, `placeImageUrls`, and `reviewStats.visitorTextReviewCount`, but `storeInfoRagBuilder` only read detailed `businessHours` arrays/text fallbacks and `reviewStats.textReviewCount`. When the detailed array was empty, the generated info document omitted the whole `영업시간` section even though SQLite had the data.

The builder now falls back to scalar operating hours and break time, includes parking availability labels, includes Place/menu photo counts and bounded usable image URL samples, filters known non-photo URL noise, maps `visitorTextReviewCount`, and keeps omitting empty values. The change uses stored SQLite metadata only; it does not re-call Naver, call OpenAI, change browser provider boundaries, modify `admin/`, modify `pc-web/`, or touch Event-to-Operation workflows.

## Previous Scope

RAG-DOCS-001 adds server-side RAG document generation for stores that have already imported Naver Place metadata and collected Place visitor reviews.

The new flow generates two local DOCX artifacts from persisted SQLite data only:

- `info_<업체명>.docx`: static store facts from `stores` and `stores.metadata_json.naverPlaceParsed`.
- `reviews_<업체명>.docx`: Place visitor reviews from `collection_items`, including owner replies when `metadata.ownerReplyText` exists.

No browser page calls Naver, OpenAI, SQLite, or document-generation libraries directly. The API and CLI reuse stored data and do not refresh Naver by default. Runtime output is written under `poc-server/data/rag-documents/<storeId>/`, which is ignored by git.

The internal runtime manifest keeps absolute file paths for server-side download handling, but API responses expose only `fileName` and `downloadPath`. Browser callers do not receive server filesystem paths.

Review selection follows the requested RAG rule: if collected reviews are 100 or fewer, include all; if more than 100, include the latest 20 and deterministically sample 80 older reviews using a seeded random interval strategy. Missing owner replies are represented as `사장님 답글 없음`.

`POST /api/stores/:storeId/rag-documents/generate` now supports `refreshReviews=true`. In mock mode it refreshes 100 deterministic Place reviews without external keys. In rendered mode it uses the existing server-side Naver Place provider boundary, persists a dedicated `collection_run_<storeId>_rag_<timestamp>` and its `collection_items`, then generates DOCX files from that run. If the provider is blocked or no reviews are collected, generation fails instead of creating a misleading empty review document.

## RAG-DOCS-001 Runtime Pieces

- `poc-server/src/storeLearning/rag/ragDocumentTypes.ts`
  - Zod schemas for static info documents, review documents, sections, and review entries.
- `poc-server/src/storeLearning/rag/storeInfoRagBuilder.ts`
  - Maps persisted store and Place parsed metadata into RAG-friendly sections.
  - Avoids stringifying nested metadata objects into `[object Object]` lines.
- `poc-server/src/storeLearning/rag/reviewSampler.ts`
  - Implements latest-20 plus sampled-80 deterministic review selection.
- `poc-server/src/storeLearning/rag/reviewRagBuilder.ts`
  - Converts collected Place review items into review entries with owner reply metadata.
- `poc-server/src/storeLearning/rag/docxWriter.ts`
  - Writes RAG document models to DOCX buffers.
- `poc-server/src/storeLearning/rag/ragDocumentService.ts`
  - Orchestrates repository reads, validation, DOCX writing, and manifest persistence.
- `poc-server/src/storeLearning/rag/ragReviewRefresh.ts`
  - Creates a RAG-specific collection run when `refreshReviews=true`.
  - Uses mock or rendered Place provider adapters server-side and persists refreshed review items with owner/source metadata.
- `poc-server/src/storeLearning/routes/ragDocuments.ts`
  - Adds:
    - `POST /api/stores/:storeId/rag-documents/generate`
    - `GET /api/stores/:storeId/rag-documents`
    - `GET /api/stores/:storeId/rag-documents/info/download`
    - `GET /api/stores/:storeId/rag-documents/reviews/download`
- `poc-server/src/exportStoreRagDocuments.ts`
  - Adds local CLI usage: `npm run rag:export -- --storeId=<storeId>`.
- `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
  - Supports additional rendered review batches through next-review links, so a RAG refresh can collect beyond the first rendered snapshot when the renderer exposes more batches.
- `poc-server/package.json`
  - Adds `docx` and `rag:export`.

## Previous Scope

PLACE-METADATA-UI-001 expands `soho_store_register.html` from a basic store-registration form into a store-registration plus saved Naver Place data review screen.

The browser still calls `poc-server` APIs only. The new UI does not re-call Naver, OpenAI, SQLite, or any external provider directly. It reuses the stored `GET /api/stores/:storeId` payload, especially `stores.metadata_json.naverPlaceParsed`, and renders the already-imported Place metadata for operator review.

The registration page now includes a `RAW data 보기` button at the bottom of the basic info block. It opens `store_raw_data.html?storeId=...&section=naverPlaceParsed`, a server-backed JSON viewer that fetches `/api/stores/:storeId`, shows Parsed data / Snapshot / Full metadata tabs, and provides a copy action. This replaces the need for browser-side SQLite or `jq` access.

The page also renders saved Place metadata in two sections below the basic information block: `네이버 플레이스 수집 정보` and `메뉴 정보`. The first section shows external channel links, facilities/services, booking URL, review stats, broadcast info, and keywords. The menu section shows menu count, up to four menu image thumbnails, five menu rows by default, and a `메뉴 전체보기` / `접기` toggle for longer menus. No UI redesign, provider call change, `admin/`, `pc-web/`, or old Event-to-Operation workflow change is included.

## PLACE-METADATA-UI-001 Runtime Pieces

- `web/soho_store_register.html`
  - Adds RAW data button, saved Place metadata section, and menu section hooks.
  - Adds compact row/chip/stat/menu styles consistent with the existing form.
- `web/soho_store_register.js`
  - Keeps `currentStore` state from the store API response.
  - Renders `metadata.naverPlaceParsed` into the new information sections.
  - Normalizes single or future multiple external links and handles empty metadata by hiding sections.
- `web/store_raw_data.html`
- `web/store_raw_data.js`
  - Adds a local API-backed JSON viewer for `naverPlaceParsed`, `naverPlaceSnapshot`, and full metadata.
- `poc-server/test/storeRegistrationPage.test.ts`
  - Covers RAW viewer wiring, server-only browser calls, metadata section hooks, menu hooks, and menu toggle contract.

## Previous Scope

PLACE-ENRICHMENT-001 enriches store registration from a saved Naver Place snapshot/parsed metadata.

The structure is now split into two layers. `POST /api/stores/import-place` is the only store-registration path that calls the Place provider. It stores a bounded source snapshot envelope in `stores.metadata_json.naverPlaceSnapshot`, including the Apollo `base` and `detail` source records, source hash, source sizes, and capture timestamp. It also stores normalized UI/learning fields in `stores.metadata_json.naverPlaceParsed`. `GET /api/stores/:storeId` reuses SQLite data and does not call Naver again; freshness checks and source diffing remain future work.

The registration page now fills additional fields from saved `naverPlaceParsed`: open/close time, break time, closed days, parking value, and parking note. It also keeps metadata-only fields for later screens: homepage/social URL, facilities, payment info, menu items, menu images, review stats, broadcast info, keywords, booking URL, and place image URLs. Imported checkbox/radio groups use the existing autofill visual treatment. No UI redesign, browser-side Naver call, OpenAI call, `admin/`, `pc-web/`, or old Event-to-Operation flow change is included.

## PLACE-ENRICHMENT-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Parses `newBusinessHours(...)`, `informationTab(...)`, `homepages`, `menus(...)`, `menuImages`, `broadcastInfos`, and `naverBooking(...)` from the saved Apollo source.
  - Persists `naverPlaceSnapshot`, `naverPlaceParsed`, and `naverPlaceImportedAt` in store metadata.
- `web/soho_store_register.js`
  - Uses `metadata.naverPlaceParsed` when populating imported fields.
  - Keeps business number and email manual-only.
- `web/soho_store_register.html`
  - Adds grouped autofill hooks for closed days and parking controls without redesigning the page.
- `poc-server/test/naverPlaceRenderedProvider.test.ts`
- `poc-server/test/storeRegistrationApi.test.ts`
- `poc-server/test/storeRegistrationPage.test.ts`
  - Cover enrichment parsing, saved snapshot metadata, no-refetch reads, form field mapping, and autofill group hooks.

## Previous Scope

PLACE-INTRO-001 fixes Naver Place store registration descriptions so the owner-written Place `정보 > 소개` text is preserved before the AI summary.

Root cause: the rendered Place import parser used `PlaceDetailBase.microReviews` as `store.description`. On current Naver mobile Place pages, that field is the short `AI 요약` text shown near the title. The owner-written introduction from the Place information tab is stored separately under the Apollo Place detail record, for example `placeDetail(...).description({"source":["shopWindow"]})`, so it was not being saved into the registration form.

The fix keeps all Naver access server-side. When a Place intro exists, `store.description` is now composed as the original intro text followed by `(AI요약정보) ...` on a separate paragraph. The raw values are also stored in metadata as `placeIntro`, `aiSummary`, and `descriptionSource` for later learning/LLM prompts. The local renderer path is also layered: renderer endpoint, direct mobile HTTP, then Playwright. A restriction/empty/error result from one layer now falls through to the next layer instead of ending the import immediately. No UI redesign, browser-side Naver call, OpenAI call, `admin/`, `pc-web/`, or old Event-to-Operation flow change is included.

## PLACE-INTRO-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Finds the Apollo `PlaceDetail` record linked to the imported `PlaceDetailBase`.
  - Extracts owner-written Place intro text from `description(...)` fields, with `shopWindow.description` as a secondary source.
  - Keeps `microReviews` as `aiSummary` instead of treating it as the only introduction.
  - Saves `placeIntro`, `aiSummary`, and `descriptionSource` into store metadata.
  - Adds `renderNaverPlacePageWithRenderers` so blocked/empty/error snapshots from one renderer layer can fall through to another renderer layer.
- `poc-server/test/naverPlaceRenderedProvider.test.ts`
  - Covers Apollo profile extraction, imported store description composition, metadata persistence, and renderer-layer fallback after a Naver restriction page.

## Place Data Currently Visible From Rendered Mobile Snapshots

- Basic identity: Place ID, name, category/category codes, address/road address, coordinates, phone/virtual phone, route/static map URLs.
- Description signals: owner-written intro from `description({"source":["shopWindow"]})`, short AI summary from `microReviews`, directions/road text.
- Review signals: rating, visitor review totals, text review total, blog review total, visitor review stats/review settings, visitor review media count.
- Operations: business hours/new business hours when present, missing-info flags, booking/order/tabling/smart-call tool availability.
- Store features: conveniences, parking/facilities/information-tab keywords, payment info, accessibility/accessor info, indoor/street panorama metadata.
- Content/media: owner/place images, menu images, menu records, UGC/CP images, related Blog/Cafe review references, TV/broadcast info, themes.

## Previous Scope

TRAINING-SOURCE-001 fixes Naver Blog collection from the AI training settings flow and adds small-count collection options.

Root cause: `web/03_AI학습_온보딩.html` showed a Naver Blog URL field, but `web/training_settings.js` did not include that URL in the `PUT /api/stores/:storeId/training-settings` payload. The server therefore never wrote `store_channels.blog.source_url` for newly imported stores. Rendered collection runs could still collect Place visitor reviews from `stores.naver_place_url`, but Blog items failed with `store_missing_naver_blog_url`.

The fix keeps browser pages calling only `poc-server` APIs. Training settings now persist channel source URLs for Blog, Place, Instagram, and Daangn into `store_channels`; rendered Blog collection then uses the saved Blog channel URL through the existing provider boundary. The training settings page also adds `최근 1개` and `최근 10개` options for Blog, Place reviews, Instagram, and Daangn. Daangn/Instagram external collection providers are still not implemented; their URLs and limits are stored for future provider work only.

## TRAINING-SOURCE-001 Runtime Pieces

- `poc-server/src/storeLearning/routes/stores.ts`
  - Extends training settings with `sourceUrl` plus `daangn.daangnPostLimit`.
  - Syncs saved training settings into `store_channels` by `(storeId, channel)` so existing seeded channel IDs are updated instead of causing SQLite unique conflicts.
  - Adds `daangnPostLimit` and `channelPlan.daangn` to collection run summaries.
- `web/03_AI학습_온보딩.html`
  - Adds `최근 1개` and `최근 10개` options to Blog, Place, Instagram, and Daangn collection controls.
  - Adds `training-daangn-url` and `training-daangn-limit` hooks.
- `web/training_settings.js`
  - Loads saved source URLs from store channels.
  - Sends source URLs and Daangn limit in the training settings payload.
- `poc-server/test/trainingSettingsApi.test.ts`
- `poc-server/test/trainingSettingsPage.test.ts`
- `poc-server/test/naverBlogRenderedCollectionProvider.test.ts`
  - Cover channel source persistence, small-count options, and rendered Blog collection using a Blog URL saved from training settings.

## Previous Scope

STORE-PLACE-SHORTURL-001 fixes Naver short Place URL import for store registration.

This change keeps the Store Learning browser rule intact: `web/soho_store_register.html` still calls only `poc-server` APIs, and all Naver fetching stays server-side. The rendered Place provider now resolves `naver.me` URLs that land on `m.map.naver.com/appLink.naver?...pinId=...` to `https://m.place.naver.com/place/{pinId}/home` before extracting profile data. The store registration page also shows button-level loading state for slower import/save actions and keeps imported Place categories visible even when the static industry list has no exact match. It does not redesign the page, add new product behavior beyond import display, call OpenAI, modify `admin/`, modify `pc-web/`, or touch the old Event-to-Operation flow.

## STORE-PLACE-SHORTURL-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Detects Naver map app-link snapshots returned from short URLs.
  - Extracts numeric Place IDs from `pinId`, `id`, `placeId`, `place_id`, or URL path segments.
  - Re-renders the mobile Place detail URL before parsing Apollo state, so store IDs and saved Place URLs use the real numeric Place ID instead of the short-code token.
- `web/soho_store_register.html`
  - Adds stable IDs to the Place import and registration buttons.
- `web/soho_store_register.js`
  - Adds button-scoped busy state using the existing global `.spinner` class.
  - Applies busy state to Place import and store save actions.
  - Adds an imported category fallback option such as `불러온 업종: 생선회` when the returned Naver category is not present in `industry_categories.json`.
- `poc-server/test/naverPlaceRenderedProvider.test.ts`
- `poc-server/test/storeRegistrationPage.test.ts`
  - Cover short URL resolution, loading button wiring, and unmatched imported category display.

## Previous Scope

LEARNING-CTA-001 clarifies the post-analysis path from AI Learning Status to the editable Marketing Ruleset.

This change keeps the existing `분석 실행 -> AI 학습 현황` navigation intact and adds two visible ruleset entry points on `web/06_AI학습_현황.html`: a completion alert with `룰셋 보러가기` and a clickable `룰셋 상태` KPI card. Both route to `07_마케팅전략룰셋.html?storeId=...` while preserving `analysisRunId` when present. It does not redesign the page, add new backend behavior, call external providers from the browser, modify `admin/`, modify `pc-web/`, or touch the old Event-to-Operation flow.

## Previous Scope

NAVER-LIVE-001 hardens live Naver source collection for the Store Learning & Blog Content Automation PoC.

This change replaces the default local Playwright path with server-side mobile HTML snapshots for Naver Place and Naver Blog when no explicit renderer endpoint is configured. It parses Naver Place profile and visitor review data from `window.__APOLLO_STATE__`, parses full Naver Blog mobile `PostView` bodies from the rendered HTML, and keeps all external calls behind `poc-server` providers. It does not implement Naver/OpenAI browser calls, Naver login automation, publishing automation, UI redesign, `admin/`, `pc-web/`, or old Event-to-Operation workflow changes.

## NAVER-LIVE-001 Runtime Pieces

- `poc-server/src/storeLearning/providers/naverPlaceRenderedProvider.ts`
  - Adds `renderNaverHttpSnapshot` as the default local renderer path before Playwright fallback.
  - Parses Place profile fields from mobile `window.__APOLLO_STATE__`: name, category, road address, phone, directions, convenience, review counts, rating, and image URLs.
  - Narrows restriction-page detection to visible page text so normal bundled script strings do not create false positives.
- `poc-server/src/storeLearning/collection/naverPlaceRenderedCollectionProvider.ts`
  - Parses visitor review items from Apollo state, including reviewer nickname, body, date, rating, voted keywords, media/video flags, and owner reply state.
  - Keeps collection item persistence and selection flow unchanged.
- `poc-server/src/storeLearning/collection/naverBlogRenderedCollectionProvider.ts`
  - Uses direct mobile HTTP snapshots for Blog pages when no renderer endpoint is configured.
  - Fixes nested `.se-main-container` extraction so full Blog bodies are collected instead of the first nested block only.
- `poc-server/test/naverBlogLiveIntegration.test.ts`
  - Defaults live Blog verification to `https://blog.naver.com/jasengblog/224253201649` when `NAVER_LIVE_BLOG_URL` is unset.
- `poc-server/test/naverPlaceRenderedProvider.test.ts`
- `poc-server/test/naverPlaceRenderedCollectionProvider.test.ts`
  - Add fixture-first coverage for Apollo state profile and visitor review parsing.

## NAVER-LIVE-001 Operating Notes

Default real source configuration:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
NAVER_BLOG_PROVIDER=rendered
```

The provider still supports external deterministic renderers:

```text
NAVER_PLACE_RENDERER_ENDPOINT=http://127.0.0.1:PORT/render-place
NAVER_BLOG_RENDERER_ENDPOINT=http://127.0.0.1:PORT/render-blog
```

Direct mobile snapshot fallback can be disabled for diagnostics:

```text
NAVER_DIRECT_FETCH=false
NAVER_PLACE_DIRECT_FETCH=false
NAVER_BLOG_DIRECT_FETCH=false
```

Publishing automation is not part of the product direction. Existing local publish-request state is not expanded by this work and should not become an automatic Naver publishing provider.

## Previous Scope

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

Continue with owner-authorized read-side hardening only: run a full local Store Learning flow with `NAVER_PLACE_PROVIDER=rendered` and `NAVER_BLOG_PROVIDER=rendered`, then decide whether to add an explicit owner export/import fallback for cases where Naver blocks public mobile snapshots.

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

## RAG Document UI Hook

The store registration page now exposes RAG document generation from the saved store context:

- `soho_store_register.html` shows `RAG 문서 생성` beside `RAW data 보기` in the Naver Place collected-info header.
- The browser calls only poc-server APIs:
  - `GET /api/stores/:storeId/rag-documents`
  - `POST /api/stores/:storeId/rag-documents/generate`
  - generated download links returned by the server manifest
- The generate action sends `refreshReviews: true` and `reviewLimit: 100`, so the server can refresh Place review data before creating `info_업체명.docx` and `reviews_업체명.docx`.
- Existing generated documents are detected when a saved store is loaded, and the two download links are shown without regenerating.

## Upload Source Asset UI

The store registration upload section is now labeled `자료 업로드`.

Inside that section, saved source data is surfaced before manual upload controls:

- `매장 사진`: shows up to four images from `metadata.naverPlaceParsed.placeImageUrls`.
- `메뉴판`: shows up to four images from `metadata.naverPlaceParsed.menuImageUrls`.
- `매장 소개 문서`: shows generated RAG DOCX links from `GET /api/stores/:storeId/rag-documents`.

The browser still calls only poc-server APIs. The source image panels reuse the existing image viewer hook, and generated document links use server-returned download paths instead of filesystem paths.

Place photo normalization now filters saved/imported image lists before display. The rendered Place provider prioritizes `PlaceDetail.images.images`, unwraps `search.pstatic.net/common?...src=` URLs to their original image source, de-duplicates by original URL, and excludes default profile icons, blog/cafe links, TV thumbnails, panorama thumbnails, and other non-store-photo assets. The browser applies the same normalization so previously saved metadata is corrected on display without requiring a re-import.

## Store Registration Business Hours Sync

`soho_store_register.html` now treats day-specific business hours as the durable detailed source.

- Rendered Naver Place imports save `metadata.naverPlaceParsed.weeklyBusinessHours`.
- The main operating-hours fields show a single shared time only when all open weekdays use the same open/close values.
- If at least one open weekday differs, the main operating-hours fields show `요일별 상이`.
- If break times differ by weekday, the break-time fields also show `요일별 상이`.
- The red `*요일별 운영시간 설정 필요` message appears when weekday values differ.
- Opening the modal loads the stored weekday rows.
- Saving the modal updates the main form summary and closed-day checkboxes.
- Editing the main form open/close/break fields or closed-day checkboxes updates the weekday rows unless the field is in `요일별 상이` summary mode.

Validation for this screen requires the local API runtime:

```bash
cd poc-server
npm run dev
```

Then open:

```text
http://localhost:5177/soho_store_register.html
```

Static GitHub Pages hosting alone cannot validate this PoC because the browser must call local `poc-server` APIs backed by SQLite.

## Branch Workflow Bootstrap

The repository is moving to a stable-public plus integration workflow:

- `main`: public/stable branch and GitHub Pages source.
- `develop`: integration branch for local API-backed validation.
- `feature/*` or `codex/*`: task branches created from `develop`.

Future task flow:

```text
feature/* -> develop -> main
```

Operating details are documented in `docs/codex/GIT_WORKFLOW.md`.

New Codex sessions should start by reading:

- `AGENTS.md`
- `poc-server/AGENTS.md`
- `docs/codex/GIT_WORKFLOW.md`
- `docs/codex/CURRENT_TASK.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`

Before editing files in a new session, confirm the current branch, `git status --short`, task scope, forbidden areas, and validation commands.

## Next Suggested Task

Before any production-like pilot, decide approved fallback providers and operating policies for:

- full Naver Blog body access
- Naver Place reviews
- image generation
- Naver Blog publishing
- provider failure/error UX in the existing static pages
