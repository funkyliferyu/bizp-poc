# Validation

## MILESTONE-01-DATA-MAP Commands

Run from repo root:

```bash
test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md
test -f docs/product/STORE_LEARNING_DATA_MAP.md
rg -n "Place Immediate|Blog Parser|AI Processing|사업자번호|RAW data|룰셋" docs/codex/MILESTONE_01_DATA_MAP_PLAN.md docs/product/STORE_LEARNING_DATA_MAP.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
git diff --check
git status --short
```

## MILESTONE-01-DATA-MAP Final Validation

- Documentation-only milestone; full runtime test suite is not required.
- `test -f docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`: passed.
- `test -f docs/product/STORE_LEARNING_DATA_MAP.md`: passed.
- `rg -n "Place Immediate|Blog Parser|AI Processing|사업자번호|RAW data|룰셋" ...`: passed and found the expected source-tier, optional business-number, RAW data, and ruleset references.
- `git diff --check`: passed.
- `git status --short`: passed for milestone scope; expected milestone files appeared:
  - `docs/codex/MILESTONE_01_DATA_MAP_PLAN.md`
  - `docs/product/STORE_LEARNING_DATA_MAP.md`
  - `docs/codex/HANDOFF.md`
  - `docs/codex/VALIDATION.md`
- Existing unrelated `.DS_Store` local modification must remain unstaged and outside the milestone commit.

## RAG-REVIEW-COLLECTION-002 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts
npm test -- storeRegistrationPage.test.ts
npm test -- naverPlaceRenderedCollectionProvider.test.ts
npm run typecheck
npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts storeRegistrationPage.test.ts
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

Manual live RAG refresh check:

```bash
npx tsx -r dotenv/config -e "import { createDatabaseConnection } from './src/db/connection.js'; import { migrateDatabase } from './src/db/migrate.js'; import { generateRagDocuments } from './src/storeLearning/rag/ragDocumentService.js'; const connection = createDatabaseConnection(); try { migrateDatabase(connection); const manifest = await generateRagDocuments({ connection, env: process.env }, 'store_1824807602', { refreshReviews: true, reviewLimit: 100 }); console.log(JSON.stringify({ reviewCount: manifest.reviewCount, sourceCollectionRunId: manifest.sourceCollectionRunId, warnings: manifest.warnings }, null, 2)); } finally { connection.close(); }"
```

## RAG-REVIEW-COLLECTION-002 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because `shouldUseInteractiveNaverReviewRendering` did not exist.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after visitor review URLs were marked for interactive rendering and Playwright review pages gained scroll/more expansion attempts.
- RED `npm test -- storeRegistrationPage.test.ts`: failed because the registration page did not expose separate review collection and document generation progress messages.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed after adding `네이버플레이스 리뷰를 가져오는 중입니다.` / `RAG 문서를 생성하는 중입니다.` status messages and manifest warning display.
- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because a rendered snapshot with 10 reviews did not use GraphQL fallback and collected only 10 reviews.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: passed after adding a Naver Place visitor review GraphQL fallback that reuses the SSR Apollo input, requests `size<=50`, combines sort variants, and dedupes reviews.

## RAG-REVIEW-COLLECTION-002 Final Validation

- Root cause DB check: latest RAG refresh run for `store_1824807602` had `placeReviewLimit=100`, `placeReviews=10`, and 90 failed placeholders before the fix.
- Live Playwright root-cause check: Playwright review page rendering was restricted by Naver for the local IP, so direct mobile HTML fallback returned only the first SSR batch.
- Live GraphQL exploration: `size=50` returned 50 review bodies, while `size>=60` returned `visitorReviews=null`; combining default and `recent` variants increased accessible body-bearing review coverage.
- Manual live RAG refresh for `store_1824807602`: passed; regenerated `reviews_해화로in수산.docx` with `reviewCount=80` and warning `네이버플레이스 리뷰 100개 수집을 시도했지만 80개만 수집되어 해당 리뷰만 문서에 포함했습니다.`
- DOCX structural check confirmed `reviews_해화로in수산.docx` contains 80 `[리뷰 n]` headings and owner reply lines.
- `npm run typecheck`: passed.
- `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts storeRegistrationPage.test.ts`: passed, 3 files / 27 tests.
- `npm test`: passed, 34 files / 141 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 live files / 3 tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.

## RAG-INFO-METADATA-002 Commands

Run from `poc-server/`:

```bash
npm test -- ragDocumentBuilders.test.ts
npm run rag:export -- --storeId=store_1824807602
npm run typecheck
npm test
npm run demo:store-learning
npm run demo
```

