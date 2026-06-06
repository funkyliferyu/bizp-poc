# Codex Handoff

## Current Scope

OPS-001 adds provider readiness guardrails for the Store Learning & Blog Content Automation PoC.

This change exposes a safe server-side readiness contract that shows which mock/real providers are active, which credentials are configured, and which Naver/OpenAI-dependent capabilities still require approved fallback providers. It does not connect new UI behavior, make external provider calls, generate real images, publish to Naver Blog, modify `admin/` or `pc-web/`, or change existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/test/openaiLiveIntegration.test.ts`
  - Adds opt-in live OpenAI validation.
  - Skips during normal `npm test`.
  - Runs only when `RUN_OPENAI_INTEGRATION=1`.
  - Verifies OpenAI runtime probe, OpenAI analysis persistence, OpenAI blog generation, and OpenAI SEO rescoring.
- `poc-server/package.json`
  - Adds `npm run openai:verify` for the live validation set.
- `poc-server/src/storeLearning/readiness/providerReadiness.ts`
  - Builds a secret-safe provider readiness payload.
  - Reports mock vs real provider selection for Place import, collection, analysis, blog generation, image generation, and publishing.
  - Declares official Naver limitations for full blog body, full Place body, and Place reviews.
  - Lists next actions needed before fully real operation.
- `poc-server/src/storeLearning/routes/readiness.ts`
  - Adds `GET /api/store-learning/provider-readiness`.
  - Keeps readiness access behind `poc-server` APIs only.
- `poc-server/src/index.ts`
  - Mounts the Store Learning readiness route.
- `poc-server/test/providerReadinessApi.test.ts`
  - Covers no-key mock readiness.
  - Covers configured real provider readiness without leaking credentials.
  - Covers the API route response.

## Runtime Behavior

Default local demo:

```text
OPENAI_API_KEY is unset
NAVER_CLIENT_ID is unset
NAVER_CLIENT_SECRET is unset
STORE_LEARNING_MOCK_MODE is unset
```

Result:

- `mode = mock`.
- Place import reports `mockPlaceProvider`.
- Collection reports `mockCollectionProvider`.
- Analysis reports `mockDeterministicAnalyzer`.
- Blog generation reports `mock_ruleset_blog_generator`.
- Image generation reports `placeholder_only`.
- Publishing reports `local_status_only`.
- No external provider request is made.

Credentialed partial-real mode:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # optional
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
STORE_LEARNING_MOCK_MODE=false
```

Result:

- Place import reports `naverLocalSearchProvider`.
- Collection reports `naverSearchCollectionProvider` with `partial_ready`.
- Analysis reports `openAIAnalysisProvider`.
- Blog generation reports `openAIBlogProvider`.
- Full blog body and Place reviews still report `fallback_required` because official Naver APIs do not provide those bodies.
- Image generation and real publishing still require explicit provider adapters.

## Guardrails

- Browser pages still call poc-server APIs only.
- OpenAI and Naver credentials stay server-side.
- `poc-server/.env` is ignored and must not be committed.
- `poc-server/.env.example` remains trackable but must not contain real keys.
- Readiness payloads expose booleans and provider names, not secret values.
- Mock mode still works without external keys.
- Live OpenAI tests are opt-in and may consume API quota.
- Official Naver APIs remain treated as partial data sources:
  - Blog Search: snippet/metadata only.
  - Local Search: local metadata only.
  - Full blog body, full Place body, and Place reviews require fallback provider design.
- LLM output validation remains enforced in analysis and blog generation providers.
- Real image generation and real Naver Blog publishing remain out of scope.

## OpenAI Validation Operating Notes

Run from `poc-server/`:

```bash
npm run openai:verify
```

This command performs live OpenAI calls for:

- model access probe
- analysis provider structured output
- blog generation provider structured output
- SEO scoring provider structured output

Normal `npm test` remains mock-safe because `openaiLiveIntegration.test.ts` is skipped unless `RUN_OPENAI_INTEGRATION=1` is set.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Default mock smoke:

```bash
curl http://localhost:5178/api/store-learning/provider-readiness
```

Expected no-key result:

- `productFlow = Store Learning & Blog Content Automation PoC`.
- `mode = mock`.
- `credentials.openaiConfigured = false`.
- `credentials.naverSearchConfigured = false`.
- Provider statuses are mock/placeholder/local-status only.

Credentialed readiness smoke:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- Set `STORE_LEARNING_MOCK_MODE=false`.
- Repeat the readiness request.
- Expect OpenAI/Naver provider entries to show ready or partial_ready.
- Confirm full blog body and Place reviews still show fallback requirements.

## Next Suggested Task

Before any production-like pilot, decide approved fallback providers and operating policies for:

- full Naver Blog body access
- Naver Place reviews
- image generation
- Naver Blog publishing
- provider failure/error UX in the existing static pages
