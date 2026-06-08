# Validation

## NAVER-REVIEW-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
npm audit --omit=dev --json
```

## NAVER-REVIEW-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedCollectionProvider.test.ts`: failed because `naverPlaceRenderedCollectionProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedCollectionProvider.test.ts providerReadinessApi.test.ts`: passed after adding rendered visitor review parsing, collection provider selection, and readiness updates.
- GREEN `npm test -- naverPlaceLiveIntegration.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed with live tests skipped by default.
- GREEN `npm run typecheck`: passed.
- GREEN `npm test -- collectionProgressApi.test.ts providerReadinessApi.test.ts naverPlaceRenderedCollectionProvider.test.ts`: passed, 3 files / 10 tests.

## NAVER-REVIEW-001 Expected Live Verification

- `npm run naver:verify` is opt-in and may use Playwright.
- If Naver returns the current restriction page, the command should pass by verifying restriction handling.
- If Naver allows the rendered request, the command expects:
  - Place import provider `naverPlaceRenderedProvider`.
  - Visitor review collection provider `naverPlaceRenderedCollectionProvider`.
  - Review drafts with `sourceType=review`.
  - Review metadata including `providerMode=real`.

## NAVER-REVIEW-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 29 files / 107 tests plus 2 skipped live files / 5 skipped tests.
- `npm run naver:verify`: passed.
  - Current environment result:
    - Naver returned restriction pages for both rendered Place profile and rendered visitor review requests.
    - The provider detected the restrictions and did not save restricted HTML as successful data.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.
- `npm audit --omit=dev --json`: passed with 0 vulnerabilities.

## NAVER-PLACE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run naver:verify
npm run demo
npm run demo:store-learning
```

## NAVER-PLACE-001 TDD Evidence

- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed because `naverPlaceRenderedProvider` did not exist.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after adding the rendered profile parser/provider and API route coverage.
- RED `npm test -- naverPlaceRenderedProvider.test.ts`: failed for the Naver restriction-page case because partial metadata was being accepted as a successful import.
- GREEN `npm test -- naverPlaceRenderedProvider.test.ts`: passed after restriction-page detection was added.
- GREEN `npm test -- providerReadinessApi.test.ts storeRegistrationApi.test.ts naverPlaceRenderedProvider.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## NAVER-PLACE-001 Live Verification

- `npm run naver:verify`: passed.
- Current environment result:
  - Playwright reached the live Naver Place URL.
  - Naver returned a restriction page for the current IP/request pattern.
  - The provider detected the restriction and did not persist partial metadata as a successful import.

Expected command output includes:

```text
Naver Place live rendered request was restricted by Naver; restriction handling verified.
```

For a successful unrestricted live import, the same test expects:

```text
provider.name => naverPlaceRenderedProvider
store.name => non-empty and not parser fallback
store.address => non-empty
metadata.bodyAvailability => rendered_place_profile
metadata.sourceKind => place_profile
```

## NAVER-PLACE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 28 files / 104 tests plus 2 skipped live files / 4 skipped tests.
- `npm run naver:verify`: passed by verifying current Naver restriction-page handling.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

## OWNER-SOURCE-001 TDD Evidence

- RED `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: failed because:
  - explicit `NAVER_PLACE_PROVIDER=official_search` still returned `mockPlaceProvider`;
  - readiness did not expose `ownerSourcePolicy`;
  - collection run summaries did not include `sourcePolicy`.
- GREEN `npm test -- storeRegistrationApi.test.ts providerReadinessApi.test.ts collectionProgressApi.test.ts`: passed, 3 files / 11 tests.
- GREEN `npm run typecheck`: passed.

## OWNER-SOURCE-001 Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: first run failed in `trainingSettingsApi.test.ts` because the old assertion did not include the new `summary.sourcePolicy`.
- Minimal validation fix: updated that test to assert the default mock source policy.
- `npm test`: passed, 27 files / 100 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OWNER-SOURCE-001 Manual Smoke Notes

No frontend behavior changed in this step.

Expected readiness shape for future rendered/page adapters:

```text
NAVER_OWNER_AUTHORIZED=true
NAVER_PLACE_PROVIDER=rendered
NAVER_BLOG_PROVIDER=page

ownerSourcePolicy.ownerAuthorized => true
ownerSourcePolicy.placeProvider => rendered
ownerSourcePolicy.blogProvider => page
providers.placeImport.selectedProvider => naverPlaceRenderedProvider
providers.placeImport.status => ready
providers.collection.status => fallback_required
```

Expected collection item metadata after a mock owner-authorized run:

```text
metadata.ownerAuthorized => true
metadata.sourceKind => owner_blog_post | place_profile | place_visitor_review
metadata.sourceOwnership => owner_managed | user_generated
metadata.configuredPlaceProvider/configuredBlogProvider => selected env provider
metadata.bodyAvailability => mock_body | provider_body | metadata_only | unavailable
```

## OPS-001 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run openai:verify
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
- `npm run openai:verify` performs opt-in live OpenAI verification when `poc-server/.env` has `OPENAI_API_KEY`.
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
- `npm run openai:verify`: passed, 1 file / 3 live OpenAI tests.
- `npm run typecheck`: passed.
- `npm test`: passed, 27 files / 97 tests plus 1 skipped live OpenAI file / 3 skipped tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## OpenAI Live Integration Validation

- `npm test -- openaiLiveIntegration.test.ts` without live flag: passed with 3 skipped tests.
- `npm run openai:verify`: passed in about 30 seconds.
- Runtime probe: passed with `OpenAI model access verified`.
- Analysis provider: completed and persisted validated artifacts.
- Blog provider: generated an approval-pending post through `openAIBlogProvider`.
- SEO provider: rescored the generated post and returned the expected itemized rubric keys.
- Secrets were not printed.

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

Observed API smoke with local OpenAI key configured:

```text
GET /api/store-learning/provider-readiness
  mode => real_configured
  openaiConfigured => true
  naverSearchConfigured => false
  analysisProvider => openAIAnalysisProvider
  analysisStatus => ready
  blogProvider => openAIBlogProvider
  blogStatus => ready
  collectionProvider => mockCollectionProvider
  collectionStatus => mock_ready
  imageStatus => placeholder_only
  publishingStatus => local_status_only
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