## RAG-INFO-METADATA-002 TDD Evidence

- RED `npm test -- ragDocumentBuilders.test.ts`: failed because `storeInfoRagBuilder` ignored scalar Place metadata fields such as `openTime`, `closeTime`, `breakStart`, `breakEnd`, `placeImageUrls`, and `reviewStats.visitorTextReviewCount`, and would include noisy non-photo URLs if `placeImageUrls` contained old snapshots.
- GREEN `npm test -- ragDocumentBuilders.test.ts`: passed after adding scalar operating-hour fallbacks, break-time output, filtered Place photo summary output, and the correct text-review count field mapping.

## RAG-INFO-METADATA-002 Final Validation

- `npm test -- ragDocumentBuilders.test.ts`: passed, 1 file / 4 tests.
- `npm run rag:export -- --storeId=store_1824807602`: passed and regenerated `info_해화로in수산.docx` plus `reviews_해화로in수산.docx`.
- DOCX structural check confirmed the regenerated info document now includes `운영시간: 11:20 ~ 23:30`, `브레이크타임: 14:30 ~ 16:30`, `주차 가능 여부: 인근 유료 주차 가능`, `매장 사진 수: 100개`, menu image URLs, and `텍스트 리뷰 수: 1758`; `icon_default_profile` and `blog.naver.com` noise were absent.
- `npm run typecheck`: passed.
- `npm test`: passed, 34 files / 138 tests plus 3 skipped live files / 6 skipped tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.

## RAG-DOCS-001 Commands

Run from `poc-server/`:

```bash
npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts
npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts
npm test -- naverPlaceRenderedCollectionProvider.test.ts
npm run typecheck
npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts ragDocxWriter.test.ts ragDocumentApi.test.ts naverPlaceRenderedCollectionProvider.test.ts
npm test
npm audit --omit=dev --json
npm run db:migrate
npm run db:seed
npm run rag:export -- --storeId=store_demo_cake
npm run rag:export -- --storeId=store_1824807602
npm run demo:store-learning
npm run demo
```

DOCX visual QA from repo root:

```bash
/Users/1004182/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  /Users/1004182/.codex/plugins/cache/openai-primary-runtime/documents/26.601.10930/skills/documents/render_docx.py \
  poc-server/data/rag-documents/store_demo_cake/info_분당_케이크하우스.docx \
  --output_dir /tmp/rag-info-render

/Users/1004182/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  /Users/1004182/.codex/plugins/cache/openai-primary-runtime/documents/26.601.10930/skills/documents/render_docx.py \
  poc-server/data/rag-documents/store_demo_cake/reviews_분당_케이크하우스.docx \
  --output_dir /tmp/rag-reviews-render
```

## RAG-DOCS-001 TDD Evidence

- RED `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts`: failed because `reviewSampler`, `storeInfoRagBuilder`, and `reviewRagBuilder` did not exist.
- GREEN `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts`: passed after adding Zod document models, persisted Place metadata mapping, review sorting, owner reply mapping, deterministic review sampling, and nested-object-safe text extraction.
- RED `npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts`: failed because `docxWriter` and `ragDocuments` routes did not exist.
- GREEN `npm test -- ragDocxWriter.test.ts ragDocumentApi.test.ts`: passed after adding DOCX writer, document service, API routes, runtime manifest storage, and public API manifest shaping that hides server filesystem paths.
- RED `npm test -- ragDocumentApi.test.ts`: failed because `refreshReviews=true` was rejected instead of creating a RAG-specific review collection run.
- GREEN `npm test -- ragDocumentApi.test.ts`: passed after adding RAG review refresh that persists 100 mock Place reviews and generates DOCX files from that refreshed run.
- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because rendered Place review collection stopped after the first rendered snapshot.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: passed after adding next-review batch discovery and collection until the requested limit is reached.

## RAG-DOCS-001 Final Validation

- `npm run typecheck`: passed.
- `npm test -- ragReviewSampler.test.ts ragDocumentBuilders.test.ts ragDocxWriter.test.ts ragDocumentApi.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed, 5 files / 15 tests.
- `npm test`: passed, 34 files / 136 tests plus 3 skipped live files / 6 skipped tests.
- `npm audit --omit=dev --json`: passed, 0 production vulnerabilities.
- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run rag:export -- --storeId=store_demo_cake`: passed and generated:
  - `poc-server/data/rag-documents/store_demo_cake/info_분당_케이크하우스.docx`
  - `poc-server/data/rag-documents/store_demo_cake/reviews_분당_케이크하우스.docx`
  - `poc-server/data/rag-documents/store_demo_cake/manifest.json`
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- DOCX structural check: `unzip -p ... word/document.xml` confirmed info title text and review/owner-reply text are inside the generated DOCX files.
- `npm run rag:export -- --storeId=store_1824807602`: passed for `해화로in수산`; the generated `info_해화로in수산.docx` did not contain `[object Object]`.
- DOCX visual render QA: rendered the generated info and reviews DOCX files to PNG pages. Checked info page 1, reviews page 1, reviews page 7, and reviews page 14; no text overlap, clipping, or blank-page issue was observed.

