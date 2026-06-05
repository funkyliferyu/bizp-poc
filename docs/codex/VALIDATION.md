# Validation

## COLLECT-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm test -- collectionProgressApi.test.ts collectionProgressPage.test.ts
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
http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake
```

SQLite spot checks:

```bash
sqlite3 data/store-learning.sqlite "select id, status from collection_runs order by created_at desc limit 5;"
sqlite3 data/store-learning.sqlite "select source_type, status, count(*) from collection_items group by source_type, status;"
```

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema, including `collection_items.status`.
- `npm run db:seed` keeps the demo store seed path idempotent.
- `npm test -- collectionProgressApi.test.ts collectionProgressPage.test.ts` verifies collection run polling APIs, deterministic mock item persistence, limit handling, and page-specific wiring.
- `npm run typecheck` verifies the collection routes, mock runner, repository updates, and existing server compile.
- `npm test` runs the existing Event-to-Operation tests plus Store Learning repository, registration, training settings, and collection progress tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` verifies the Store Learning demo seed path still runs.
- Manual smoke verifies TRAIN-001 to COLLECT-001 navigation, polling, visible item completion, and completion-gated navigation to content selection.

## COLLECT-001 Results

- `npm test -- collectionProgressApi.test.ts collectionProgressPage.test.ts`: passed, 2 files / 3 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 15 files / 62 tests.
- Manual Playwright smoke against `http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake`: passed.
- `sqlite3` spot check for latest collection runs: latest run was `completed`.
- `sqlite3` item status grouping: mock collection items were persisted with `collected` status.
- The generated local SQLite file is under ignored `poc-server/data/`.

Final sequential validation after documentation updates:

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 15 files / 62 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.

## Manual Smoke Evidence

- Entry URL: `http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake`.
- Training settings submitted:
  - blog post limit `50`
  - Place review limit `50`
  - Instagram limit `0`
- Collection page URL contained:
  - `04_AI학습_수집중.html`
  - `runId=collection_run_store_demo_cake_...`
  - `storeId=store_demo_cake`
- Completion status text: `수집 완료 총 101개 수집됨`.
- Ready count text: `101개 수집됨`.
- Visible item rows showed collected Place review items.
- Completion button state: enabled.
- Next URL contained:
  - `05_AI학습_콘텐츠선택.html`
  - `storeId=store_demo_cake`
  - `runId=collection_run_store_demo_cake_...`
- Console errors/warnings: none.
- Screenshot: `/tmp/collect-001-smoke.png`.
- Browser plugin runtime was not exposed by available tools, so validation used bundled Playwright.

## SQLite Evidence

Latest run sample:

```text
collection_run_store_demo_cake_1780669319270|completed
collection_run_store_demo_cake_1780669293577|completed
collection_run_store_demo_cake_1780668581458|queued
collection_run_store_demo_cake_1780668554419|queued
collection_run_demo_store_learning|selection_ready
```

Item status grouping sample:

```text
post|collected|101
profile|collected|3
review|collected|101
```

## COLLECT-001 Boundaries

- UI wiring is limited to `web/04_AI학습_수집중.html` and `web/collection_progress.js`.
- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- Collection item generation uses deterministic mock provider data only.
- No analysis, ruleset generation, or blog generation is implemented.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
