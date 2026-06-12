# Blog Formula V2 Safe Mock Integration Lane Plan

> **For agentic workers:** This is the next executable Store Learning task
> after PR #48. Start from validated `develop`, create a fresh
> `codex/blog-formula-v2-safe-mock-integration` branch, and use TDD. Keep
> `.DS_Store` unstaged.

**Goal:** Add a server-side `safe_mock` provider lane for Blog Formula V2 that
looks like a real integration path but performs no external OpenAI, Naver, or
browser-side provider calls.

**Architecture:** Keep the existing V2 deterministic behavior working, then
add a provider interface and a `safe_mock` implementation that returns the
same validated V2 schemas with richer request/output provenance. Routes and UI
may choose `safe_mock`, but V2 must still write only to V2 tables and must not
touch V1 rulesets or Blog generation.

**Tech Stack:** Express/TypeScript, Zod, SQLite repositories, static HTML/JS,
Vitest, Playwright smoke when UI changes.

---

## Current State

- `develop == origin/develop`
- Current HEAD after PR #48 validation docs:
  `e69de6c docs: record blog formula v2 develop validation`
- PR #48 merged Blog Formula V2 deterministic lane:
  `c8f1b52 Merge pull request #48 from funkyliferyu/codex/blog-formula-v2-experiment`
- `.DS_Store` remains modified locally and must not be staged.
- `localhost:5180` was running during validation and served V2 APIs.

Existing V2 files:

```text
poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts
poc-server/src/storeLearning/blogFormulaV2/sourcePosts.ts
poc-server/src/storeLearning/blogFormulaV2/types.ts
poc-server/src/storeLearning/blogFormulaV2/validator.ts
poc-server/src/storeLearning/routes/blogFormulaV2.ts
poc-server/src/repositories/v2_blog_formula.ts
web/blog_formula_v2.js
web/07_마케팅전략룰셋.html
docs/BLOG_FORMULA_V2_HANDOFF.md
```

## Non-Negotiable Boundaries

- Do not modify `admin/`.
- Do not modify `pc-web/`.
- Do not modify `README_POC.md`.
- Do not modify `web/event_operation_poc.html`.
- Do not touch old Event-to-Operation files.
- Do not stage `.DS_Store`.
- Do not add browser-side Naver/OpenAI/provider calls.
- Do not add real OpenAI calls for V2 in this task.
- Do not add Hybrid or combined V1/V2 generation.
- Do not write to `marketing_rulesets` or `ruleset_fields` from V2.
- Keep all V2 persistence in existing `v2_` tables unless a new V2-only column
  is strictly required and covered by migration tests.

## Product Intent

The first V2 lane is deterministic. The next lane should make V2 look like a
real integration surface while still being safe and mockable:

```text
deterministic lane:
  current local algorithm, already implemented

safe_mock lane:
  provider-shaped server path, no external calls, schema-validated outputs,
  provenance that proves it is mock-safe and ready for later provider swap
```

This is not a request to build a live OpenAI lane.

## Expected Implementation Shape

Create a provider boundary under:

```text
poc-server/src/storeLearning/blogFormulaV2/providers/
```

Suggested files:

```text
providers/blogFormulaV2Provider.ts
providers/deterministicProvider.ts
providers/safeMockProvider.ts
providers/providerFactory.ts
```

The provider contract should cover the operations that can later become real
integration calls:

```ts
type BlogFormulaV2ProviderMode = 'deterministic' | 'safe_mock';

type BlogFormulaV2Provider = {
  mode: BlogFormulaV2ProviderMode;
  model: string;
  extractFormula(input): BlogFormulaV2ProviderResult<BlogFormulaSetV2>;
  generateDraft(input): BlogFormulaV2ProviderResult<BlogDraftOutputV2>;
};
```

Provider result provenance should be serializable and safe for SQLite/browser:

```ts
{
  provider: 'blog_formula_v2_safe_mock',
  mode: 'safe_mock',
  model: 'safe-mock-blog-formula-v2',
  promptShapeVersion: 'blog_formula_v2_provider_input.v1',
  noExternalCalls: true,
  inputSummary: {
    sourcePostCount: number,
    topicBriefPresent: boolean
  }
}
```

Do not store secrets, raw SDK objects, or external HTTP metadata.

## API Contract Direction

Keep the existing namespace:

```text
/api/stores/:storeId/v2/blog-formula
```

Add optional body field on provider-backed endpoints:

```json
{ "providerMode": "safe_mock" }
```

Recommended endpoints to support first:

```text
POST /extract
POST /generate-draft
```

`retrieve-samples` and `validate-draft` may remain deterministic/server local.

Responses should expose a compact V2 provenance object, for example:

```json
{
  "provider": {
    "mode": "safe_mock",
    "model": "safe-mock-blog-formula-v2",
    "noExternalCalls": true
  }
}
```

## UI Direction

Keep `web/blog_formula_v2.js` on `poc-server` APIs only.

If UI is changed, add only a small V2-local provider mode selector or status
line. Do not mix safe mock controls into V1 writing-style fields. Do not add
marketing/landing copy.

## TDD Checklist