## PLACE-METADATA-UI-001 Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts
npm test -- storeRegistrationPage.test.ts staticWebConnectivity.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-METADATA-UI-001 TDD Evidence

- RED `npm test -- storeRegistrationPage.test.ts`: failed because `store_raw_data.html` / `store_raw_data.js` did not exist, `soho_store_register.js` did not render saved Place metadata sections, and `soho_store_register.html` did not expose metadata/menu hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts staticWebConnectivity.test.ts`: passed after adding the RAW viewer, RAW button, saved Place metadata section, menu section, menu toggle hooks, and server-API-only browser wiring.

## PLACE-METADATA-UI-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 124 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- In-app Browser smoke on `http://localhost:5177/soho_store_register.html?qa=place-metadata`: saved Place metadata rendered without console errors; RAW data button opened `store_raw_data.html?storeId=store_1495790737&section=naverPlaceParsed`; RAW viewer displayed Parsed data / Snapshot / Full metadata tabs and formatted JSON.
- Playwright smoke on `http://localhost:5177/soho_store_register.html?qa=place-metadata-playwright` with `https://m.place.naver.com/place/1824807602/home`: imported `해화로in수산`, showed Instagram link, facilities, booking URL, review stats, broadcast info, keywords, menu count `55개`, 2 menu images, 5 menu rows by default, `메뉴 전체보기`, and after toggle 55 menu rows plus `접기`.
- Playwright RAW viewer smoke on `http://localhost:5177/store_raw_data.html?storeId=store_1824807602&section=naverPlaceParsed`: displayed `Store RAW data`, active `Parsed data`, no error state, and JSON containing saved Place data including booking metadata.

## PLACE-ENRICHMENT-001 Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-ENRICHMENT-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed after adding open/close time, break time, closed days, parking, homepage/social, menu, broadcast, keyword, booking, and parsed snapshot expectations.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding normalized Place enrichment parsing and `naverPlaceSnapshot` / `naverPlaceParsed` metadata.
- RED `npm test -- storeRegistrationPage.test.ts`: failed after adding expected `naverPlaceParsed` field mappings and autofill group hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed after wiring `soho_store_register.js` to saved parsed metadata and adding `data-autofill-group` hooks.
- GREEN `npm test -- storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed and covered no-refetch reads after import.

## PLACE-ENRICHMENT-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 121 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Contract covered by test: `POST /api/stores/import-place` called the fake rendered provider once, then `GET /api/stores/store_1838952735` returned the stored SQLite record without another provider call.
- Manual API smoke on the running local server: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1824807602/home` returned `store.name=해화로in수산`, phone `0507-1359-5863`, address `서울 광진구 광나루로 383 1,2층`, open/close `11:20~23:30`, break `14:30~16:30`, parking `near`, homepage `https://www.instagram.com/forebus_jubong`, menu/image metadata, review stats, broadcast info, keywords, booking URL, and saved `naverPlaceSnapshot` / `naverPlaceParsed` metadata.
- Manual browser smoke on `http://127.0.0.1:5177/soho_store_register.html`: entering `https://m.place.naver.com/place/1824807602/home` and clicking `불러오기` populated the existing form with name, category, phone, address, operating hours, break time, parking note, owner intro plus `(AI요약정보)`, and autofill visual states for imported fields.

## PLACE-INTRO-001 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## PLACE-INTRO-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because the parser treated `microReviews` as the store description and did not expose `placeIntro`, `aiSummary`, or `descriptionSource`.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after extracting Apollo `placeDetail(...).description(...)`, composing `소개 원문 + (AI요약정보) ...`, and persisting both raw values in metadata.
- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed after adding renderer-layer fallback coverage because `renderNaverPlacePageWithRenderers` did not exist yet.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding renderer-layer fallback for restricted/empty/error snapshots.

## PLACE-INTRO-001 Final Validation

