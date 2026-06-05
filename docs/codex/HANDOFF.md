# Codex Handoff

## Current Scope

ANALYZE-001 implements deterministic mock analysis execution for the Store Learning & Blog Content Automation PoC.

This change starts queued `analysis_runs`, validates analyzer output with Zod, and persists analysis evidence, learning snapshots, marketing rulesets, and editable ruleset fields. It does not call OpenAI, run real LLM analysis, generate blog content, generate images, call Naver, or fully connect the learning status/ruleset UI pages.

## Added Runtime Pieces

- `poc-server/src/storeLearning/analysis/analyzer.ts`
  - Defines the analyzer provider boundary.
  - Provides `createMockAnalysisProvider()`.
  - Validates analyzer output with `AnalyzerOutputSchema`.
- `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
  - Starts a queued analysis run.
  - Persists `analysis_evidence`, `learning_snapshots`, `marketing_rulesets`, and `ruleset_fields`.
  - Updates `analysis_runs.status` to `completed` or `failed`.
  - Provides artifact lookup helpers.
- `poc-server/src/storeLearning/routes/analysisRuns.ts` now also exposes:
  - `POST /api/analysis-runs/:analysisRunId/start`
  - `GET /api/analysis-runs/:analysisRunId`
- `poc-server/src/storeLearning/routes/stores.ts` now also exposes:
  - `GET /api/stores/:storeId/latest-analysis`
- `ruleset_fields` now supports editable field data:
  - `ai_value`
  - `user_value`
  - `final_value`
  - `locked`
  - `evidence_item_ids_json`
- `poc-server/test/analysisExecutionApi.test.ts` covers analysis execution, artifact persistence, ruleset fields, and evidence linkage.

## Analyzer Output

The mock analyzer produces validated output for:

- store positioning
- key strengths
- target customers
- tone and manner
- blog writing style
- SEO keywords
- CTA style
- image direction
- negative/forbidden expressions
- evidence linked back to `collection_items`
- editable ruleset fields with evidence item IDs

## Data Touchpoints

- `analysis_runs`
  - `queued` runs are updated to `analyzing`, then `completed`.
  - failures update the run to `failed` and save an error payload.
  - completed run `result_json` stores analyzer mode/provider and generated artifact IDs.
- `analysis_evidence`
  - one or more evidence rows link back to selected `collection_items`.
- `learning_snapshots`
  - one active snapshot is created for the analysis run.
- `marketing_rulesets`
  - one draft ruleset is created for the snapshot.
  - version increments per store.
- `ruleset_fields`
  - one editable field row is created for each major analyzer output field.
  - `field_value` remains populated for legacy compatibility and mirrors `final_value`.

## Guardrails

- Mock mode works without external keys.
- No browser-side or server-side Naver/OpenAI calls were added.
- The OpenAI/provider boundary exists only as a TypeScript interface and mock provider implementation.
- Browser pages still call poc-server APIs only.
- Existing Event-to-Operation workflows were not changed beyond Store Learning route additions from previous tasks.
- `admin/` and `pc-web/` were not modified.
- Blog generation, image generation, and real provider collection remain out of scope.
- Learning status and ruleset pages are not fully connected in ANALYZE-001.

## Local Run Notes

Run the server from `poc-server/`:

```bash
npm run dev
```

Start analysis through API after SELECT-001 has created a queued run:

```bash
curl -X POST http://localhost:5177/api/analysis-runs/<analysisRunId>/start
```

Then inspect:

```bash
curl http://localhost:5177/api/analysis-runs/<analysisRunId>
curl http://localhost:5177/api/stores/store_demo_cake/latest-analysis
```

## Next Suggested Task

LEARN-001 can connect `06_AI학습_현황.html` to `latest-analysis` and display Blog, Place, and Instagram status tabs using persisted learning snapshot data. Keep ruleset editing and blog generation as later tasks unless explicitly requested.
