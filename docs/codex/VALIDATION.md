# Validation

## REAL-002 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
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
http://localhost:5178/03_AI학습_온보딩.html?storeId=store_demo_cake
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run typecheck` verifies collection provider types, runner, routes, and tests compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- collectionProgressApi.test.ts`: failed because collection start still used the mock runner and did not include `naverSearchCollectionProvider` metadata.
- GREEN `npm test -- collectionProgressApi.test.ts`: passed, 1 file / 2 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files / 89 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
POST /api/stores/store_demo_cake/collection-runs => collectionRunId created
POST /api/collection-runs/:runId/start => mode mock / provider mockCollectionProvider / totalItems 101
GET /api/collection-runs/:runId => finalStatus completed / collected 101
GET /api/collection-runs/:runId/items => first item status collected / metadata provider mock
```

Observed browser smoke:

```text
URL => http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake
training_settings.js loaded => true
blogLimit => 50
placeReviewLimit => 50
placeUrl => https://naver.me/demo-cake
browser console errors => []
```

## Manual Checks

Default mock mode:

- `POST /api/collection-runs/:runId/start` should still work without external keys.
- Provider summary should be `mockCollectionProvider`.
- Blog, profile, and review mock items should move to `collected`.

Credentialed Naver metadata mode:

- Set `STORE_LEARNING_MOCK_MODE=false`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET`.
- Optional local override variables:
  - `NAVER_BLOG_SEARCH_ENDPOINT`
  - `NAVER_LOCAL_SEARCH_ENDPOINT`
- `POST /api/collection-runs/:runId/start` should return summary provider `{ name: "naverSearchCollectionProvider", mode: "real" }`.
- Blog items should be collected from official Blog Search metadata/snippets.
- Place profile should be collected from official Local Search metadata.
- Place review items should be marked `failed` with `reviewAvailability = requires_fallback_provider`.
- A mixed metadata/review-fallback run should finish as `partial_completed`.

## Boundaries

- Browser pages still call poc-server APIs only.
- Naver credentials stay server-side.
- Mock mode still works without external keys.
- Full Naver Blog body collection is not implemented in REAL-002.
- Naver Place review collection is not implemented in REAL-002.
- OpenAI analysis, blog generation, image generation, and Naver Blog publishing are unchanged.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
