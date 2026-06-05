# Validation

## TRAIN-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
```

Then open `http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake`.

## Expected Coverage

- `npm run db:migrate` applies the Store Learning SQLite schema.
- `npm run db:seed` seeds the Store Learning demo store.
- `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts` verifies training settings load/save, collection run creation, and page-specific browser API wiring.
- `npm run typecheck` verifies the store API, training settings, and collection run modules compile with the existing server.
- `npm test` runs the existing Event-to-Operation tests plus Store Learning repository, registration, and training settings tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` migrates the local SQLite DB, seeds one demo store, and prints a summary.
- Manual smoke verifies training settings load, counts can change, settings save, collection run creation, and navigation to the collection progress page.

## TRAIN-001 Results

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed when run sequentially after migration.
- `npm test -- trainingSettingsApi.test.ts trainingSettingsPage.test.ts`: passed, 2 files / 4 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 13 files / 59 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.
- `PORT=5178 npm run dev`: passed and served `03_AI학습_온보딩.html`.
- Manual Playwright smoke against `http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake`: passed.
- Note: a first parallel `db:migrate` + `db:seed` attempt caused a SQLite `database is locked` error. The requested validation is sequential, and the sequential `db:seed` run passed.

## Manual Smoke Evidence

- Page title: `AI 학습 설정`.
- Store ID: `store_demo_cake`.
- Loaded fields included:
  - blog limit `100`
  - place review limit `100`
  - instagram limit `30`
  - place URL `https://naver.me/demo-cake`
- Save dialog: `AI 학습 설정을 저장했습니다.`
- Observed API calls:
  - `GET /api/stores/store_demo_cake`
  - `GET /api/stores/store_demo_cake/training-settings`
  - `PUT /api/stores/store_demo_cake/training-settings`
  - `POST /api/stores/store_demo_cake/collection-runs`
- Final URL contained:
  - `04_AI학습_수집중.html`
  - `runId=collection_run_store_demo_cake_...`
  - `storeId=store_demo_cake`
- Console errors/warnings: none.
- Browser plugin runtime was not exposed by available tools, so validation used bundled Playwright instead.

## TRAIN-001 Boundaries

- UI wiring is limited to `web/03_AI학습_온보딩.html` and `web/training_settings.js`.
- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- No collection items are generated.
- No analysis, ruleset generation, or blog generation is implemented.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
- `.DS_Store` files should not appear in PR status.
