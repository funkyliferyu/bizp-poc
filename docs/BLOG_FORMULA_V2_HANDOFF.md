# Blog Formula V2 Handoff

Date: 2026-06-12

## Scope

Blog Formula V2 is an independent experimental lane for deterministic blog
writing formula extraction and draft generation.

It does not replace or mutate Store Learning V1:

- no writes to `marketing_rulesets`
- no writes to `ruleset_fields`
- no changes to the SL-A1 analyzer prompt contract
- no browser-side Naver, provider, or OpenAI calls
- no combined V1/V2 generation lane in this first implementation

## Runtime Shape

Backend namespace:

```text
/api/stores/:storeId/v2/blog-formula
```

Implemented endpoints:

```text
GET  /
POST /extract
POST /retrieve-samples
POST /generate-draft
POST /validate-draft
GET  /drafts
GET  /drafts/:draftGenerationId
```

The V2 model label is:

```text
deterministic-blog-formula-v2
```

The only implemented draft generation mode is:

```text
v2_formula
```

## Data Model

V2 persistence uses only `v2_` tables:

```text
v2_blog_formula_sets
v2_blog_formula_runs
v2_blog_formula_source_posts
v2_blog_topic_briefs
v2_blog_retrieval_runs
v2_blog_retrieved_samples
v2_blog_draft_generations
v2_blog_draft_validations
```

There is no comparison table in this first deterministic lane.

## Source Rules

Formula extraction and similar-post retrieval use only collected Blog items
whose metadata has:

```json
{ "sourceKind": "owner_blog_post" }
```

Place visitor reviews and Place profiles are intentionally excluded from V2
style extraction and retrieval.

## UI

`web/07_마케팅전략룰셋.html` now has a separate top tab:

```text
블로그 작성 포뮬라
```

The tab is backed by `web/blog_formula_v2.js`, which calls only the V2
`poc-server` API namespace.

V1 writing-style fields remain under the existing `글쓰기 스타일` tab and keep
using `ruleset_editor.js`.

## Validation Layer

The deterministic validator checks:

- broken Unicode / unexpected script characters
- medical-ad risk phrases such as effect guarantees or no-side-effect claims
- required disclosures: individual differences, possible side effects, and
  clinician consultation
- sample copy overlap warnings
- hardcoded operating-hours warnings
- main keyword placement in title and intro

Validation status is one of:

```text
pass
needs_human_review
failed
```

## Formula Quality Contract

SL-F1's purpose is not a generic marketing summary. The Product Intent
embedded in the SL-F1 prompt states:

- The extracted Formula Set must be a generation-ready writing formula that
  can be directly consumed by the existing V2 deterministic draft generator
  together with a Topic Brief and retrieved owner Blog style examples Top
  1~3.
- The Formula Set must preserve how the store's existing Naver Blog posts are
  written: title construction, intro moves, body development, heading style,
  tone and sentence rhythm, soft CTA pattern, footer/disclaimer pattern, and
  medical safety constraints.

Stored formula sets use schema `formula_v2.1`
(`BLOG_FORMULA_V2_VERSION = 'formula_v2.1'`) with this block structure:

- `titleFormula`: array of slot-based patterns (`{지역키워드}{시술명}` style
  placeholders), each with its own `sourcePostIds`/`confidence`/`status`
- `introFormula` / `bodyFormula` / `footerFormula`: writing-move `sequence`
  arrays describing how the section unfolds
- `headingFormula`: array of subheading `patterns`
- `toneAndMannerFormula`: persona, style, `preferredPhrases`, `endingStyle`,
  `empathyPatterns`, and `emojiPolicy` (reusable sentence habits, not generic
  adjectives)
- `ctaFormula`: `primaryStyle`, `softPatterns` (soft decision-guide CTA), and
  `hardReservationAllowed`
- `medicalSafetyFormula`: `bannedClaims` vs `requiredDisclosures` plus
  `reviewUsagePolicy`

`parseStoredBlogFormulaV2` (`poc-server/src/storeLearning/blogFormulaV2/types.ts`)
safe-parses `formula_v2.1` and upgrades legacy `formula_v2.0` stored formula
sets on read, so older rows keep working with the current draft generator.

