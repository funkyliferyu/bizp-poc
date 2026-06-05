# Validation

## SELECT-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm test -- selectionApi.test.ts selectionPage.test.ts
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
```

Then open:

```text
http://127.0.0.1:5178/05_AI학습_콘텐츠선택.html?storeId=store_demo_cake&runId=collection_run_demo_store_learning
```

SQLite spot checks:

```bash
sqlite3 data/store-learning.sqlite "select id, status from analysis_runs order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select id, selected_for_analysis from collection_items limit 10;"
```

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema.
- `npm run db:seed` keeps the demo store seed path idempotent.
- `npm test -- selectionApi.test.ts selectionPage.test.ts` verifies selectable item APIs, selection persistence, queued analysis-run creation, and page-specific API wiring.
- `npm run typecheck` verifies the selection routes, analysis-run route, and page route mounts compile with the existing server.
- `npm test` runs the existing Event-to-Operation tests plus Store Learning repository, registration, training, collection, and selection tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- Manual smoke verifies content item rendering, item toggle persistence, selected count updates, queued analysis run creation, and navigation to the learning status page.

## TDD Evidence

- Baseline `npm test`: passed before SELECT-001 edits, 15 files / 62 tests.
- RED `npm test -- selectionApi.test.ts selectionPage.test.ts`: failed because selection route modules, content selection JS, and page IDs did not exist.
- GREEN `npm test -- selectionApi.test.ts selectionPage.test.ts`: passed, 2 files / 4 tests.
- `npm run typecheck`: passed after implementation.

## Manual Smoke Evidence

- Browser plugin path was attempted first, but the in-app Browser runtime did not expose callable documentation/session/tab APIs in this session. Fallback validation used bundled Playwright.
- Entry URL: `http://127.0.0.1:5178/05_AI학습_콘텐츠선택.html?storeId=store_demo_cake&runId=collection_run_demo_store_learning`.
- Initial rendered state:
  - page title `수집 완료 — 분석할 콘텐츠 선택`
  - selected count `3개 선택됨`
  - blog rows `1`
  - place rows `2`
  - analysis button enabled
- Interaction:
  - toggled the first blog item off
  - selected count changed to `2개 선택됨`
  - first blog item `aria-pressed=false`
  - analysis button remained enabled
- Result URL:
  - `06_AI학습_현황.html`
  - `storeId=store_demo_cake`
  - `analysisRunId=analysis_run_store_demo_cake_...`
- Console errors/warnings: none.
- Screenshot: `/tmp/select-001-smoke.png`.

## SQLite Evidence

Latest analysis runs sample:

```text
analysis_run_store_demo_cake_1780672202266|queued
analysis_run_demo_store_learning|succeeded
```

Selection flag sample:

```text
collection_item_demo_blog|0
collection_item_demo_place_profile|1
collection_item_demo_place_review|1
```

Latest analysis run snapshot sample:

```text
analysis_run_store_demo_cake_1780672202266|{"selectedItemIds":["collection_item_demo_place_profile","collection_item_demo_place_review"],"selectedCounts":{"blogPosts":0,"placeProfiles":1,"placeReviews":1,"total":2}}
```

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 17 files / 66 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.

## SELECT-001 Boundaries

- UI wiring is limited to `web/05_AI학습_콘텐츠선택.html` and `web/content_selection.js`.
- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- Analysis run creation stops at `status = queued`.
- No LLM analysis, learning snapshot generation, ruleset generation, or blog generation is implemented.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