1. Repository/schema tests
   - Existing V2 tables still migrate.
   - Safe mock provenance is persisted in existing V2 JSON columns.
   - V2 safe mock flow still leaves `marketing_rulesets` and `ruleset_fields`
     untouched.

2. Provider tests
   - `safeMockProvider.extractFormula` returns `BlogFormulaSetV2Schema`
     compliant output.
   - `safeMockProvider.generateDraft` returns `BlogDraftOutputV2Schema`
     compliant output.
   - provider result has `mode = "safe_mock"` and `noExternalCalls = true`.
   - provider does not import OpenAI client modules.

3. API tests
   - `POST /extract` with `{ "providerMode": "safe_mock" }` returns provider
     provenance and stores it in `v2_blog_formula_runs.output_json` or
     validation/provenance metadata.
   - `POST /generate-draft` with `{ "providerMode": "safe_mock" }` returns
     `generationMode = "v2_formula"`, provider provenance, and no Hybrid
     values.
   - Existing calls without `providerMode` still pass current V2 tests.

4. UI tests, only if UI changes
   - `web/blog_formula_v2.js` posts `providerMode: "safe_mock"` only to
     `/api/stores/${storeId}/v2/blog-formula/*`.
   - No external URL fetches.
   - No `OPENAI`, `NAVER_CLIENT`, or provider credentials in browser JS.

5. Demo tests
   - `npm run demo:blog-formula-v2` can run in safe mock mode with a temp DB.
   - Demo output includes `mode = "safe_mock"` for provider provenance while
     draft `generationMode` remains `v2_formula`.

## Suggested Validation Commands

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Repositories.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Page.test.ts test/blogFormulaV2Demo.test.ts
npm run typecheck
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-safe-mock.sqlite npm run demo:blog-formula-v2
npm test
cd ..
node --check web/blog_formula_v2.js
node --check web/ruleset_editor.js
git diff --check
```

If the UI changes, run a Playwright smoke against:

```text
http://127.0.0.1:5180/07_마케팅전략룰셋.html?storeId=store_1020864025
```

Confirm:

- V2 tab loads.
- provider mode/status shows safe mock if added.
- extract, Top 3 retrieval, draft generation, and validation work.
- console/page errors are empty.

## New Session Request Text

Copy this into a fresh Codex session:

```text
작업 폴더:
`/Users/1004182/Documents/bizplanet-work/bizp-store-learning-poc`

먼저 아래 문서를 읽고 현재 상태를 확인해줘:
- AGENTS.md
- poc-server/AGENTS.md
- docs/codex/GIT_WORKFLOW.md
- docs/codex/PLAN.md
- docs/codex/HANDOFF.md
- docs/codex/VALIDATION.md
- docs/codex/LLM_CALL_STRUCTURES.md
- docs/BLOG_FORMULA_V2_HANDOFF.md
- docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_SAFE_MOCK_INTEGRATION_PLAN.md

현재 상태:
- Blog Formula V2 deterministic lane은 PR #48로 `develop`에 merge 완료.
- `develop == origin/develop`
- 현재 HEAD는 최신 `develop`이며 safe mock integration handoff 문서가 포함되어 있어야 함
- PR #48 merge commit은 `c8f1b52`
- feature branch `codex/blog-formula-v2-experiment`는 원격 삭제/prune 완료
- `.DS_Store`는 modified 상태로 남아 있음. 절대 stage/commit/push에 포함하지 말 것
- `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`, old Event-to-Operation 파일은 건드리지 말 것
- browser-side Naver/OpenAI/provider 호출 추가 금지
- LLM/OpenAI 호출은 반드시 `poc-server` 서버 경유
- 이번 작업에서는 실제 OpenAI/Naver 호출을 만들지 말 것
- 이번 작업에서는 Hybrid/combined V1+V2 생성 레인을 만들지 말 것

이번 세션 목표:
1. `git status --short --branch`로 `develop == origin/develop` 및 `.DS_Store` 제외 상태 재확인
2. `docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_SAFE_MOCK_INTEGRATION_PLAN.md`의 계획을 기준으로 새 브랜치 `codex/blog-formula-v2-safe-mock-integration` 생성
3. Blog Formula V2에 실제 연동을 나중에 꽂을 수 있는 server-side provider boundary를 추가하되, 구현은 `safe_mock`만 추가
4. 기존 deterministic V2 동작은 깨지지 않게 유지
5. `safe_mock` provider는 schema-validated formula/draft output과 safe provenance를 반환해야 하며 external call은 절대 하지 않음
6. V2는 계속 `v2_` 테이블만 사용하고 V1 `marketing_rulesets` / `ruleset_fields`를 쓰거나 수정하지 말 것
7. TDD로 RED 테스트부터 추가 후 구현
8. 검증:
   - `cd poc-server && npm run typecheck`
   - focused Blog Formula V2 tests
   - `STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-safe-mock.sqlite npm run demo:blog-formula-v2`
   - `cd poc-server && npm test`
   - `node --check web/blog_formula_v2.js`
   - `node --check web/ruleset_editor.js`
   - `git diff --check`
   - UI 변경 시 localhost:5180 V2 tab Playwright smoke
9. 완료 시 PR을 `develop` 대상으로 만들고, 완료 리포트에 다음 단계 브리핑 포함
```