`evaluateBlogFormulaV2Quality`
(`poc-server/src/storeLearning/blogFormulaV2/formulaQuality.ts`) runs after
extraction and flags issues such as empty/non-slot-based title patterns,
intro/body sequences that are too short, missing tone sentence habits, empty
CTA soft patterns, and vague stock phrases (e.g. "정보 제공 중심", "친근한
톤"). The result is stored as `qualityIssues` inside
`v2_blog_formula_runs.validation`, alongside the existing
`needs_human_review` status — extraction is not blocked, but reviewers can see
exactly which blocks fell short of the contract.

`generateBlogFormulaV2Draft`
(`poc-server/src/storeLearning/blogFormulaV2/blogFormulaV2Service.ts`) now
reads the parsed formula set directly: it fills `titleFormula` slot patterns
from the Topic Brief, inserts a `toneAndMannerFormula.preferredPhrases` entry,
appends a `ctaFormula.softPatterns` entry to the CTA paragraph, and ensures
`medicalSafetyFormula.requiredDisclosures` are present in the disclosure line.
`styleComplianceReport.appliedBlocks` and `safetyCheck.requiredDisclosures`
are derived from the formula set rather than hardcoded.

End-to-end coverage for this contract — extract → retrieve samples → generate
draft → validate, for both `safe_mock` and OpenAI (fake client) providers, plus
a V1-table-isolation check — lives in
`poc-server/test/blogFormulaV2RoundTrip.test.ts`.

## Demo

Run with a temp DB when validating without mutating local data:

```bash
cd poc-server
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-demo.sqlite npm run demo:blog-formula-v2
```

The demo seeds mock owner Blog posts only when the target store has no usable
owner Blog sources.

## OpenAI Formula Provider With Safe Mock Fallback

PR #49 merged this server-side provider boundary to `develop` as `c76c052` and
post-merge develop validation passed.

The extraction provider modes are:

- missing/`deterministic`: existing deterministic V2 extraction
- `safe_mock`: provider-shaped path with no external calls
- `openai`: server-side OpenAI SL-F1 formula extraction only
- `auto`: OpenAI when `OPENAI_API_KEY` exists server-side, otherwise
  `safe_mock`

The OpenAI path uses:

```text
BlogFormulaSetV2Schema
zodResponseFormat(..., "store_learning_blog_formula_v2")
llm_audit_logs.related_entity_type = "v2_blog_formula_run"
llm_audit_logs.action = "blog_formula_v2_extract"
```

Failure behavior:

- explicit `openai` does not fall back to mock when the server-side client is
  unavailable
- invalid OpenAI output creates a failed `v2_blog_formula_runs` row
- failed OpenAI output does not create a formula set

Still out of scope:

- Naver calls
- OpenAI V2 draft generation
- browser-side provider calls
- Hybrid or combined V1/V2 generation
- V2 writes to `marketing_rulesets` or `ruleset_fields`

## Provider Comparison On Real Owner Posts

Run with a snapshot copy of the real DB so local data is never mutated:

```bash
sqlite3 poc-server/data/store-learning.sqlite "VACUUM INTO '/tmp/bizp-blog-formula-v2-comparison.sqlite'"
cd poc-server
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-comparison.sqlite \
BLOG_FORMULA_V2_STORE_ID=store_1020864025 \
npm run compare:blog-formula-v2
```

The runner (`poc-server/src/compareBlogFormulaV2Providers.ts`, report builder
`providerComparison.ts`) extracts a formula set in `deterministic`,
`safe_mock`, and `openai` modes against the same store, evaluates each with
`evaluateBlogFormulaV2Quality`, prints a JSON summary, and writes a markdown
report (default `/tmp/blog-formula-v2-provider-comparison.md`). It does not
seed mock posts — it fails fast if the store has no real
`owner_blog_post` items. The `openai` mode is recorded as skipped when no
server-side key is available.

2026-06-13 run on `store_1020864025` (테라스의원, 50 real owner posts):

- `deterministic` / `safe_mock`: shared generation-ready mock formula,
  0 quality issues each (expected — same `buildGenerationReadyMockFormula`).
- `openai` (`gpt-4o-mini`, live): schema-valid `blog_formula_v2.1` output on
  the first attempt. 4 slot-based title patterns derived from real titles.
  All 8 blocks `confirmed` (confidence 0.75-0.9). The quality evaluator
  flagged 1 real issue: `body_sequence_too_short` (3 writing moves, and the
  moves were on the generic side), demonstrating the 13f contract catches
  genuine weaknesses in live output.
- The live run wrote a completed `llm_audit_logs` row
  (`action = "blog_formula_v2_extract"`) and recorded `qualityIssues` in
  `v2_blog_formula_runs.validation`.

Recommended next product follow-up if the user wants another V2 iteration:

- decide whether V2 formula extraction should become reviewer-facing in the UI
  or remain API/demo-only for one more iteration
- consider whether `body_sequence_too_short`-class issues should trigger an
  automatic re-extraction prompt hint or stay reviewer-facing only