- Live root-cause check for `https://m.place.naver.com/place/1495790737/home`: Naver returned `PlaceDetailBase.microReviews[0]=신선함과 두툼함이 살아있는 회의 정석`, while the owner-written intro was found at `ROOT_QUERY.placeDetail(...).description({"source":["shopWindow"]})`.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 118 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Direct provider smoke with `NAVER_OWNER_AUTHORIZED=true NAVER_PLACE_PROVIDER=rendered` and `https://m.place.naver.com/place/1495790737/home` returned:
  - `store.name=막내회집 본점`
  - `category=생선회`
  - `address=서울 중구 남대문시장2가길 2 2층`
  - `phone=02-755-5115`
  - `description=회전문점 막내횟집(본점)입니다...` followed by `(AI요약정보) 신선함과 두툼함이 살아있는 회의 정석`
  - metadata `descriptionSource=place_intro_with_ai_summary`, `visitorReviewCount=1173`, `blogReviewCount=746`
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1495790737/home` returned the same composed description and metadata through the store registration API.
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/place/1824807602/home` returned `store.name=해화로in수산`, `descriptionSource=place_intro_with_ai_summary`, `visitorReviewCount=1852`, and `blogReviewCount=430`.

## TRAINING-SOURCE-001 Commands

Run from `poc-server/`:

```bash
npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## TRAINING-SOURCE-001 TDD Evidence

- RED `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts`: failed because training settings did not preserve `sourceUrl`, did not create a `blog` store channel for newly imported stores, did not include Daangn settings in collection run summaries, and the onboarding page did not expose `최근 1개` / `최근 10개` options for all requested channels.
- GREEN `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed after syncing training source URLs into `store_channels`, adding Daangn settings persistence, and adding the requested small-count options.

## TRAINING-SOURCE-001 Final Validation

- Root cause confirmed in local DB: latest real collection run had `blog post failed=50` with metadata reason `store_missing_naver_blog_url`, while Place had collected visitor reviews.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 116 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Manual API smoke on `PORT=5177 npm run dev`:
  - Saved `https://blog.naver.com/jasengblog/224253201649` through `PUT /api/stores/store_1824807602/training-settings`.
  - `GET /api/stores/store_1824807602` returned `store_channels.blog.sourceUrl=https://blog.naver.com/jasengblog/224253201649`.
  - Started a collection run with `blogPostLimit=1` and `placeReviewLimit=1`.
  - Final run status `completed`; collected counts `blogPosts=1`, `placeProfiles=1`, `placeReviews=1`.
  - Blog item title `어깨 통증 생기면 의심해봐야 할 질환 4가지`, body length `2952`.
- Browser smoke on `http://localhost:5177/03_AI학습_온보딩.html?storeId=store_1824807602`:
  - Page identity: `AI 학습 설정`.
  - Not blank: existing training settings form rendered.
  - Framework overlay: none detected.
  - Console errors/warnings: none detected.
  - Blog, Place, Instagram, and Daangn controls showed `최근 1개` and `최근 10개`.
  - Saved Blog URL and Place URL were reloaded into the page.

## STORE-PLACE-SHORTURL-001 Commands

Run from `poc-server/`:

```bash
npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts
npm run typecheck
npm test
npm run naver:verify
npm run demo:store-learning
npm run demo
```

## STORE-PLACE-SHORTURL-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: failed because a `naver.me` URL that redirected to `m.map.naver.com/appLink.naver?...pinId=1824807602` was parsed as a non-Place shell instead of re-rendering the real Place detail URL, and the registration page did not expose button loading hooks.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed after resolving app-link IDs to mobile Place detail URLs, adding button-level loading state, and preserving imported categories that are not in the static industry list.

## STORE-PLACE-SHORTURL-001 Final Validation

- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 115 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- Manual API smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://naver.me/xUwCQUxv` returned `provider.name=naverPlaceRenderedProvider`, `store.id=store_1824807602`, `store.name=해화로in수산`, category `생선회`, address `서울 광진구 광나루로 383 1,2층`, phone `0507-1359-5863`, and saved Place URL `https://m.place.naver.com/place/1824807602/home`.
- Browser smoke on `http://localhost:5177/soho_store_register.html`:
  - Page identity: `매장 정보 등록`.
  - Not blank: existing registration form rendered.
  - Framework overlay: none detected.
  - Console errors/warnings: none detected.
  - Interaction proof: entering `https://naver.me/xUwCQUxv` and clicking `불러오기` set the button to disabled with `aria-busy=true`, displayed a `.spinner` and `불러오는 중`, then restored `불러오기`.
  - Final field state: Place URL `https://m.place.naver.com/place/1824807602/home`, 업종 `불러온 업종: 생선회`, 매장명 `해화로in수산`, 연락처 `0507-1359-5863`, 주소 `서울 광진구 광나루로 383 1,2층`.

