# Codex Handoff

## Current Scope

REAL-001 adds the first real provider path for the Store Learning & Blog Content Automation PoC.

This change connects store Place URL import to a server-side Naver Local Search provider when mock mode is disabled and Naver credentials are present. It keeps mock mode as the default, keeps browser pages calling poc-server APIs only, and does not change collection, analysis, rulesets, blog generation, publishing, `admin/`, `pc-web/`, or existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/src/storeLearning/providers/naverLocalSearchProvider.ts`
  - Calls Naver Local Search from the server only.
  - Requires `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
  - Respects `STORE_LEARNING_MOCK_MODE=false`; otherwise `mockPlaceProvider` remains first.
  - Supports `NAVER_LOCAL_SEARCH_ENDPOINT` as a test/local override.
  - Parses and validates the Naver response with Zod before building the store draft.
  - Stores only metadata from the official local search response; credentials are never persisted.
- `poc-server/src/storeLearning/providers/naverPlaceUrlParser.ts`
  - Prefers numeric Place IDs in URLs like `/place/{id}/home`.
  - Avoids generic path segments such as `home`, `review`, and `search` as store IDs.
- `poc-server/test/storeRegistrationApi.test.ts`
  - Adds RED/GREEN coverage for server-side Naver Local Search import with a fake local endpoint.
  - Verifies headers stay server-side and the persisted channel uses `providerMode = real`.

## Runtime Behavior

Default local demo:

```text
STORE_LEARNING_MOCK_MODE is unset
```

Result:

- `mockPlaceProvider` handles store import.
- No external keys are required.
- No Naver request is made.

Credentialed local search mode:

```text
STORE_LEARNING_MOCK_MODE=false
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

Result:

- `POST /api/stores/import-place` attempts Naver Local Search when the URL provides a usable search query.
- Returned store fields are limited to official Local Search metadata:
  - title
  - category
  - description
  - address / roadAddress
  - mapx / mapy metadata
- If there is no usable search query in the URL, the flow falls back to `naverPlaceUrlParser`.

## Provider Limits

Naver Local Search does not provide full Naver Place body data or Place reviews. Those remain out of scope for REAL-001 and need the next provider/fallback design step.

Naver Blog body collection, Place review collection, OpenAI analysis, image generation, and Naver Blog publishing are unchanged.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Open:

```text
http://localhost:5178/soho_store_register.html
```

Default mock check:

- Enter a demo Naver Place URL.
- Confirm fields populate through `mockPlaceProvider`.

Credentialed provider check:

- Set `STORE_LEARNING_MOCK_MODE=false`, `NAVER_CLIENT_ID`, and `NAVER_CLIENT_SECRET`.
- Use a Naver URL that includes a searchable keyword, for example a `map.naver.com/p/search/{keyword}/place/{id}` style URL.
- Confirm the response provider is `naverLocalSearchProvider` and the saved channel has `providerMode = real`.

## Next Suggested Task

REAL-002 should introduce collection provider adapters for blog/place collection. Keep official Naver Search API usage limited to available metadata, keep full blog body and Place review collection behind a separate compliant provider/fallback decision, and preserve mock mode for no-key local demos.
