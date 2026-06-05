# Codex Handoff

## Current Scope

REAL-002 adds provider adapters for Store Learning collection runs.

This change keeps the existing deterministic mock collection flow as the default, and adds a server-side Naver Search collection provider when mock mode is disabled and Naver credentials are present. It does not implement full Naver Blog body collection, Naver Place review collection, OpenAI analysis, image generation, publishing, `admin/`, `pc-web/`, or Event-to-Operation workflow changes.

## Added Runtime Pieces

- `poc-server/src/storeLearning/collection/collectionProviders.ts`
  - Defines the collection provider contract.
  - Defines the collection plan and provider item drafts.
  - Centralizes real Naver provider eligibility.
- `poc-server/src/storeLearning/collection/mockCollectionProvider.ts`
  - Preserves the previous deterministic mock item generation.
- `poc-server/src/storeLearning/collection/naverSearchCollectionProvider.ts`
  - Calls Naver Blog Search for blog search metadata/snippets.
  - Calls Naver Local Search for Place profile metadata.
  - Validates Naver responses with Zod before creating collection item drafts.
  - Marks Place review requests as failed fallback-required items because official Local Search does not return Place reviews.
- `poc-server/src/storeLearning/collection/collectionRunner.ts`
  - Selects mock vs real provider.
  - Persists provider-generated collection items to SQLite.
  - Moves pending items through `collecting` to `collected`.
  - Leaves fallback-required review items as `failed`.
  - Finalizes runs as `completed`, `partial_completed`, or `failed`.
- `poc-server/src/storeLearning/routes/collectionRuns.ts`
  - Uses the provider-aware runner.
  - Accepts server-side env injection for tests and runtime.
- `poc-server/test/collectionProgressApi.test.ts`
  - Adds coverage for real Naver provider mode using fake local Naver endpoints.
  - Verifies Naver credentials are sent server-side only.
  - Verifies blog/profile metadata is collected and Place reviews are marked fallback-required.

## Runtime Behavior

Default local demo:

```text
STORE_LEARNING_MOCK_MODE is unset
```

Result:

- Collection runs use `mockCollectionProvider`.
- No external keys are required.
- The progress and selection pages continue to work with deterministic mock data.

Credentialed Naver metadata mode:

```text
STORE_LEARNING_MOCK_MODE=false
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

Optional test/local overrides:

```text
NAVER_BLOG_SEARCH_ENDPOINT=...
NAVER_LOCAL_SEARCH_ENDPOINT=...
```

Result:

- `POST /api/collection-runs/:runId/start` uses `naverSearchCollectionProvider`.
- Blog items are collected from official Blog Search metadata:
  - title
  - link
  - description/snippet
  - blogger name/link
  - post date
- Place profile is collected from official Local Search metadata:
  - title
  - category
  - description
  - address / roadAddress
  - mapx / mapy
- Place review requests become `failed` collection items with `reviewAvailability = requires_fallback_provider`.
- Runs with collected metadata plus failed review placeholders finish as `partial_completed`.

## Provider Limits

Naver Blog Search returns search result snippets, not guaranteed full post bodies. Naver Local Search returns local business metadata, not Place reviews.

Full blog body collection and Place review collection remain intentionally out of scope for REAL-002. They need a separate compliant provider/fallback decision before implementation.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Open:

```text
http://localhost:5178/03_AI학습_온보딩.html?storeId=store_demo_cake
```

Default mock check:

- Save settings.
- Start collection.
- Confirm progress page reaches completed.

Credentialed provider check:

- Set `STORE_LEARNING_MOCK_MODE=false`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET`.
- Start a collection run from the training page or API.
- Confirm run summary provider is `naverSearchCollectionProvider`.
- Confirm collected blog/profile items use Naver metadata.
- Confirm Place review items show failed/fallback-required state.

## Next Suggested Task

LLM-001 should add an OpenAI analysis provider behind the existing analyzer interface. It should keep mock mode available, use Structured Outputs/Zod validation before saving, and continue linking evidence to collected item IDs.