## LEARNING-CTA-001 Commands

Run from `poc-server/`:

```bash
npm test -- learningStatusPage.test.ts
npm run typecheck
npm test
```

## LEARNING-CTA-001 TDD Evidence

- RED `npm test -- learningStatusPage.test.ts`: failed because `06_AI학습_현황.html` did not expose `learning-ruleset-alert`, `learning-ruleset-alert-link`, or `learning-ruleset-card`, and `learning_status.js` did not route to `07_마케팅전략룰셋.html`.
- GREEN `npm test -- learningStatusPage.test.ts`: passed after adding the ruleset completion alert, clickable ruleset status card, and page-specific navigation wiring.

## LEARNING-CTA-001 Browser Smoke

- URL: `http://localhost:5177/06_AI학습_현황.html?storeId=store_demo_cake&analysisRunId=analysis_run_demo_store_learning`
- Page identity: loaded `06_AI학습_현황.html`.
- Not blank: `AI 학습 현황` was present.
- Framework overlay: none detected.
- Console errors/warnings: none detected.
- Alert CTA: `룰셋 생성이 완료되었습니다.` displayed, with `룰셋 보러가기` targeting `07_마케팅전략룰셋.html?storeId=store_demo_cake&analysisRunId=analysis_run_demo_store_learning`.
- Interaction proof:
  - Clicking `룰셋 보러가기` navigated to `07_마케팅전략룰셋.html`.
  - Clicking the `룰셋 상태 ✓ 생성 완료` KPI card also navigated to `07_마케팅전략룰셋.html`.
- Screenshot capture note: Browser CDP `Page.captureScreenshot` timed out in this session, so visual proof used DOM state plus interaction navigation.

## NAVER-LIVE-001 Commands

Run from `poc-server/`:

```bash
npm run typecheck
npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts
npm run naver:verify
```

Before the fix, local live verification passed only by detecting Naver restriction/fallback states:

- Place profile: restriction-page handling verified, no successful live profile import.
- Place visitor reviews: restriction-page handling verified, no successful live review item collection.
- Blog body: `NAVER_LIVE_BLOG_URL` was unset, so live Blog body verification was skipped.

## NAVER-LIVE-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: failed after adding Apollo state and direct Blog body expectations because profile images and Blog body extraction did not yet support the live mobile HTML structure.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed after adding Apollo state parsing, visible-text restriction detection, and nested Blog body extraction.
- GREEN direct provider smoke:
  - `importNaverPlaceUrl("https://m.place.naver.com/restaurant/1838952735/home")` returned `해방식당`, `한식`, road address, phone, rating, and review counts through `naverPlaceRenderedProvider`.
  - `createNaverBlogRenderedCollectionProvider()` collected the supplied Blog URL body with title `어깨 통증 생기면 의심해봐야 할 질환 4가지` and a body length over 2,900 characters.

## NAVER-LIVE-001 Final Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test -- naverPlaceRenderedProvider.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed, 3 files / 12 tests.
- `npm run naver:verify`: passed, 2 files / 3 live tests.
  - Place live profile import succeeded through mobile HTML/Apollo state.
  - Place live visitor review collection succeeded through mobile HTML/Apollo state.
  - Blog live body collection used the supplied default URL and succeeded without requiring `NAVER_LIVE_BLOG_URL`.
- `npm test`: passed, 30 files / 113 tests plus 3 skipped live files / 6 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- Manual server smoke on `PORT=5177 npm run dev`: `POST /api/stores/import-place` with `https://m.place.naver.com/restaurant/1838952735/home` returned `provider.name=naverPlaceRenderedProvider`, `store.name=해방식당`, road address, phone, rating `4.69`, and visitor review count `1680`.

