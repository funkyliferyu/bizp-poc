# Validation

## STORE-001 Commands

Run from `poc-server/`:

```bash
npm test -- storeRegistrationApi.test.ts storeRegistrationPage.test.ts
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
```

Then open `http://127.0.0.1:5178/soho_store_register.html`.

## Expected Coverage

- `npm test -- storeRegistrationApi.test.ts storeRegistrationPage.test.ts` verifies the new store import/save/read/patch API and page-specific browser API wiring.
- `npm run typecheck` verifies the store API/provider modules compile with the existing server.
- `npm test` runs the existing Event-to-Operation tests plus Store Learning repository and registration tests.
- `npm run demo` verifies the existing Event-to-Operation demo still runs.
- `npm run demo:store-learning` migrates the local SQLite DB, seeds one demo store, and prints a summary.
- Manual smoke verifies Place import populates the form, save persists to SQLite, and refresh reloads the saved store.

## STORE-001 Results

- `npm test -- storeRegistrationApi.test.ts storeRegistrationPage.test.ts`: passed, 2 files / 4 tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 11 files / 55 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the seeded Store Learning summary.
- `npm run dev`: default port `5177` was occupied by `/Users/1004182/Documents/MKT-feasiobilitycheck/poc-server`, so the command could not bind to 5177 in this environment.
- `PORT=5178 npm run dev`: passed and served `soho_store_register.html`.
- Manual Playwright smoke against `http://127.0.0.1:5178/soho_store_register.html`: passed.

## Manual Smoke Evidence

- Page title: `매장 정보 등록`.
- Import URL used: `https://naver.me/demo-tteokbokki`.
- Observed API calls:
  - `POST /api/stores/import-place`
  - `PATCH /api/stores/store_demo_tteokbokki`
  - `GET /api/stores/store_demo_tteokbokki`
- Imported and reloaded fields included:
  - store name `맛있는 떡볶이 홍대점`
  - category `음식점 > 한식 > 분식`
  - address `서울 마포구 홍익로 5길 12`
  - phone `02-1234-5678`
  - business number `123-45-67890`
- Console errors/warnings: none.
- Browser plugin runtime was not exposed by available tools, so validation used bundled Playwright instead.

## STORE-001 Boundaries

- UI wiring is limited to `web/soho_store_register.html` and `web/soho_store_register.js`.
- No browser-side Naver/OpenAI calls are present.
- No real server-side Naver/OpenAI calls are present.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
- `.DS_Store` files should not appear in PR status.
