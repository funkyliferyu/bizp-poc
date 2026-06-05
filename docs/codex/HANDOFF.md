# Codex Handoff

## Current Scope

COLLECT-001 implements collection run progress for the Store Learning & Blog Content Automation PoC.

This change connects `web/04_AI학습_수집중.html` to backend polling APIs, starts a deterministic mock collection runner, and persists item-level collection state in SQLite. It does not implement real Naver collection, OpenAI/LLM calls, analysis, ruleset generation, or blog generation.

## Added Runtime Pieces

- `poc-server/src/storeLearning/routes/collectionRuns.ts` exposes:
  - `GET /api/collection-runs/:runId`
  - `GET /api/collection-runs/:runId/items`
  - `POST /api/collection-runs/:runId/start`
- `poc-server/src/storeLearning/collection/mockCollectionRunner.ts` starts queued runs, writes deterministic mock collection items, and advances item/run statuses.
- `poc-server/src/index.ts` mounts the collection-run routes under `/api/collection-runs`.
- `web/collection_progress.js` starts a collection run, polls run and item APIs, renders item progress, and enables the next action only after completion.
- `web/04_AI학습_수집중.html` only receives page-specific IDs, a small item list container, and the page script. The page was not redesigned.
- `poc-server/test/collectionProgressApi.test.ts` covers mock runner API behavior and persisted item counts/statuses.
- `poc-server/test/collectionProgressPage.test.ts` covers static page wiring and guards against browser-side external API calls.

## Data Touchpoints

- `collection_items.status` was added to the SQLite schema and migration path.
- Mock collection writes:
  - blog posts as `channel = blog`, `sourceType = post`
  - Place basic info as `channel = place`, `sourceType = profile`
  - Place reviews as `channel = place`, `sourceType = review`
- The mock runner respects queued run summary limits from TRAIN-001:
  - `summary.requestedLimits.blogPostLimit`
  - `summary.requestedLimits.placeReviewLimit`
  - `summary.channelPlan.naverBlog.enabled`
  - `summary.channelPlan.naverPlace.enabled`
- Runtime status values used in this PR:
  - collection runs: `queued`, `collecting`, `completed`, `failed`
  - collection items: `pending`, `collecting`, `collected`, `failed`
- `partial_completed` remains a planned collection-run status for later provider/fallback failure handling. The deterministic mock runner does not intentionally create partial failures.

## Guardrails

- Browser pages call poc-server APIs only.
- Mock mode works without external keys.
- No browser-side or server-side Naver/OpenAI calls were added.
- Real Naver collection remains out of scope and should stay behind provider adapters.
- Existing Event-to-Operation workflows were not changed beyond mounting the new Store Learning API route.
- `admin/` and `pc-web/` were not modified.
- Existing HTML pages were not redesigned.
- Analysis, rulesets, and blog generation remain out of scope for COLLECT-001.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

The default port is `5177`. During validation on 2026-06-05, port `5177` was already occupied by a different local workspace, so the manual smoke test used:

```bash
PORT=5178 npm run dev
```

Manual smoke entry point:

```text
http://127.0.0.1:5178/03_AI학습_온보딩.html?storeId=store_demo_cake
```

Expected flow:

1. Training settings page creates a queued run.
2. Browser navigates to `04_AI학습_수집중.html?runId=...&storeId=...`.
3. Progress page starts the mock runner and polls run/items.
4. Completed items appear in the list.
5. The next button enables after completion and navigates to `05_AI학습_콘텐츠선택.html?storeId=...&runId=...`.

## Next Suggested Task

SELECT-001 can connect `05_AI학습_콘텐츠선택.html` to the collected item APIs and persist user selections for analysis. Keep analysis, ruleset generation, and blog generation as later tasks unless explicitly requested.