## NAVER-BLOG-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
npm audit --omit=dev --json
```

## NAVER-BLOG-001 TDD Evidence

- RED `npm test -- naverBlogRenderedCollectionProvider.test.ts`: failed because `naverBlogRenderedCollectionProvider` did not exist.
- GREEN `npm test -- naverBlogRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed after adding rendered Blog URL parsing, full-body collection, collection provider selection, and readiness updates.
- GREEN `npm run typecheck && npm test -- collectionProgressApi.test.ts naverPlaceRenderedCollectionProvider.test.ts naverBlogRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed, 4 files / 14 tests.
- GREEN `npm test -- naverBlogLiveIntegration.test.ts naverBlogRenderedCollectionProvider.test.ts`: passed with the live Blog test skipped by default.
- GREEN `npm run naver:verify`: passed. Place live checks verified Naver restriction handling; Blog live check reported that `NAVER_LIVE_BLOG_URL` was not configured.

## NAVER-BLOG-001 Expected Live Verification

- `npm run naver:verify` now runs both Place and Blog live verification files.
- Set `NAVER_LIVE_BLOG_URL` to an owner-authorized Naver Blog URL to perform live Blog body verification.
- If Naver returns a restriction page, the command should pass by verifying restriction handling.
- If Naver allows the rendered request, the command expects:
  - Blog collection provider `naverBlogRenderedCollectionProvider`.
  - Blog post drafts with `sourceType=post`.
  - Blog metadata including `providerMode=real`.
  - Non-empty body text for collectible posts.

## NAVER-BLOG-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 30 files / 111 tests plus 3 skipped live files / 6 skipped tests.
- `npm run naver:verify`: passed.
  - Place live checks verified current Naver restriction-page handling.
  - Blog live check reported that `NAVER_LIVE_BLOG_URL` was not configured.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm audit --omit=dev --json`: passed with 0 vulnerabilities.

## NAVER-REVIEW-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
npm audit --omit=dev --json
```

## NAVER-REVIEW-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because `naverPlaceRenderedCollectionProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed after adding rendered visitor review parsing, collection provider selection, and readiness updates.
- GREEN `npm test -- naverPlaceLiveIntegration.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed with live tests skipped by default.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test -- collectionProgressApi.test.ts providerReadinessApi.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed, 3 files / 10 tests.

## NAVER-REVIEW-001 Expected Live Verification

- `npm run naver:verify` is opt-in and may use Playwright.
- If Naver returns the current restriction page, the command should pass by verifying restriction handling.
- If Naver allows the rendered request, the command expects:
  - Place import provider `naverPlaceRenderedProvider`.
  - Visitor review collection provider `naverPlaceRenderedCollectionProvider`.
  - Review drafts with `sourceType=review`.
  - Review metadata including `providerMode=real`.

## NAVER-REVIEW-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 29 files / 107 tests plus 2 skipped live files / 5 skipped tests.
- `npm run naver:verify`: passed.
  - Current environment result:
    - Naver returned restriction pages for both rendered Place profile and rendered visitor review requests.
    - The provider detected the restrictions and did not save restricted HTML as successful data.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm audit --omit=dev --json`: passed with 0 vulnerabilities.

## NAVER-PLACE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
```

## NAVER-PLACE-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because `naverPlaceRenderedProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding the rendered profile parser/provider and API route coverage.
- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed for the Naver restriction-page case because partial metadata was being accepted as a successful import.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after restriction-page detection was added.
- GREEN `npm test -- providerReadinessApi.test.ts storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## NAVER-PLACE-001 Live Verification

- `npm run naver:verify`: passed.
- Current environment result:
  - Playwright reached the live Naver Place URL.
  - Naver returned a restriction page for the current IP/request pattern.
  - The provider detected the restriction and did not persist partial metadata as a successful import.

Expected command output includes:

```text
Naver Place live rendered request was restricted by Naver; restriction handling verified.
```

For a successful unrestricted live import, the same test expects:

```text
provider.name => naverPlaceRenderedProvider
store.name => non-empty and not parser fallback
store.address => non-empty
metadata.bodyAvailability => rendered_place_profile
metadata.sourceKind => place_profile
```

## NAVER-PLACE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 28 files / 104 tests plus 2 skipped live files / 4 skipped tests.
- `npm run naver:verify`: passed by verifying current Naver restriction-page handling.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

## OWNER-SOURCE-001 TDD Evidence

- RED `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: failed because:
  - explicit `NAVER_PLACE_PROVIDER=official_search` still returned `mockPlaceProvider`;
  - readiness did not expose `ownerSourcePolicy`;
  - collection run summaries did not include `sourcePolicy`.
- GREEN `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## OWNER-SOURCE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: first run failed in `trainingSettingsApi.test.ts` because the old assertion did not include the new `summary.sourcePolicy`.
- Minimal validation fix: updated that test to assert the default mock source policy.
- `npm test`: passed, 27 files / 100 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Manual Smoke Notes

No frontend behavior changed in this step.

Expected readiness shape for future rendered/page adapters:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
NAVER_BLOG_PROVIDER=page

ownerSourcePolicy.ownerAuthorized => true
ownerSourcePolicy.placeProvider => rendered
ownerSourcePolicy.blogProvider => page
providers.placeImport.selectedProvider => naverPlaceRenderedProvider
providers.placeImport.status => ready
providers.collection.status => fallback_required
```

