# Codex Handoff

## Current Scope

STORE-001 connects the first Store Learning & Blog Content Automation PoC screen to the SQLite-backed store API.

This change wires `web/soho_store_register.html` to server APIs for Naver Place URL import, store save, store read, and store patch. It does not implement training settings, collection runs, analysis, rulesets, blog generation, or real Naver/OpenAI calls.

## Added Runtime Pieces

- `poc-server/src/storeLearning/routes/stores.ts` exposes:
  - `POST /api/stores/import-place`
  - `POST /api/stores`
  - `GET /api/stores/:storeId`
  - `PATCH /api/stores/:storeId`
- `poc-server/src/storeLearning/providers/mockPlaceProvider.ts` returns deterministic demo Place data in mock mode with no external keys.
- `poc-server/src/storeLearning/providers/naverPlaceUrlParser.ts` normalizes Naver Place URLs and extracts candidate IDs/metadata without network access.
- `poc-server/src/storeLearning/providers/naverLocalSearchProvider.ts` keeps an env-gated provider boundary but intentionally does not call Naver yet.
- `poc-server/src/index.ts` migrates the Store Learning SQLite DB and mounts the store routes.
- `web/soho_store_register.js` overrides the existing page actions so browser code calls only `/api/stores...`.
- `web/soho_store_register.html` only loads the new page-specific script; the existing layout was not redesigned.
- `poc-server/test/storeRegistrationApi.test.ts` covers import/save/read/patch API persistence.
- `poc-server/test/storeRegistrationPage.test.ts` covers static page wiring and guards against browser-side external API calls.

## Data Touchpoints

- Imported and manually saved store records persist through the DATA-001 `stores` repository.
- Naver Place channel state persists through the DATA-001 `store_channels` repository using channel `place`.
- Store form extras such as business number, email, hours, closed days, and parking remain in `stores.metadata`.
- The browser keeps only the last `storeId` in `localStorage` so refresh can reload via `GET /api/stores/:storeId`.

## Guardrails

- Browser pages must call poc-server APIs only.
- Keep Naver/OpenAI credentials server-side.
- Mock mode must work without external keys.
- Keep real Naver collection behind provider adapters.
- Keep existing Event-to-Operation workflows untouched.
- Do not modify `admin/` or `pc-web/`.
- Do not redesign existing HTML pages in this PR.
- Do not add training settings, collection, analysis, ruleset, or blog-generation behavior in STORE-001.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

The default port is `5177`. During validation on 2026-06-05, port `5177` was already occupied by a different local workspace, so the manual smoke test used:

```bash
PORT=5178 npm run dev
```

## Next Suggested Task

TRAIN-001 can connect the AI training settings screen to persisted settings and create the first collection run record. Keep provider collection and LLM analysis as later tasks unless explicitly requested.
