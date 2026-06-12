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

## Demo

Run with a temp DB when validating without mutating local data:

```bash
cd poc-server
STORE_LEARNING_DB_PATH=/tmp/bizp-blog-formula-v2-demo.sqlite npm run demo:blog-formula-v2
```

The demo seeds mock owner Blog posts only when the target store has no usable
owner Blog sources.

## OpenAI Formula Provider With Safe Mock Fallback

Branch `codex/blog-formula-v2-openai-formula-provider` adds the server-side
provider boundary for formula extraction:

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

Recommended next step after this PR is merged and validated on `develop`:

- compare deterministic, safe_mock, and OpenAI formula outputs on real owner
  Blog fixtures
- decide whether V2 formula extraction should become reviewer-facing in the UI
  or remain API/demo-only for one more iteration
