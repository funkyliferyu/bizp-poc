# Validation

## OPS-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
curl http://localhost:5178/api/store-learning/provider-readiness
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run typecheck` verifies readiness types and route mounting.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- providerReadinessApi.test.ts`: failed because the readiness service and route did not exist.
- GREEN `npm test -- providerReadinessApi.test.ts`: passed, 1 file / 3 tests.
- GREEN `npm run typecheck`: passed.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 27 files / 97 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
GET /api/store-learning/provider-readiness
  productFlow => Store Learning & Blog Content Automation PoC
  mode => mock
  openaiConfigured => false
  naverSearchConfigured => false
  placeImport => mockPlaceProvider
  collection => mockCollectionProvider
  analysis => mockDeterministicAnalyzer
  blogGeneration => mock_ruleset_blog_generator
  imageGenerationStatus => placeholder_only
  publishingStatus => local_status_only
  fallbackCapabilities => full_blog_body, place_reviews, full_place_body
```

## Manual Smoke Checklist

Default mock mode:

- `GET /api/store-learning/provider-readiness` should work without external keys.
- Response should include `productFlow = Store Learning & Blog Content Automation PoC`.
- Response should include `mode = mock`.
- Response should not include secret values.
- Provider entries should show mock/placeholder/local status only.

Credentialed readiness mode:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Set `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- Set `STORE_LEARNING_MOCK_MODE=false`.
- `GET /api/store-learning/provider-readiness` should report:
  - `naverLocalSearchProvider` ready for Place import.
  - `naverSearchCollectionProvider` partial_ready for official search collection.
  - `openAIAnalysisProvider` ready for analysis.
  - `openAIBlogProvider` ready for blog generation.
  - fallback_required for full blog body and Place reviews.

## Boundaries

- Browser pages still call poc-server APIs only.
- OpenAI/Naver credentials stay server-side.
- Mock mode still works without external keys.
- Readiness does not perform live provider calls.
- Image generation remains placeholder-only.
- Naver Blog publishing remains local status transition only.
- Naver full body/review limitations are explicitly surfaced.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
