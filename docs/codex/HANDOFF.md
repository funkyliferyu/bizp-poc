# Codex Handoff

## Current Scope

LLM-001 adds an OpenAI-backed analysis provider for the Store Learning & Blog Content Automation PoC.

This change keeps deterministic mock analysis as the default no-key path and uses OpenAI only when `OPENAI_API_KEY` is configured. It does not change collection, learning status UI, ruleset editing UI, blog generation, image generation, publishing, `admin/`, `pc-web/`, or existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
  - Adds `createOpenAIAnalysisProvider`.
  - Adds `createAnalysisProvider` for env-based mock/openai selection.
  - Uses the existing OpenAI SDK `chat.completions.parse` flow with `zodResponseFormat`.
  - Uses `AnalyzerOutputSchema` as the structured output contract.
  - Sends compact store and selected collection item evidence to the model.
- `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
  - Validates analyzer output with Zod as before.
  - Adds selected-item evidence reference validation before saving.
  - Rejects outputs that reference collection item IDs outside the selected set.
- `poc-server/src/storeLearning/routes/analysisRuns.ts`
  - Selects mock or OpenAI provider server-side.
  - Accepts env/provider injection for tests.
- `poc-server/test/analysisExecutionApi.test.ts`
  - Covers OpenAI provider persistence using a fake parse client.
  - Covers failed analysis when evidence references unavailable collection items.
- `poc-server/test/selectionApi.test.ts`
  - Forces mock env in tests so local developer keys cannot trigger live OpenAI calls.

## Runtime Behavior

Default local demo:

```text
OPENAI_API_KEY is unset
```

Result:

- Analysis runs use `mockDeterministicAnalyzer`.
- No OpenAI request is made.
- Existing demo and UI flows continue to work.

Credentialed OpenAI mode:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # optional
```

Result:

- `POST /api/analysis-runs/:analysisRunId/start` uses `openAIAnalysisProvider`.
- The provider requests structured output matching `AnalyzerOutputSchema`.
- The service validates:
  - schema shape
  - evidence collection item IDs
  - ruleset field evidence item IDs
- Valid outputs persist:
  - `analysis_evidence`
  - `learning_snapshots`
  - `marketing_rulesets`
  - `ruleset_fields`
  - analysis run result metadata with `analyzerMode = openai`.
- Invalid outputs mark the analysis run as `failed` and do not save artifacts.

## Guardrails

- Browser pages still call poc-server APIs only.
- OpenAI credentials stay server-side.
- Mock mode still works without external keys.
- OpenAI output is validated before persistence.
- Evidence must link back to selected `collection_items`.
- No Naver collection behavior changed in LLM-001.
- No blog generation or publishing behavior changed in LLM-001.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Default mock smoke:

```bash
curl -X POST http://localhost:5178/api/analysis-runs \
  -H 'Content-Type: application/json' \
  -d '{"storeId":"store_demo_cake","collectionRunId":"collection_run_demo_store_learning","selectedItemIds":["collection_item_demo_blog","collection_item_demo_place_profile"]}'
```

Then start the returned run:

```bash
curl -X POST http://localhost:5178/api/analysis-runs/{analysisRunId}/start
```

Expected no-key result:

- `analysisRun.status = completed`
- `analysisRun.result.analyzerMode = mock`

Credentialed OpenAI smoke:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Repeat the same API flow.
- Expect `analysisRun.result.analyzerMode = openai`.

## Next Suggested Task

LLM-002 should add OpenAI-backed blog draft generation and regeneration behind the existing blog generator interface. Keep mock generation available, validate all generated draft/SEO structures with Zod before saving, and keep image generation/publishing out of scope unless explicitly requested.