Expected collection item metadata after a mock owner-authorized run:

```text
metadata.ownerAuthorized => true
metadata.sourceKind => owner_blog_post | place_profile | place_visitor_review
metadata.sourceOwnership => owner_managed | user_generated
metadata.configuredPlaceProvider/configuredBlogProvider => selected env provider
metadata.bodyAvailability => mock_body | provider_body | metadata_only | unavailable
```

## OPS-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run openai:verify
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
curl http://localhost:5178/api/store-learning/provider-readiness
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run openai:verify` performs opt-in live OpenAI verification when `poc-server/.env` has `OPENAI_API_KEY`.
- `npm run typecheck` verifies readiness types and route mounting.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- providerReadinessApi.test.ts`: failed because the readiness service and route did not exist.
- GREEN `npm test -- providerReadinessApi.test.ts`: passed, 1 file / 3 tests.
- GREEN `npm run typecheck`: passed.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run openai:verify`: passed, 1 file / 3 live OpenAI tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 27 files / 97 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OpenAI Live Integration Validation

- `npm test -- openaiLiveIntegration.test.ts` without live flag: passed with 3 skipped tests.
- `npm run openai:verify`: passed in about 30 seconds.
- Runtime probe: passed with `OpenAI model access verified`.
- Analysis provider: completed and persisted validated artifacts.
- Blog provider: generated an approval-pending post through `openAIBlogProvider`.
- SEO provider: rescored the generated post and returned the expected itemized rubric keys.
- Secrets were not printed.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
GET /api/store-learning/provider-readiness
  productFlow => Store Learning & Blog Content Automation PoC
  mode => mock
  openaiConfigured => false
  naverSearchConfigured => false
  placeImport => mockPlaceProvider
  collection => mockCollectionProvider
  analysis => mockDeterministicAnalyzer
  blogGeneration => mock_ruleset_blog_generator
  imageGenerationStatus => placeholder_only
  publishingStatus => local_status_only
  fallbackCapabilities => full_blog_body, place_reviews, full_place_body
```

Observed API smoke with local OpenAI key configured:

```text
GET /api/store-learning/provider-readiness
  mode => real_configured
  openaiConfigured => true
  naverSearchConfigured => false
  analysisProvider => openAIAnalysisProvider
  analysisStatus => ready
  blogProvider => openAIBlogProvider
  blogStatus => ready
  collectionProvider => mockCollectionProvider
  collectionStatus => mock_ready
  imageStatus => placeholder_only
  publishingStatus => local_status_only
```

## Manual Smoke Checklist

Default mock mode:

- `GET /api/store-learning/provider-readiness` should work without external keys.
- Response should include `productFlow = Store Learning & Blog Content Automation PoC`.
- Response should include `mode = mock`.
- Response should not include secret values.
- Provider entries should show mock/placeholder/local status only.

Credentialed readiness mode:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- Set `STORE_LEARNING_MOCK_MODE=false`.
- `GET /api/store-learning/provider-readiness` should report:
  - `naverLocalSearchProvider` ready for Place import.
  - `naverSearchCollectionProvider` partial_ready for official search collection.
  - `openAIAnalysisProvider` ready for analysis.
  - `openAIBlogProvider` ready for blog generation.
  - fallback_required for full blog body and Place reviews.

## Boundaries

- Browser pages still call poc-server APIs only.
- OpenAI/Naver credentials stay server-side.
- Mock mode still works without external keys.
- Readiness does not perform live provider calls.
- Image generation remains placeholder-only.
- Naver Blog publishing remains local status transition only.
- Naver full body/review limitations are explicitly surfaced.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.

## RAG Document UI Hook Validation

TDD evidence:

- RED `npm test -- storeRegistrationPage.test.ts`: failed because `soho_store_register.html` did not expose `rag-generate-button`, `rag-doc-status`, or RAG download links, and page JS did not call the RAG document APIs.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed, 1 file / 10 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 136 tests, with 3 live integration files / 6 tests skipped by default.
- GREEN `npm run rag:export -- --storeId=store_demo_cake`: passed and generated info/reviews DOCX manifest.
- GREEN local server curl at `http://localhost:5177/soho_store_register.html`: page includes `rag-generate-button`, `rag-doc-status`, `rag-info-download`, and `rag-reviews-download`.
- GREEN local server curl at `GET /api/stores/store_demo_cake/rag-documents`: returned manifest download paths for info and reviews DOCX files.

