# Validation

## REAL-001 Commands

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
http://localhost:5178/soho_store_register.html
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run typecheck` verifies the Naver provider, parser, and route usage compile.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- storeRegistrationApi.test.ts`: failed because import still fell back to `naverPlaceUrlParser` instead of `naverLocalSearchProvider`.
- GREEN `npm test -- storeRegistrationApi.test.ts`: passed, 1 file / 3 tests.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files / 88 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed:

```text
GET /soho_store_register.html => 200
POST /api/stores/import-place with no external keys => provider mockPlaceProvider / providerMode mock
Browser title => 매장 정보 등록
Browser script hook => soho_store_register.js loaded
Browser console errors => []
```

## Manual Checks

Default mock mode:

- `POST /api/stores/import-place` should still work with no external keys.
- Provider should remain `mockPlaceProvider`.

Credentialed Naver Local Search mode:

- Set `STORE_LEARNING_MOCK_MODE=false`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET`.
- Use a Naver Place/Map URL with a searchable keyword.
- `POST /api/stores/import-place` should return provider `{ name: "naverLocalSearchProvider", mode: "real" }`.
- The saved `store_channels` row should use `provider_mode = real`.

## Boundaries

- Browser pages still call poc-server APIs only.
- Naver credentials stay server-side.
- Mock mode still works without external keys.
- Full Naver Place body data and Place reviews are not implemented in REAL-001.
- OpenAI analysis, blog generation, image generation, and Naver Blog publishing are unchanged.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
