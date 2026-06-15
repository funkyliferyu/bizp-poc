# Blog Formula V2 OpenAI Draft Generation Plan (13h)

Date: 2026-06-14
Branch: `codex/blog-formula-v2-openai-draft` (from validated `develop`
at `e010c9a docs: record blog formula v2 provider comparison develop
validation`)

## Goal

Make the V2 lane generate a real OpenAI-written blog draft end to end. Add an
OpenAI-backed `generate-draft` path (new `SL-G1` LLM call) that consumes the
extracted `formula_v2.1` formula set + retrieved owner-blog samples (Top 1~3)
+ the topic brief, and produces a draft that is still validated by the
existing deterministic `validate-draft` gate.

This is the user-approved next milestone (approved 2026-06-13, restated in
`docs/codex/PLAN.md` next-todo #3 and `docs/codex/HANDOFF.md` TASK 13G "Next
execution briefing").

**Strategy (user-stated): build the whole process first, then iterate on
quality.** This session's "done" is a working OpenAI end-to-end draft flow
wired to the V2 tab "초안 생성" button. Prompt/quality tuning is an explicit
follow-up, not part of this milestone.

## Two user decisions baked into this plan (2026-06-13/06-14)

1. **Both compliance reports, side by side (human compares).** The OpenAI
   draft path produces **two** compliance views and persists both:
   - `output.styleComplianceReport` / `output.safetyCheck` / `output.seoCheck`
     = **server-derived authoritative** reports, computed deterministically
     from the formula set + topic brief + the generated text. These stay the
     canonical contract that `validate-draft`, the DB columns, and the
     existing frontend already depend on.
   - `output.modelReportedCompliance` = the **model's self-reported** versions
     of the same three reports, carried through for human comparison only.
   The deterministic path leaves `modelReportedCompliance` null.
   Rationale: a model must not be the source of truth for its own medical-ad
   safety; the server verifies, and the human sees both claims next to each
   other.

2. **Build-first safety gate = persist, then flag.** A generated draft is
   always persisted (`status = 'generated'`); the existing deterministic
   `validate-draft` flags banned phrases / missing disclosures / broken
   unicode as `needs_human_review` or `failed`. We do not block or repair at
   generation time in this milestone. (Provider/transport failures still
   record a `failed` draft-generation row + failed audit row — see Task 5.)

## Existing pattern this mirrors (already on `develop`)

`extract` is the reference implementation; `generate-draft` follows the same
shape one-for-one:

| Concern | `extract` (existing) | `generate-draft` (this plan) |
|---|---|---|
| Prompt builder | `blogFormulaPrompt.ts` (`SL-F1`) | new `blogDraftPrompt.ts` (`SL-G1`) |
| Provider interface | `providers/blogFormulaV2Provider.ts` | new `providers/blogDraftV2Provider.ts` |
| OpenAI provider | `providers/openAIBlogFormulaProvider.ts` | new `providers/openAIBlogDraftProvider.ts` |
| safe_mock provider | `providers/safeMockBlogFormulaProvider.ts` | new `providers/safeMockBlogDraftProvider.ts` |
| Factory | `providers/providerFactory.ts` | new `providers/draftProviderFactory.ts` |
| Service entry | `extractBlogFormulaV2WithProvider` (async) | new `generateBlogFormulaV2DraftWithProvider` (async) |
| Deterministic entry | `extractBlogFormulaV2` (sync) | keep `generateBlogFormulaV2Draft` (sync) |
| Audit | `recordLlmAuditLog`, `related_entity_type = 'v2_blog_formula_run'`, `action = 'blog_formula_v2_extract'` | `related_entity_type = 'v2_blog_draft_generation'`, `action = 'blog_formula_v2_generate_draft'` |
| Response format | `zodResponseFormat(BlogFormulaSetV2Schema, 'store_learning_blog_formula_v2')` | `zodResponseFormat(BlogDraftModelResponseV2Schema, 'store_learning_blog_formula_v2_draft')` |

`recordLlmAuditLog` only writes a row when `provider.mode === 'openai'`, so
`deterministic`/`safe_mock` draft paths leave `llm_audit_logs` untouched, same
as extract.

## Data model (no schema migration)

`v2_blog_draft_generations` already supports this:
- `selected_title` / `blog_draft` are nullable → failure path stores nulls.
- `status` is free text → `'generated'` (success) or `'failed'` (provider error).
- `output_json` holds the full `BlogDraftOutputV2` including the new optional
  `modelReportedCompliance`; no column change needed.

## Contracts

### New OpenAI response schema (model fills this) — `types.ts`

```ts
// What the model is asked to return. Server-only facts (formulaSetId,
// sourcePostIds) are NOT requested from the model.
BlogDraftModelResponseV2Schema = z.object({
  titleCandidates: z.array(z.string()).min(1),
  selectedTitle: z.string(),
  blogDraft: z.string(),
  styleComplianceReport: z.object({ appliedBlocks: z.array(z.string()) }),
  safetyCheck: z.object({
    requiredDisclosures: z.array(z.string()),
    bannedPhrasesAvoided: z.boolean()
  }),
  seoCheck: z.object({
    mainKeywordInTitle: z.boolean(),
    mainKeywordInIntro: z.boolean(),
    secondaryKeywordsUsed: z.array(z.string())
  })
})
```

### Extend `BlogDraftOutputV2Schema` (canonical, unchanged top-level) — `types.ts`

Add one optional, nullable field; everything else stays identical so the
frontend, validator, and round-trip test keep working:

```ts
modelReportedCompliance: z
  .object({
    styleComplianceReport: z.object({ appliedBlocks: z.array(z.string()) }),
    safetyCheck: z.object({
      requiredDisclosures: z.array(z.string()),
      bannedPhrasesAvoided: z.boolean()
    }),
    seoCheck: z.object({
      mainKeywordInTitle: z.boolean(),
      mainKeywordInIntro: z.boolean(),
      secondaryKeywordsUsed: z.array(z.string())
    })
  })
  .nullable()
  .optional()
```

### Server-derived report helpers — `blogFormulaV2Service.ts`

Refactor the current monolithic `buildDraftOutput` into reusable pieces so the
deterministic and OpenAI paths share one source of truth for the authoritative
reports:

- `buildDeterministicDraftCreative(formula, topicBrief, samples)` →
  `{ titleCandidates, selectedTitle, blogDraft }` (today's `buildDraftOutput`
  creative logic, extracted unchanged).
- `deriveDraftReports({ formulaSetId, formula, topicBrief, samples,
  selectedTitle, blogDraft })` →
  `{ styleComplianceReport, safetyCheck, seoCheck }`:
  - `styleComplianceReport`: `{ formulaSetId, sourcePostIds (from samples),
    appliedBlocks }`.
  - `safetyCheck`: `requiredDisclosures` from
    `formula.medicalSafetyFormula.requiredDisclosures`;
    `bannedPhrasesAvoided` is now **actually computed** by scanning
    `selectedTitle + blogDraft` against `formula.medicalSafetyFormula.
    bannedClaims` (today it is hardcoded `true`). This makes the server-derived
    report trustworthy and gives the human something real to compare against
    the model's claim.
  - `seoCheck`: computed from the real text (mainKeyword in title, mainKeyword
    in first paragraph, which secondary keywords actually appear).
- `assembleDraftOutput(creative, reports, modelReportedCompliance?)` → parse
  through `BlogDraftOutputV2Schema`.

Deterministic `generateBlogFormulaV2Draft` keeps its current behavior:
`creative = buildDeterministicDraftCreative(...)`,
`reports = deriveDraftReports(...)`, `modelReportedCompliance = null`. Its
externally observed output is unchanged except `bannedPhrasesAvoided` is now
derived rather than constant `true`, and the new nullable field is present.

## Tasks (TDD: RED → GREEN per task)

All new tests use `vitest`, an in-memory DB, the existing
`seedBlogFormulaV2Fixture`, and an injected **fake OpenAI client**
(`beta.chat.completions.parse`) exactly like
`test/blogFormulaV2RoundTrip.test.ts` and the existing openai-formula tests.
No real OpenAI calls in the test suite.

### Task 0: Branch + ledger registration

- [ ] Branch `codex/blog-formula-v2-openai-draft` from `develop` (`e010c9a`).
- [ ] Add this plan doc; register 13h in `docs/codex/PLAN.md` ledger as
  `Planned` and add next-todo entry.
- [ ] Commit `docs: plan blog formula v2 openai draft generation`.

### Task 1: Draft prompt builder (`blogDraftPrompt.ts`)

**Files:** create `src/storeLearning/blogFormulaV2/blogDraftPrompt.ts`,
create `test/blogFormulaV2DraftPrompt.test.ts`.

- Exports `BLOG_FORMULA_V2_DRAFT_CALL_ID = 'SL-G1'`,
  `BLOG_FORMULA_V2_DRAFT_PROMPT_SCHEMA_VERSION =
  'blog_formula_v2_draft_input.v1'`,
  `BLOG_FORMULA_V2_DRAFT_RESPONSE_FORMAT_NAME =
  'store_learning_blog_formula_v2_draft'`.
- `buildBlogFormulaV2DraftPromptInput({ store, formula, topicBrief, samples,
  options? })` → `{ promptInput, metadata }`. `promptInput` includes: task,
  schemaVersion, outputSchemaRef, `productIntent` (apply the writing formula
  to write a NEW post, do not copy samples), generation instructions, quality
  + medical-safety requirements (banned-vs-required disclosures, soft CTA,
  slot-based title, intro/body move sequences), `storeProfile`, the
  `formula` set, the `topicBrief`, and the `samples` (rank, title, whySelected,
  budgeted `bodyText`).
- Budget defaults mirror the extraction builder (e.g. max 3 samples, per-sample
  body cap, aggregate body cap, serialized prompt-char cap); `metadata`
  records sample count, truncation, and a `promptBudgetReason`.
- Tests: schemaVersion/callId constants; formula + brief + samples present;
  long sample bodies truncated and flagged in metadata; sample count capped.

### Task 2: Schemas + server-derived report helpers (`types.ts`, service)

**Files:** modify `src/storeLearning/blogFormulaV2/types.ts`,
modify `blogFormulaV2Service.ts`, create
`test/blogFormulaV2DraftReports.test.ts`.

- Add `BlogDraftModelResponseV2Schema`; extend `BlogDraftOutputV2Schema` with
  optional/nullable `modelReportedCompliance` (contracts above).
- Refactor `buildDraftOutput` into `buildDeterministicDraftCreative` +
  `deriveDraftReports` + `assembleDraftOutput`; rewire deterministic
  `generateBlogFormulaV2Draft` to use them.
- Tests: `deriveDraftReports` sets `bannedPhrasesAvoided = false` when a banned
  claim appears in the draft and `true` otherwise; `seoCheck` reflects real
  title/intro/keyword presence; deterministic `generateBlogFormulaV2Draft`
  output still schema-valid with `modelReportedCompliance` null.

### Task 3: Draft provider interface + OpenAI provider

**Files:** create `providers/blogDraftV2Provider.ts`,
create `providers/openAIBlogDraftProvider.ts`,
create `test/openAIBlogDraftProvider.test.ts`.

- Interface `BlogDraftV2Provider`:
  - `generateDraft(input: { store, formula, topicBrief, samples })` →
    `{ creative: { titleCandidates, selectedTitle, blogDraft },
       modelReportedCompliance, provider (provenance), inputBudget,
       promptInput }`.
  - optional `getLastAuditMetadata()` (for `recordLlmAuditLog`).
  - provenance: `callId = 'SL-G1'`, `mode`, `model`,
    `promptShapeVersion`, `noExternalCalls`.
- `createOpenAIBlogDraftV2Provider({ client?, model? })`: builds the prompt via
  Task 1, calls `client.beta.chat.completions.parse` with
  `zodResponseFormat(BlogDraftModelResponseV2Schema, ...)`, parses the result,
  splits it into `creative` + `modelReportedCompliance`, and captures
  `lastAuditMetadata` (request/response timestamps, prompt input, response
  format summary, raw + parsed output, sanitized error) exactly like
  `openAIBlogFormulaProvider`. Default model `process.env.OPENAI_MODEL ??
  'gpt-4o-mini'`.
- Tests (fake client): returns creative + modelReportedCompliance; populates
  audit metadata; throws and records error metadata on invalid model output;
  throws when the client is unavailable.

### Task 4: safe_mock provider + factory

**Files:** create `providers/safeMockBlogDraftProvider.ts`,
create `providers/draftProviderFactory.ts`,
create `test/blogDraftProviderFactory.test.ts`.

- `createSafeMockBlogDraftV2Provider()`: provider-shaped, `noExternalCalls:
  true`; `creative` from `buildDeterministicDraftCreative`, plus a mock
  `modelReportedCompliance` derived from the same formula (so the comparison
  panel has content without an external call).
- `createBlogDraftV2ProviderForMode(mode, options)` mirroring
  `createBlogFormulaV2ProviderForMode`: `undefined`/`deterministic` → `null`;
  `safe_mock` → safe mock; `openai` → OpenAI provider; `auto` → OpenAI when
  `OPENAI_API_KEY` present else safe_mock. Reuses
  `BlogFormulaV2ProviderFactoryOptions` (`env`, `openAIClient`, `model`).
- Tests: mode→provider mapping incl. `auto` with/without key; safe_mock
  `noExternalCalls`.

### Task 5: Service `generateBlogFormulaV2DraftWithProvider`

**Files:** modify `blogFormulaV2Service.ts`,
create `test/blogFormulaV2GenerateDraftWithProvider.test.ts`.

- New async `generateBlogFormulaV2DraftWithProvider(repos, storeId, input,
  provider)` mirroring `extractBlogFormulaV2WithProvider`:
  - Resolve store, formula set, topic brief, retrieval run + samples (same
    lookups as the deterministic path).
  - `try`: `provider.generateDraft({ store, formula, topicBrief, samples })`;
    `reports = deriveDraftReports(... model.selectedTitle/blogDraft ...)`;
    `output = assembleDraftOutput(creative, reports, modelReportedCompliance)`;
    persist `v2_blog_draft_generations` (`status 'generated'`, `model =
    provider model`, `output_json` = full output, `input_json` includes
    provider provenance + inputBudget); `recordLlmAuditLog({ relatedEntityType:
    'v2_blog_draft_generation', relatedEntityId: draftGeneration.id, provider,
    action: 'blog_formula_v2_generate_draft', status: 'completed', inputBudget,
    parsedOutputJson: output })`; return `{ draftGeneration, output, provider }`.
  - `catch`: persist a `failed` draft-generation row (`selectedTitle`/
    `blogDraft` null, provenance + sanitized error in `output_json`/
    `input_json`); `recordLlmAuditLog({ ..., status: 'failed', errorJson })`;
    rethrow.
- Add `'v2_blog_draft_generation'` to the `relatedEntityType` union in
  `recordLlmAuditLog` (`llmAuditRecorder.ts`).
- Tests (fake openai + safe_mock): persists a `generated` row with
  server-derived reports + `modelReportedCompliance`; writes one
  `llm_audit_logs` row with the new entity type/action **only** for openai;
  invalid model output → `failed` row + failed audit row + throw; asserts
  `marketing_rulesets`/`ruleset_fields` unchanged (V1 isolation).

### Task 6: Route wiring

**Files:** modify `routes/blogFormulaV2.ts`,
create/extend `test/blogFormulaV2Routes*.test.ts` (or the existing route test).

- Add optional `providerMode` to `GenerateDraftBodySchema`
  (`'deterministic' | 'safe_mock' | 'openai' | 'auto'`).
- `/generate-draft` handler becomes `async`: build a draft provider via
  `createBlogDraftV2ProviderForMode(body.providerMode, providerFactoryOptions)`;
  if `null` → existing sync `generateBlogFormulaV2Draft`; else `await
  generateBlogFormulaV2DraftWithProvider(...)`.
- Pass `providerFactoryOptions` (already on the routes factory) to the draft
  factory too.
- Tests (supertest-style with injected fake client): `providerMode: 'openai'`
  returns `output` + `modelReportedCompliance`; no `providerMode` preserves the
  deterministic response shape.

### Task 7: Frontend — "초안 생성" button + overlay + comparison panel

**Files:** modify `web/blog_formula_v2.js`,
modify `web/07_마케팅전략룰셋.html`, extend the V2-tab page test.

- Generalize the existing overlay helpers so they can show a draft title too:
  give the overlay title element an id (`v2OverlayTitle`); add
  `showProgressOverlay({ title, status, buttonId })` /
  `hideProgressOverlay({ buttonId })`; keep `extract` using it (title "AI가
  블로그 포뮬라를 추출하는 중") and have draft use it (title "AI가 블로그
  초안을 생성하는 중", disables `#v2GenerateButton`, ~30–60s note). Reuse the
  same `#v2ExtractOverlay` element (it already covers the whole card).
- `generateBlogFormulaV2Draft()` POSTs `{ formulaSetId, topicBriefId,
  retrievalRunId, providerMode: 'openai' }`, shows the overlay during the call,
  sets the "생성 모델" / "초안 상태" stats from the response, renders the draft,
  and renders the new compliance comparison.
- Add a "컴플라이언스 비교 (모델 자가보고 vs 서버 검증)" panel
  (`#v2DraftCompliancePanel`) under the draft preview; `renderComplianceComparison(output)`
  shows `output.modelReportedCompliance` next to the server-authoritative
  `output.styleComplianceReport`/`safetyCheck`/`seoCheck` (handles the
  deterministic null case gracefully).
- Tests: page test asserts the generate button, the (now id'd) overlay title,
  and the comparison panel markup exist; `node --check web/blog_formula_v2.js`.

### Task 8: End-to-end round-trip coverage

**Files:** extend `test/blogFormulaV2RoundTrip.test.ts`.

- Add a case: extract (safe_mock or fake-openai) → retrieve-samples →
  `generateBlogFormulaV2DraftWithProvider` (fake-openai + safe_mock) →
  `validate-draft`, asserting the draft persists, `validate-draft` still runs
  as the gate (`status !== undefined`), `modelReportedCompliance` is present,
  and no review/visitor content leaks into style sources.

### Task 9: Docs, full validation, PR

- Add a `## Type SL-G1` section to `docs/codex/LLM_CALL_STRUCTURES.md`
  (purpose, provider, key files, provider modes, response format, system
  prompt, prompt input shape, budgets, audit behavior, the two-report
  comparison contract).
- Update `docs/BLOG_FORMULA_V2_HANDOFF.md` (new OpenAI draft section, endpoint
  note that `generate-draft` now accepts `providerMode`),
  `docs/codex/HANDOFF.md` (new TASK 13H section), `docs/codex/PLAN.md` (13h
  ledger row + next-todo), and `docs/codex/VALIDATION.md`.
- Full validation: focused new V2 tests, then
  `cd poc-server && npm run typecheck`, `npm test`,
  `npm run demo:blog-formula-v2` (temp DB),
  `node --check web/blog_formula_v2.js`, `node --check web/ruleset_editor.js`,
  `git diff --check`.
- Optional live confirmation (only if the user asks) on a `/tmp` snapshot DB:
  drive `/extract` then `/generate-draft {"providerMode":"openai"}` against the
  running server and confirm a `gpt-4o-mini` draft + a completed
  `llm_audit_logs` row (`action = 'blog_formula_v2_generate_draft'`).
- PR to `develop`; record post-merge develop validation.

## Constraints (must hold)

- All OpenAI calls go through `poc-server`; the browser holds no credentials
  and POSTs only to the V2 API namespace.
- V2 writes only to `v2_` tables + `llm_audit_logs`; never touch
  `marketing_rulesets` / `ruleset_fields` (asserted by the round-trip test).
- No Naver calls; no Hybrid/combined V1+V2 generation.
- `.DS_Store` and `docs/.BLOG_FORMULA_V2_HANDOFF.md.swp` stay unstaged.
- `admin/`, `pc-web/`, `README_POC.md`, `web/event_operation_poc.html`
  untouched.
- No `develop` -> `main` promotion (milestone 14, user-gated on publication).

## Out of scope (this milestone)

- Prompt/quality tuning of the OpenAI draft (explicit follow-up after the
  process works end to end).
- Any generation-time repair/retry or auto-rewrite loop.
- Hybrid/combined V1+V2 generation.
- OpenAI provider for `retrieve-samples` or `validate-draft` (stay
  deterministic).
- `develop` -> `main` promotion.
