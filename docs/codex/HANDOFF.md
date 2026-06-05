# Codex Handoff

## Current Scope

LEARN-001 connects the AI learning status page for the Store Learning & Blog Content Automation PoC to persisted Store Learning data.

This change exposes shaped learning status APIs and wires `web/06_AI학습_현황.html` to those APIs with a small page-specific script. It displays Blog, Place, and Instagram tab data from SQLite-backed repositories. Instagram remains a not-connected/empty state. This does not generate analysis, edit rulesets, generate blog content, call Naver, call OpenAI, or redesign the page.

## Added Runtime Pieces

- `poc-server/src/storeLearning/learning/learningStatusService.ts`
  - Builds shaped learning status responses from repositories.
  - Combines latest analysis artifacts, learning snapshot, ruleset status, and collected item summaries.
  - Summarizes collection items without exposing raw `body_text`.
  - Produces Blog, Place, and Instagram tab payloads.
- `poc-server/src/storeLearning/routes/stores.ts` now also exposes:
  - `GET /api/stores/:storeId/learning-status`
  - `GET /api/stores/:storeId/learning-status/blog`
  - `GET /api/stores/:storeId/learning-status/place`
  - `GET /api/stores/:storeId/learning-status/instagram`
- `web/learning_status.js`
  - Loads learning status data from poc-server APIs only.
  - Populates last analyzed time, ruleset state, channel status badges, Blog rows, Place profile/reviews, and Instagram empty state.
- `web/06_AI학습_현황.html`
  - Keeps the existing visual structure.
  - Adds stable IDs for dynamic data insertion.
  - Loads `learning_status.js`.
- `poc-server/test/learningStatusApi.test.ts`
  - Covers shaped API responses for overall, Blog, Place, and Instagram status.
- `poc-server/test/learningStatusPage.test.ts`
  - Covers static page wiring and verifies browser code calls only poc-server learning APIs.

## Data Shape

The overall status response includes:

- `storeId`
- `storeName`
- `lastAnalyzedAt`
- latest `analysis`
- latest `snapshot`
- latest `ruleset`
- channel summaries for Blog, Place, and Instagram:
  - `status`
  - `collectedCount`
  - `selectedCount`

The tab responses include:

- Blog:
  - collected Blog item summaries
  - SEO keywords from latest learning snapshot or ruleset fallback
  - writing style from latest snapshot or ruleset fallback
- Place:
  - Place profile summary
  - Place review summaries
  - review keywords from latest snapshot, analysis result, or ruleset fallback
- Instagram:
  - `not_connected` state when no usable Instagram channel source is connected
  - empty item list and user-facing message

## Guardrails

- Browser pages call poc-server APIs only.
- No browser-side or server-side Naver/OpenAI calls were added.
- No real provider collection, LLM analysis, ruleset editing, or blog generation was added.
- Existing Event-to-Operation workflows were not modified.
- `admin/` and `pc-web/` were not modified.
- `web/06_AI학습_현황.html` was not redesigned; only IDs, loading placeholders, and a page script include were added.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

Open the learning status page:

```text
http://localhost:5177/06_AI학습_현황.html?storeId=store_demo_cake
```

Useful API checks:

```bash
curl http://localhost:5177/api/stores/store_demo_cake/learning-status
curl http://localhost:5177/api/stores/store_demo_cake/learning-status/blog
curl http://localhost:5177/api/stores/store_demo_cake/learning-status/place
curl http://localhost:5177/api/stores/store_demo_cake/learning-status/instagram
```

## Next Suggested Task

RULESET-001 can connect the marketing strategy ruleset page to `marketing_rulesets` and `ruleset_fields`, including editable fields, locked states, and evidence references. Keep blog generation and image generation as later tasks unless explicitly requested.
