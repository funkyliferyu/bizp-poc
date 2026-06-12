# Blog Formula V2 OpenAI Formula Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:test-driven-development before implementation, then use
> superpowers:verification-before-completion before reporting completion.
> Start from validated `develop`, create branch
> `codex/blog-formula-v2-openai-formula-provider`, and keep `.DS_Store`
> unstaged.

**Goal:** Add the server-side Blog Formula V2 provider boundary and implement
OpenAI-backed formula extraction (`SL-F1`) with a safe mock fallback, without
changing or breaking the existing deterministic V2 lane.

**Architecture:** Keep V2 independent from V1. Existing no-body/default V2
extract behavior must remain deterministic. Add provider-shaped extraction
behind `poc-server` only: `safe_mock` performs no external calls, while
`openai` calls OpenAI server-side through `client.beta.chat.completions.parse`
and validates the result with `BlogFormulaSetV2Schema` before persistence.
Draft generation remains the current deterministic V2 formula draft path in
this milestone.

**Tech Stack:** Express/TypeScript, Zod, OpenAI `zodResponseFormat`, existing
LLM audit metadata helpers, SQLite V2 repositories, Vitest, optional
Playwright smoke for UI changes.

---

## Current State

- `develop == origin/develop`
- Expected HEAD:
  `a36ca0b docs: hand off blog formula v2 safe mock plan`
- PR #48 merged Blog Formula V2 deterministic lane:
  `c8f1b52 Merge pull request #48 from funkyliferyu/codex/blog-formula-v2-experiment`
- `.DS_Store` remains modified locally and must never be staged.
- Existing V2 extraction/retrieval/draft/validation are deterministic and
  mock-safe.
- `docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_SAFE_MOCK_INTEGRATION_PLAN.md` is
  superseded by this plan.

## Non-Negotiable Boundaries

- Do not modify `admin/`.
- Do not modify `pc-web/`.
- Do not modify `README_POC.md`.
- Do not modify `web/event_operation_poc.html`.
- Do not touch old Event-to-Operation files.
- Do not stage `.DS_Store`.
- Browser pages must call only `poc-server` APIs.
- Do not add browser-side Naver/OpenAI/provider calls.
- Do not add Naver calls for this milestone.
- Do not add Hybrid or combined V1/V2 generation.
- Do not write to V1 `marketing_rulesets` or `ruleset_fields` from V2.
- Keep all V2 persistence in existing `v2_` tables unless a V2-only migration
  becomes unavoidable and is tested first.
- Do not implement OpenAI V2 draft generation in this milestone. Only formula
  extraction gets the OpenAI provider.

## Product Intent

The existing deterministic V2 lane proves the independent experiment surface.
The next step is the real LLM formula extraction path:

```text
existing deterministic:
  current local formula builder, unchanged for default compatibility

safe_mock provider:
  provider-shaped path, no external calls, same schema, safe local validation

openai provider:
  server-side OpenAI formula extraction, schema-validated, audited, persisted
  only into V2 formula tables
```
This makes V2 ready to compare deterministic vs safe mock vs OpenAI formula
outputs later, without building Hybrid V1/V2 generation yet.

## Planned LLM Call

Call ID:

```text
SL-F1
```

Purpose:

```text
Extract a reusable Blog Formula V2 style formula from collected owner Blog
posts for one store.
```

OpenAI method:

```text
client.beta.chat.completions.parse
```

Response contract:

```text
BlogFormulaSetV2Schema
```

Response format name:

```text
store_learning_blog_formula_v2
```

System prompt:

```text
You are a Korean local-store blog formula analyst. Extract reusable writing
formula blocks from the provided owner Blog posts only. Return strict
structured Blog Formula V2 JSON. Do not invent evidence, customer reviews, or
provider facts. Keep medical, legal, and guarantee claims conservative.
```

Prompt input shape:

```ts
{
  task: 'Extract Blog Formula V2 from owner Blog posts.',
  schemaVersion: 'blog_formula_v2_extraction_input.v1',
  outputSchemaRef: 'blog_formula_v2.0',
  constraints: [
    'Use only provided owner_blog_post sources.',
    'Each formula block sourcePostIds value must refer to provided sourcePostIds.',
    'Do not use Place reviews, Place profiles, Instagram, or V1 ruleset fields as evidence.',
    'Do not invent treatment outcomes, rankings, guarantees, or no-side-effect claims.',
    'If evidence is weak, set block status to candidate or weak and reduce confidence.',
    'Return Korean formula names, descriptions, and patterns.'
  ],
  storeProfile: {
    id: string,
    name: string | null,
    category: string | null,
    address: string | null
  },
  sourcePostIds: string[],
  ownerBlogPosts: [
    {
      id: string,
      title: string | null,
      sourceUrl: string | null,
      publishedAt: string | null,
      charCount: number,
      includedCharCount: number,
      isTruncated: boolean,
      bodyText: string
    }
  ],
  requestedFormulaBlocks: [
    'titleFormula',
    'introFormula',
    'bodyFormula',
    'headingFormula',
    'toneAndMannerFormula',
    'ctaFormula',
    'footerFormula',
    'medicalSafetyFormula'
  ]
}
```

Prompt budget metadata should include:

```ts
{
  schemaVersion: 'blog_formula_v2_extraction_input.v1',
  sourcePostCount: number,
  promptSourcePostCount: number,
  sourcePostIds: string[],
  omittedSourcePostIds: string[],
  promptCharacterCount: number,
  promptCharacterBudget: number,
  bodyCharacterBudget: number,
  promptBudgetReason:
    | 'within_budget'
    | 'source_post_limit_exceeded'
    | 'body_truncated_to_budget'
    | 'prompt_character_budget_exceeded'
}
```

Use conservative defaults in the prompt builder:

```text
max prompt posts: 8 latest owner Blog posts
max body chars per post: 3500
max aggregate body chars: 18000
max serialized prompt chars: 30000
```

## Provider Selection Contract

Add optional `providerMode` to `POST /extract` only:

```ts
type BlogFormulaV2ExtractProviderMode = 'deterministic' | 'safe_mock' | 'openai' | 'auto';
```

Behavior:

- missing `providerMode`: preserve existing deterministic behavior
- `deterministic`: same as existing deterministic behavior
- `safe_mock`: provider boundary path with no external calls
- `openai`: call OpenAI server-side; fail clearly if `OPENAI_API_KEY` or the
  client is unavailable
- `auto`: use `openai` only when server-side OpenAI config is available;
  otherwise use `safe_mock`

Do not silently downgrade an explicit `openai` request to mock output.

Suggested response provenance:

```json
{
  "provider": {
    "name": "openAIBlogFormulaV2Provider",
    "mode": "openai",
    "model": "gpt-4o-mini",
    "callId": "SL-F1",
    "promptShapeVersion": "blog_formula_v2_extraction_input.v1",
    "noExternalCalls": false
  }
}
```

For `safe_mock`:

```json
{
  "provider": {
    "name": "safeMockBlogFormulaV2Provider",
    "mode": "safe_mock",
    "model": "safe-mock-blog-formula-v2",
    "callId": "SL-F1",
    "promptShapeVersion": "blog_formula_v2_extraction_input.v1",
    "noExternalCalls": true
  }
}
```

## File Structure

Create:

```text
poc-server/src/storeLearning/blogFormulaV2/blogFormulaPrompt.ts
poc-server/src/storeLearning/blogFormulaV2/providers/blogFormulaV2Provider.ts
poc-server/src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.ts
poc-server/src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.ts
poc-server/src/storeLearning/blogFormulaV2/providers/providerFactory.ts
poc-server/test/blogFormulaV2Prompt.test.ts
poc-server/test/blogFormulaV2Provider.test.ts
```

Modify:

```text
poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts
poc-server/src/storeLearning/routes/blogFormulaV2.ts
poc-server/src/storeLearning/llmAudit/llmAuditRecorder.ts
poc-server/test/blogFormulaV2Api.test.ts
poc-server/test/blogFormulaV2Services.test.ts
poc-server/test/blogFormulaV2Demo.test.ts
docs/codex/LLM_CALL_STRUCTURES.md
docs/codex/HANDOFF.md
docs/codex/PLAN.md
docs/codex/VALIDATION.md
docs/BLOG_FORMULA_V2_HANDOFF.md
```

Modify only if UI changes:

```text
web/blog_formula_v2.js
web/07_마케팅전략룰셋.html
poc-server/test/blogFormulaV2Page.test.ts
```

## Task 1: Add Prompt Builder Tests

**Files:**