Expected manual smoke:

- Open `http://localhost:5177/soho_store_register.html`.
- Load or import a Naver Place-backed store.
- In `네이버 플레이스 수집 정보`, click `RAG 문서 생성`.
- Confirm the button shows a loading state while the request is running.
- Confirm the status changes to generated and both DOCX download links appear.

## Upload Source Asset UI Validation

TDD evidence:

- RED `npm test -- storeRegistrationPage.test.ts`: failed because the upload section still contained `기존 자료 업로드` and did not expose Place image/RAG document upload-section hooks.
- GREEN `npm test -- storeRegistrationPage.test.ts`: passed, 1 file / 11 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 137 tests, with 3 live integration files / 6 tests skipped by default.

Manual browser smoke at `http://localhost:5177/soho_store_register.html?qa=upload-assets-smoke`:

- Store loaded: `막내회집 본점`.
- Upload section title displayed: `자료 업로드`.
- Old title `기존 자료 업로드` was not visible.
- Place photo source panel displayed 4 images.
- Place menu image source panel displayed 4 images.
- RAG generated document links displayed:
  - `/api/stores/store_1495790737/rag-documents/info/download`
  - `/api/stores/store_1495790737/rag-documents/reviews/download`
- Browser automation could not complete a physical thumbnail click because the in-app browser action timed out on the offscreen thumbnail selector. Static tests cover the image viewer hook, and the rendered thumbnail/button count was verified.

## Place Photo Normalization Validation

Root cause:

- Saved `metadata.naverPlaceParsed.placeImageUrls` included non-store-photo URLs because the rendered Place provider collected image-like fields across the whole Apollo state.
- The stored list could include `icon_default_profile.png`, wrapped `search.pstatic.net/common?...src=...` duplicates, blog/cafe links, TV thumbnails, and panorama thumbnails.
- The upload source panel showed the first four URLs directly, so a default profile image appeared as an 업체 제공 사진.

Fix validation:

- RED `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: failed because the provider still returned default/profile/noise images and the page had no `normalizePlaceImageUrls` filtering.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts storeRegistrationPage.test.ts`: passed, 2 files / 19 tests.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 137 tests, with 3 live integration files / 6 tests skipped by default.
- Browser smoke on `막내회집 본점`: `#place-photo-source-images img` returned 4 unique `ldb-phinf.pstatic.net` URLs and `hasDefaultProfile = false`.

## Store Registration Business Hours Validation

Runtime note:

- This PoC is not validly testable from static GitHub Pages alone.
- `soho_store_register.html` depends on `poc-server` APIs and local SQLite state.
- Use `cd poc-server && npm run dev`, then open `http://localhost:5177/soho_store_register.html`.

Root cause:

- The main registration form and the day-specific business-hours modal could drift.
- Main-form changes did not always update `weeklyBusinessHours`.
- Day-specific differences could be hidden by showing a single representative open/close time.

Fix validation:

- RED `npm test -- storeRegistrationPage.test.ts -t "keeps main business hour"`: failed because the page had no business-hours sync warning or sync helpers.
- GREEN `npm test -- storeRegistrationPage.test.ts -t "keeps main business hour"`: passed.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test`: passed, 34 files / 145 tests, with 3 live integration files / 6 tests skipped by default.
- GREEN `npm run demo:store-learning`: passed.
- GREEN `npm run demo`: passed.

Manual browser smoke at `http://localhost:5177/soho_store_register.html?qa=business-hours-sync`:

- Store loaded: `남대문명동정형외과의원`.
- Imported weekly business-hours metadata included 7 weekday rows.
- Because weekday hours differ, the main operating-hours and break-time fields showed `요일별 상이`.
- The red `*요일별 운영시간 설정 필요` message was visible.
- After setting every weekday to the same hours in the modal and saving, the main form showed the single shared hours and the warning disappeared.
- After editing the main form hours, reopening the modal showed the edited hours applied to every open weekday row.

## Branch Workflow Bootstrap Validation

Purpose:

- Establish `main` as the public/stable branch.
- Establish `develop` as the integration branch.
- Document that GitHub Pages is static UI only and cannot validate the API-backed SQLite runtime.

Expected checks:

- `git diff --check`
- `cd poc-server && npm run typecheck`
- `cd poc-server && npm test`

Manual verification:

- Confirm `docs/codex/GIT_WORKFLOW.md` exists.
- Confirm `docs/codex/CURRENT_TASK.md` exists.
- Confirm `AGENTS.md` points future feature work to `develop`.
- Confirm GitHub Pages source is `main` after branch setup.
