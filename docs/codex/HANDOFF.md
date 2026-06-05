# Codex Handoff

## Current Scope

TRAIN-001 connects the AI training settings screen to the SQLite-backed Store Learning flow and creates queued collection runs.

This change wires `web/03_AI학습_온보딩.html` to server APIs for loading/saving per-store training settings and creating a queued collection run. It does not implement actual Naver collection, collection item generation, analysis, ruleset generation, blog generation, or real Naver/OpenAI calls.

## Added Runtime Pieces

- `poc-server/src/storeLearning/routes/stores.ts` now exposes STORE-001 routes:
  - `POST /api/stores/import-place`
  - `POST /api/stores`
  - `GET /api/stores/:storeId`
  - `PATCH /api/stores/:storeId`
- `poc-server/src/storeLearning/routes/stores.ts` now also exposes TRAIN-001 routes:
  - `GET /api/stores/:storeId/training-settings`
  - `PUT /api/stores/:storeId/training-settings`
  - `POST /api/stores/:storeId/collection-runs`
- `web/training_settings.js` loads the current store settings, saves channel limits, creates a collection run, and navigates to `04_AI학습_수집중.html?runId=...&storeId=...`.
- `web/03_AI학습_온보딩.html` only receives IDs, small count controls, and the page-specific script; the existing page design was not redesigned.
- `poc-server/test/trainingSettingsApi.test.ts` covers training settings load/save and queued collection run persistence.
- `poc-server/test/trainingSettingsPage.test.ts` covers static page wiring and guards against browser-side external API calls.

## Data Touchpoints

- Training settings persist through the DATA-001 `training_settings` repository.
- Collection run creation persists through the DATA-001 `collection_runs` repository.
- Supported settings shape:
  - `channels.naverBlog.enabled`
  - `channels.naverBlog.blogPostLimit`
  - `channels.naverPlace.enabled`
  - `channels.naverPlace.placeReviewLimit`
  - `channels.instagram.enabled`
  - `channels.instagram.instagramPostLimit`
- Queued collection runs persist:
  - `storeId`
  - `status = queued`
  - `mode = mock`
  - `summary.requestedLimits`
  - `summary.channelPlan`
- No `collection_items` are generated in TRAIN-001.

## Guardrails

- Browser pages must call poc-server APIs only.
- Keep Naver/OpenAI credentials server-side.
- Mock mode must work without external keys.
- Keep real Naver collection behind provider adapters.
- Keep existing Event-to-Operation workflows untouched.
- Do not modify `admin/` or `pc-web/`.
- Do not redesign existing HTML pages in this PR.
- Do not add real Naver collection, analysis, ruleset, or blog-generation behavior in TRAIN-001.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

The default port is `5177`. During validation on 2026-06-05, port `5177` was already occupied by a different local workspace, so the manual smoke test used:

```bash
PORT=5178 npm run dev
```

## Branch/Base Note

At the start of TRAIN-001, PR #2 was merged into `codex/api-backed-poc-flow`, while PR #3 had been merged into `data/sqlite-store-learning-model` but not yet into `codex/api-backed-poc-flow`. The local TRAIN branch merged `origin/data/sqlite-store-learning-model` to include the STORE-001 prerequisite. For the cleanest final PR diff, make sure `codex/api-backed-poc-flow` also contains STORE-001 before merging TRAIN-001.

## Next Suggested Task

COLLECT-001 can connect `04_AI학습_수집중.html` to the queued collection run and add mock provider-driven progress/polling. Keep real provider collection and LLM analysis as later tasks unless explicitly requested.