- Create: `poc-server/test/blogFormulaV2Prompt.test.ts`
- Create later: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaPrompt.ts`

- [ ] **Step 1: Write RED tests**

Cover:

```ts
import { describe, expect, it } from 'vitest';
import { buildBlogFormulaV2PromptInput } from '../src/storeLearning/blogFormulaV2/blogFormulaPrompt.js';

describe('buildBlogFormulaV2PromptInput', () => {
  it('builds a bounded owner-blog-only SL-F1 prompt input', () => {
    const result = buildBlogFormulaV2PromptInput({
      store: {
        id: 'store_test',
        name: '테스트의원',
        category: '피부과',
        address: '서울시 테스트구'
      },
      ownerBlogPosts: Array.from({ length: 9 }, (_, index) => ({
        collectionItemId: `item_${index}`,
        title: `테스트 시술 ${index}`,
        sourceUrl: `https://blog.example.test/${index}`,
        publishedAt: `2026-06-${String(index + 1).padStart(2, '0')}`,
        sourceKind: 'owner_blog_post' as const,
        bodyText: '본문 '.repeat(1200),
        charCount: 2400,
        isTruncated: false
      }))
    });

    expect(result.promptInput.schemaVersion).toBe('blog_formula_v2_extraction_input.v1');
    expect(result.promptInput.ownerBlogPosts).toHaveLength(8);
    expect(result.promptInput.ownerBlogPosts[0]).toMatchObject({
      id: expect.stringMatching(/^item_/),
      title: expect.any(String)
    });
    expect(JSON.stringify(result.promptInput)).not.toContain('Place');
    expect(result.metadata.omittedSourcePostIds).toHaveLength(1);
    expect(result.metadata.promptCharacterCount).toBeLessThanOrEqual(result.metadata.promptCharacterBudget);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Prompt.test.ts
```

Expected: FAIL because `blogFormulaPrompt.ts` does not exist.

## Task 2: Implement Prompt Builder

**Files:**

- Create: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaPrompt.ts`
- Test: `poc-server/test/blogFormulaV2Prompt.test.ts`

- [ ] **Step 1: Add `buildBlogFormulaV2PromptInput`**

Implement the function with the prompt shape and budget metadata from
`Planned LLM Call`. Keep it pure: no DB access, no OpenAI imports, no
persistence.

- [ ] **Step 2: Run GREEN**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Prompt.test.ts
```

Expected: PASS.

## Task 3: Add Provider Boundary And Safe Mock Provider

**Files:**

- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/blogFormulaV2Provider.ts`
- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/safeMockBlogFormulaProvider.ts`
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`
- Test: `poc-server/test/blogFormulaV2Provider.test.ts`

- [ ] **Step 1: Write RED provider tests**

Cover:

```ts
expect(provider.mode).toBe('safe_mock');
expect(result.provider.noExternalCalls).toBe(true);
expect(BlogFormulaSetV2Schema.parse(result.output)).toBeTruthy();
expect(result.provider.callId).toBe('SL-F1');
```

Also assert `safeMockBlogFormulaProvider.ts` does not import
`../../ai/openaiClient` or `openai/helpers/zod`.

- [ ] **Step 2: Run RED**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Provider.test.ts
```

Expected: FAIL because provider files do not exist.

- [ ] **Step 3: Implement provider contract**

Suggested type shape:

```ts
export type BlogFormulaV2ProviderMode = 'deterministic' | 'safe_mock' | 'openai';

export type BlogFormulaV2ProviderProvenance = {
  name: string;
  mode: BlogFormulaV2ProviderMode;
  model: string;
  callId: 'SL-F1';
  promptShapeVersion: 'blog_formula_v2_extraction_input.v1';
  noExternalCalls: boolean;
};

export type BlogFormulaV2ExtractInput = {
  store: {
    id: string;
    name: string | null;
    category: string | null;
    address: string | null;
  };
  ownerBlogPosts: OwnerBlogPostV2[];
};

export type BlogFormulaV2ProviderResult = {
  output: BlogFormulaSetV2;
  provider: BlogFormulaV2ProviderProvenance;
  inputBudget?: unknown;
  promptInput?: unknown;
};

export type BlogFormulaV2Provider = {
  name: string;
  mode: BlogFormulaV2ProviderMode;
  model: string;
  extractFormula(input: BlogFormulaV2ExtractInput): Promise<BlogFormulaV2ProviderResult>;
  getLastAuditMetadata?: () => LlmCallAuditMetadata | null;
};
```

Move/export the current deterministic formula builder so the safe mock provider
can reuse it. Do not change the formula schema.

- [ ] **Step 4: Run GREEN**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Provider.test.ts
```

Expected: PASS for safe mock provider tests.

## Task 4: Add OpenAI Formula Provider

**Files:**

- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/openAIBlogFormulaProvider.ts`
- Modify: `poc-server/test/blogFormulaV2Provider.test.ts`

- [ ] **Step 1: Write RED OpenAI provider tests with fake client**

Use an injected fake parse client; do not require real keys.

Assertions:

- calls `client.beta.chat.completions.parse`
- request uses `response_format` name `store_learning_blog_formula_v2`
- parsed output is validated through `BlogFormulaSetV2Schema`
- provider metadata has `mode = "openai"`, `callId = "SL-F1"`,
  `noExternalCalls = false`
- `getLastAuditMetadata()` includes prompt input, response format summary,
  raw requested JSON, raw parsed output, normalized output, and duration
- provider sanitizes errors through existing `sanitizedProviderError`

- [ ] **Step 2: Run RED**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Provider.test.ts -t "OpenAI"
```

Expected: FAIL because `openAIBlogFormulaProvider.ts` does not exist.

- [ ] **Step 3: Implement OpenAI provider**

Follow the existing style in:

```text
poc-server/src/storeLearning/blog/openAIBlogProvider.ts
poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts
```

Use:

```ts
zodResponseFormat(BlogFormulaSetV2Schema, 'store_learning_blog_formula_v2')
```

Use the `SL-F1` system prompt from this plan. Build the user prompt with
`buildBlogFormulaV2PromptInput`. Store audit metadata in the provider instance.

- [ ] **Step 4: Run GREEN**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Provider.test.ts
```

Expected: PASS.

## Task 5: Add Provider Factory And Route Contract

**Files:**

- Create: `poc-server/src/storeLearning/blogFormulaV2/providers/providerFactory.ts`
- Modify: `poc-server/src/storeLearning/routes/blogFormulaV2.ts`
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`
- Test: `poc-server/test/blogFormulaV2Api.test.ts`
- Test: `poc-server/test/blogFormulaV2Services.test.ts`

- [ ] **Step 1: Write RED API/service tests**

Cover:

- `POST /extract` with no body preserves existing deterministic behavior.
- `POST /extract` with `{ "providerMode": "safe_mock" }` returns provider
  provenance and writes provider provenance to
  `v2_blog_formula_runs.input_json` or `output_json`.
- `POST /extract` with `{ "providerMode": "openai" }` uses an injected fake
  provider/client in tests and writes `model` from the OpenAI provider.
- explicit `openai` without an available client returns a clear server error
  and does not fall back to mock.
- V2 extraction still does not write to `marketing_rulesets` or
  `ruleset_fields`.

- [ ] **Step 2: Run RED**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts -t "providerMode|OpenAI|safe_mock"
```

Expected: FAIL.

- [ ] **Step 3: Implement route/service**

Add body schema:

```ts
const ExtractFormulaBodySchema = z.object({
  providerMode: z.enum(['deterministic', 'safe_mock', 'openai', 'auto']).optional()
});
```

Make `POST /extract` async. Keep missing `providerMode` mapped to the current
deterministic path for backward compatibility. For provider-backed modes, pass
the selected provider into the service and persist:

```json
{
  "provider": {
    "name": "...",
    "mode": "...",
    "model": "...",
    "callId": "SL-F1",
    "promptShapeVersion": "blog_formula_v2_extraction_input.v1",
    "noExternalCalls": true
  }
}
```

In failed OpenAI extraction, create a `v2_blog_formula_runs` row with
`formula_set_id = null`, `status = "failed"`, sanitized `validation_json`, and
provider provenance. Do not create a formula set on failed output.

- [ ] **Step 4: Run GREEN**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts
```

Expected: PASS.

## Task 6: Record SL-F1 Audit Logs

**Files:**

- Modify: `poc-server/src/storeLearning/llmAudit/llmAuditRecorder.ts`
- Modify: `poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`
- Test: `poc-server/test/blogFormulaV2Api.test.ts`

- [ ] **Step 1: Write RED audit tests**

Cover:

- OpenAI extraction creates one `llm_audit_logs` row.
- `related_entity_type = "v2_blog_formula_run"`.
- `related_entity_id` is the created `v2_blog_formula_runs.id`.
- `action = "blog_formula_v2_extract"`.
- `prompt_input_json`, `raw_requested_json`, `raw_parsed_output_json`, and
  `normalized_output_json` are populated.
- `safe_mock` extraction does not create `llm_audit_logs`.

- [ ] **Step 2: Run RED**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Api.test.ts -t "SL-F1 audit"
```

Expected: FAIL because the audit recorder type does not yet accept
`v2_blog_formula_run`.

- [ ] **Step 3: Implement audit recording**

Extend `RecordLlmAuditLogInput.relatedEntityType` with:

```ts
'v2_blog_formula_run'
```

Call `recordLlmAuditLog` only after the `v2_blog_formula_runs` row exists, so
the audit log can reference the run ID. The recorder already ignores non-OpenAI
providers.

- [ ] **Step 4: Run GREEN**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Api.test.ts -t "SL-F1 audit"
```

Expected: PASS.

## Task 7: Demo And Optional UI

**Files:**

- Modify: `poc-server/src/demoBlogFormulaV2.ts`
- Modify only if UI changes: `web/blog_formula_v2.js`
- Modify only if UI changes: `web/07_마케팅전략룰셋.html`
- Test: `poc-server/test/blogFormulaV2Demo.test.ts`
- Test only if UI changes: `poc-server/test/blogFormulaV2Page.test.ts`

- [ ] **Step 1: Keep demo no-key safe**

Add env support:

```text
BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock
BLOG_FORMULA_V2_PROVIDER_MODE=openai
BLOG_FORMULA_V2_PROVIDER_MODE=auto
```

Default demo mode should remain no-key safe. Do not require a live OpenAI key
for the normal demo test.

- [ ] **Step 2: Optional UI selector**

If UI is changed, add only a compact V2-local provider selector/status line in
the `블로그 작성 포뮬라` tab. Browser code must still call only:

```text
/api/stores/:storeId/v2/blog-formula/extract
```

No external URL fetches, no keys, no provider SDK code in browser JS.

- [ ] **Step 3: Run demo/page tests**

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Demo.test.ts test/blogFormulaV2Page.test.ts
```

Expected: PASS.

## Task 8: Documentation

**Files:**

- Modify: `docs/codex/LLM_CALL_STRUCTURES.md`
- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/PLAN.md`
- Modify: `docs/codex/VALIDATION.md`
- Modify: `docs/BLOG_FORMULA_V2_HANDOFF.md`

- [ ] **Step 1: Update LLM call inventory**

Add `SL-F1` only after implementation exists:

```text
SL-F1 | Structured formula extraction | Blog Formula V2 |
POST /api/stores/:storeId/v2/blog-formula/extract with providerMode=openai |
client.beta.chat.completions.parse | BlogFormulaSetV2Schema
```

Document prompt input shape, system prompt, audit log behavior, and the
no-browser-provider boundary.

- [ ] **Step 2: Update handoff and validation**

Record:

- branch
- PR URL
- RED/GREEN evidence
- exact validation commands
- whether live OpenAI smoke was skipped or run
- `.DS_Store` exclusion
- no V1 table writes

## Suggested Validation Commands

Run from the repo root unless noted:

```bash
cd poc-server
npm test -- --run test/blogFormulaV2Prompt.test.ts test/blogFormulaV2Provider.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Demo.test.ts test/blogFormulaV2Page.test.ts
npm run typecheck
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-openai-provider.sqlite BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock npm run demo:blog-formula-v2
npm test
cd ..
node --check web/blog_formula_v2.js
node --check web/ruleset_editor.js
git diff --check
```

Optional live OpenAI smoke, only when the user explicitly wants it and a
server-side `OPENAI_API_KEY` is configured:

```bash
cd poc-server
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-openai-live.sqlite BLOG_FORMULA_V2_PROVIDER_MODE=openai npm run demo:blog-formula-v2
```

If UI changes, run a local browser smoke against:

```text
http://127.0.0.1:5180/07_마케팅전략룰셋.html?storeId=store_1020864025
```

Confirm:

- V2 tab loads.
- provider selector/status stays inside V2 tab.
- safe mock extraction works without keys.
- OpenAI extraction is opt-in and server-side only.
- Top 3 retrieval, deterministic draft generation, and validation still work.
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
- docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_OPENAI_FORMULA_PROVIDER_PLAN.md

현재 상태:
- Blog Formula V2 deterministic lane은 PR #48로 `develop`에 merge/검증 완료.
- 기존 V2는 독립 실험 레인이며 V1 `marketing_rulesets` / `ruleset_fields`를 쓰지 않음.
- 기존 V2에는 deterministic formula/retrieval/draft/validation은 있지만, OpenAI로 실제 포뮬라를 받아오는 SL-F1 provider/prompt/audit 구조는 아직 없음.
- `docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_SAFE_MOCK_INTEGRATION_PLAN.md`는 superseded 되었고 새 계획은 `NEXT_SESSION_BLOG_FORMULA_V2_OPENAI_FORMULA_PROVIDER_PLAN.md`.
- `develop == origin/develop`이어야 함.
- 기준 HEAD는 `a36ca0b docs: hand off blog formula v2 safe mock plan` 이후 최신 `develop`.
- PR #48 merge commit은 `c8f1b52`.
- `.DS_Store`는 modified 상태로 남아 있음. 절대 stage/commit/push에 포함하지 말 것.
- `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`, old Event-to-Operation 파일은 건드리지 말 것.
- browser-side Naver/OpenAI/provider 호출 추가 금지.
- LLM/OpenAI 호출은 반드시 `poc-server` 서버 경유.
- 이번 작업에서는 Naver 호출을 추가하지 말 것.
- 이번 작업에서는 Hybrid/combined V1+V2 생성 레인을 만들지 말 것.
- 이번 작업에서는 OpenAI V2 draft generation까지 넓히지 말고, Blog Formula V2 formula extraction만 OpenAI provider로 추가할 것.

이번 세션 목표:
1. `pwd`, 현재 브랜치, `git status --short --branch`로 `develop == origin/develop` 및 `.DS_Store` 제외 상태 재확인.
2. `docs/codex/NEXT_SESSION_BLOG_FORMULA_V2_OPENAI_FORMULA_PROVIDER_PLAN.md`를 기준으로 새 브랜치 `codex/blog-formula-v2-openai-formula-provider` 생성.
3. TDD로 Blog Formula V2 SL-F1 prompt input builder를 추가.
4. Blog Formula V2 server-side provider boundary를 추가하고 `safe_mock` provider를 먼저 붙임.
5. `openai` formula extraction provider를 추가하되, browser-side 호출 없이 `poc-server`에서만 `client.beta.chat.completions.parse`를 사용.
6. OpenAI provider는 `BlogFormulaSetV2Schema` / `zodResponseFormat(..., "store_learning_blog_formula_v2")`로 schema-validated output만 저장.
7. `POST /api/stores/:storeId/v2/blog-formula/extract`에 optional `providerMode`를 추가:
   - missing/`deterministic`: 기존 deterministic 동작 유지
   - `safe_mock`: 외부 호출 없는 provider path
   - `openai`: 명시적 OpenAI 호출, 키/클라이언트 없으면 mock으로 조용히 fallback하지 말고 실패
   - `auto`: 키가 있으면 openai, 없으면 safe_mock
8. OpenAI 추출은 `llm_audit_logs`에 `related_entity_type = "v2_blog_formula_run"`, `action = "blog_formula_v2_extract"`로 기록.
9. 실패한 OpenAI 추출은 V2 run에 `status = "failed"`와 sanitized validation/error metadata를 남기고 formula set은 만들지 말 것.
10. V2는 계속 `v2_` 테이블만 사용하고 V1 `marketing_rulesets` / `ruleset_fields`를 쓰거나 수정하지 말 것.
11. 기존 deterministic V2 retrieval/draft/validation 동작과 테스트를 깨지 말 것.
12. 검증:
   - `cd poc-server && npm test -- --run test/blogFormulaV2Prompt.test.ts test/blogFormulaV2Provider.test.ts test/blogFormulaV2Api.test.ts test/blogFormulaV2Services.test.ts test/blogFormulaV2Demo.test.ts test/blogFormulaV2Page.test.ts`
   - `cd poc-server && npm run typecheck`
   - `STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-openai-provider.sqlite BLOG_FORMULA_V2_PROVIDER_MODE=safe_mock npm run demo:blog-formula-v2`
   - `cd poc-server && npm test`
   - `node --check web/blog_formula_v2.js`
   - `node --check web/ruleset_editor.js`
   - `git diff --check`
   - UI 변경 시 localhost:5180 V2 tab Playwright smoke
13. 완료 시 PR을 `develop` 대상으로 만들고, 완료 리포트에 다음 단계 브리핑 포함.
```
