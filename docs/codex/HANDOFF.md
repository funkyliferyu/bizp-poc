# Codex Handoff

## Current Scope

RULESET-001 connects the marketing strategy ruleset page for the Store Learning & Blog Content Automation PoC to persisted Store Learning ruleset data.

This change exposes marketing ruleset APIs, wires `web/07_마케팅전략룰셋.html` to those APIs with a page-specific script, supports field-level editing/reset, and shows collection item evidence for a ruleset field. It does not regenerate the ruleset, generate blog content, call Naver, call OpenAI, or redesign the page.

## Added Runtime Pieces

- `poc-server/src/storeLearning/rulesets/rulesetService.ts`
  - Finds the latest marketing ruleset for a store.
  - Shapes ruleset, analysis, learning snapshot, and field payloads for browser use.
  - Updates edited fields with `userValue`, `finalValue`, `source = user_edited`, and `locked = true`.
  - Resets fields to `aiValue` with `source = ai_generated` and `locked = false`.
  - Returns linked collection item evidence with short excerpts.
- `poc-server/src/storeLearning/routes/stores.ts` now also exposes:
  - `GET /api/stores/:storeId/ruleset`
  - `PATCH /api/stores/:storeId/ruleset/fields/:fieldKey`
  - `POST /api/stores/:storeId/ruleset/fields/:fieldKey/reset`
  - `GET /api/stores/:storeId/ruleset/fields/:fieldKey/evidence`
- `web/ruleset_editor.js`
  - Loads the latest ruleset from poc-server APIs only.
  - Populates mapped fields on `07_마케팅전략룰셋.html`.
  - Enables contenteditable field edits with per-field save/reset/evidence actions.
  - Uses the existing evidence modal for linked collection item evidence.
- `web/07_마케팅전략룰셋.html`
  - Preserves the existing visual structure.
  - Adds `id="ruleset-status"`, `data-store-field`, `data-ruleset-field`, and `data-ruleset-value` hooks.
  - Loads `ruleset_editor.js`.
- `poc-server/test/rulesetApi.test.ts`
  - Covers latest ruleset lookup, edit persistence, reset behavior, and evidence lookup.
- `poc-server/test/rulesetPage.test.ts`
  - Covers static page wiring and verifies browser code calls only poc-server ruleset APIs.

## API Behavior

`GET /api/stores/:storeId/ruleset` returns:

- store summary
- latest ruleset summary
- latest learning snapshot summary
- latest analysis summary
- editable ruleset fields:
  - `fieldKey`
  - `aiValue`
  - `userValue`
  - `finalValue`
  - `source`
  - `locked`
  - `evidenceItemIds`
  - `confidence`
  - `updatedAt`

`PATCH /api/stores/:storeId/ruleset/fields/:fieldKey` accepts:

```json
{ "userValue": "..." }
```

It persists:

- `userValue`
- `finalValue`
- `fieldValue` for repository compatibility
- `source = user_edited`
- `locked = 1`
- fresh `updatedAt`

`POST /api/stores/:storeId/ruleset/fields/:fieldKey/reset` restores:

- `finalValue = aiValue`
- `fieldValue = aiValue`
- `userValue = null`
- `source = ai_generated`
- `locked = 0`

`GET /api/stores/:storeId/ruleset/fields/:fieldKey/evidence` returns linked `collection_items` as short shaped evidence records and does not expose raw `bodyText`.

## Guardrails

- Browser pages call poc-server APIs only for RULESET-001 behavior.
- No browser-side or server-side Naver/OpenAI calls were added.
- No ruleset regeneration was added.
- No blog generation or image generation was added.
- Existing Event-to-Operation workflows were not modified.
- `admin/` and `pc-web/` were not modified.
- `web/07_마케팅전략룰셋.html` was not redesigned; only data hooks, a status badge, small edit controls, and a page script include were added.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

Open the ruleset page:

```text
http://localhost:5177/07_마케팅전략룰셋.html?storeId=store_demo_cake
```

Useful API checks:

```bash
curl http://localhost:5177/api/stores/store_demo_cake/ruleset
curl http://localhost:5177/api/stores/store_demo_cake/ruleset/fields/positioning/evidence
```

## Next Suggested Task

BLOG-001 can use the latest editable marketing ruleset to generate approval-pending blog drafts. Keep real OpenAI/Naver provider work and image generation behind later provider-boundary tasks unless explicitly requested.
