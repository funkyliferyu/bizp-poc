# Codex Handoff

## Current Scope

SELECT-001 implements collected content selection for analysis in the Store Learning & Blog Content Automation PoC.

This change connects `web/05_AI학습_콘텐츠선택.html` to collected `collection_items`, lets the user select or unselect items, persists selection state, and creates an `analysis_runs` record in `queued` state. It does not run analysis, call OpenAI, create learning snapshots, generate rulesets, or generate blog content.

## Added Runtime Pieces

- `poc-server/src/storeLearning/routes/collectionRuns.ts` now also exposes:
  - `GET /api/collection-runs/:runId/selectable-items`
- `poc-server/src/storeLearning/routes/collectionItems.ts` exposes:
  - `PATCH /api/collection-items/:itemId/selection`
- `poc-server/src/storeLearning/routes/analysisRuns.ts` exposes:
  - `POST /api/analysis-runs`
- `poc-server/src/index.ts` mounts the new Store Learning selection and analysis-run routes:
  - `/api/collection-items`
  - `/api/analysis-runs`
- `web/content_selection.js` loads collected items, renders blog/place groups, persists toggle changes, submits selected item IDs, and navigates to `06_AI학습_현황.html?storeId=...&analysisRunId=...`.
- `web/05_AI학습_콘텐츠선택.html` only receives page-specific IDs, dynamic list containers, and the page script. The page was not redesigned.
- `poc-server/test/selectionApi.test.ts` covers selectable items, default selection hints, selection persistence, and queued analysis-run creation.
- `poc-server/test/selectionPage.test.ts` covers static page wiring and guards against browser-side external API calls.

## Data Touchpoints

- Selection state is stored on existing `collection_items` fields:
  - `selected_for_analysis`
  - `selection_reason`
  - `selected_at`
- `GET /api/collection-runs/:runId/selectable-items` returns only collected items.
- Place profile/basic-info items are included by default unless explicitly deselected later.
- Items with quality metadata such as `aiSuspected` or `lowQuality` are selectable, but default to unselected when no explicit selection exists.
- `POST /api/analysis-runs`:
  - accepts `storeId`, `collectionRunId`, and `selectedItemIds`
  - ensures selected IDs belong to collected items for the run/store
  - persists selection flags across collected items for that run
  - creates an `analysis_runs` row with `status = queued`
  - stores a lightweight selected item snapshot in `analysis_runs.result`
- No `analysis_evidence`, `learning_snapshots`, or `marketing_rulesets` rows are generated in SELECT-001.

## Guardrails

- Browser pages call poc-server APIs only.
- Mock mode works without external keys.
- No browser-side or server-side Naver/OpenAI calls were added.
- Real Naver collection remains behind the existing provider boundary from earlier tasks.
- Existing Event-to-Operation workflows were not changed beyond mounting new Store Learning API routes.
- `admin/` and `pc-web/` were not modified.
- Existing HTML pages were not redesigned.
- Actual analysis, learning snapshots, rulesets, and blog generation remain out of scope for SELECT-001.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

The default port is `5177`. During validation on 2026-06-06, port `5177` was already occupied by a different local workspace, so the manual smoke test used:

```bash
PORT=5178 npm run dev
```

Manual smoke entry point:

```text
http://127.0.0.1:5178/05_AI학습_콘텐츠선택.html?storeId=store_demo_cake&runId=collection_run_demo_store_learning
```

Expected flow:

1. Content selection page loads collected items from the selected collection run.
2. Blog and Place groups render with current/default selection state.
3. Toggling an item updates `collection_items.selected_for_analysis`.
4. Analysis execution creates a queued `analysis_runs` row.
5. Browser navigates to `06_AI학습_현황.html?storeId=...&analysisRunId=...`.

## Next Suggested Task

ANALYZE-001 can process the queued analysis run, create analysis evidence and a learning snapshot, and prepare the first marketing ruleset draft. Keep real LLM calls behind structured Zod schemas and provider/mock boundaries unless explicitly requested.
