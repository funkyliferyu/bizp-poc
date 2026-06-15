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

The "포뮬라 추출" button POSTs `{ providerMode: 'openai' }` to `/extract`, so
it runs the live server-side OpenAI SL-F1 lane (not the instant deterministic
path). Because a live call takes ~30-60s, the tab shows a progress overlay
(`#v2ExtractOverlay`) with a spinner and elapsed-time counter while the call
is in flight, and surfaces the returned model in the "생성 모델" stat. The
browser holds no provider credentials; the call goes through `poc-server`.

The "V2 초안 생성" button POSTs `{ ..., providerMode: 'openai' }` to
`/generate-draft`, running the live server-side OpenAI SL-G1 draft lane. It
reuses the same progress overlay (now generalized via
`showProgressOverlay`/`hideProgressOverlay` with an id'd `#v2OverlayTitle`),
disables the generate button while in flight, and surfaces the draft model in
the "생성 모델" stat. A "컴플라이언스 비교 (모델 자가보고 vs 서버 검증)" panel
(`#v2DraftCompliancePanel`) renders the model self-report next to the
server-derived authoritative report so a human can compare them.

On page load `renderPayload` re-renders the latest persisted draft, its
compliance comparison, and the latest validation — so a reloaded page shows the
same panels as right after generating. Previously `renderPayload` rendered only
the draft, so the compliance panel kept its placeholder after a reload. When the
latest draft has not been validated yet, the validation panel shows a "run
초안 검수" prompt instead of the bare "검수 결과가 없습니다." text (validation
stays a separate, deterministic, manual step — it is not auto-run on load).

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
- self-introduction opener mismatch against the store's known greeting
  patterns (see "Self-Introduction Pattern Library" below)

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

## OpenAI Draft Generation (SL-G1)

`POST /generate-draft` now accepts an optional `providerMode`
(`deterministic` | `safe_mock` | `openai` | `auto`), mirroring `/extract`:

- missing/`deterministic`: existing deterministic V2 draft generation
- `safe_mock`: provider-shaped path with no external calls
- `openai`: server-side OpenAI SL-G1 draft generation only
- `auto`: OpenAI when `OPENAI_API_KEY` exists server-side, otherwise `safe_mock`

The OpenAI path uses:

```text
BlogDraftModelResponseV2Schema
zodResponseFormat(..., "store_learning_blog_formula_v2_draft")
llm_audit_logs.related_entity_type = "v2_blog_draft_generation"
llm_audit_logs.action = "blog_formula_v2_generate_draft"
```

The draft provider only generates the creative content (`titleCandidates`,
`selectedTitle`, `blogDraft`) plus its own self-reported compliance. The server
then derives the authoritative `styleComplianceReport` / `safetyCheck` /
`seoCheck` from the formula set + topic brief + generated text
(`deriveDraftReports` in `draftOutput.ts`), and persists both:

- `output.styleComplianceReport` / `safetyCheck` / `seoCheck`: server-derived
  authoritative (the existing contract; `safetyCheck.bannedPhrasesAvoided` is
  now actually computed against `medicalSafetyFormula.bannedClaims`).
- `output.modelReportedCompliance`: the model's self-reported versions for
  human comparison (`null` on the deterministic path).

Build-first safety gate: a generated draft is always persisted
(`status = 'generated'`); the deterministic `validate-draft` flags banned
phrases / missing disclosures / broken unicode. Provider/parse failures persist
a `failed` `v2_blog_draft_generations` row (null `selected_title`/`blog_draft`)
plus a failed audit row, and rethrow. No schema migration was required —
`output_json` carries `modelReportedCompliance` and the draft columns are
nullable.

Still out of scope:

- OpenAI `retrieve-samples` / `validate-draft` (stay deterministic)
- prompt/quality tuning of the OpenAI draft (build-first; tuning is follow-up)
- Hybrid or combined V1/V2 generation
- browser-side provider calls
- V2 writes to `marketing_rulesets` or `ruleset_fields`

Manual live confirmation (only when explicitly requested) on a `/tmp` snapshot
DB: drive `/extract` then `/generate-draft {"providerMode":"openai"}` against
the running server and confirm a `gpt-4o-mini` draft plus a completed
`llm_audit_logs` row (`action = "blog_formula_v2_generate_draft"`).

## Self-Introduction Pattern Library

Live `openai` extraction on `store_1020864025` (테라스의원) surfaced a
hallucination: generated drafts opened with "안녕하세요. 😊 테라스 의원의
의료진입니다." — a phrase that never appears in any of the store's 50 real
`owner_blog_post` items. The root cause is that `introFormula.sequence` only
describes abstract writing moves (e.g. "인사 → 주제 제시"), with no concrete
self-introduction text for the draft generator or model to reuse.

`poc-server/src/storeLearning/blogFormulaV2/selfIntroductionPatterns.ts`
discovers the store's *actual* repeating greeting openers from its own post
history and stores them with usage ratios, so generation reuses them
proportionally instead of inventing new ones:

- `analyzeSelfIntroductionPatterns(posts, storeName)` scans each post for an
  opening "안녕하세요" near the store's own name (zero-width-space tolerant —
  Naver's mobile editor pads body text with U+200B/U+200C/U+200D/U+FEFF) and
  classifies it as:
  - `store_director_greeting`: `"안녕하세요. {storeName} 대표원장
    {directorName}입니다."` — director name extracted via
    `(?:대표)?원장\s*([가-힣]{2,4})입니다` (or the reversed `{name} 원장입니다`
    order)
  - `store_name_greeting`: `"안녕하세요. {storeName}입니다."` — fallback when
    no director name is detected
  - Posts with no greeting near the store's name are excluded entirely.
    `usageRatio` is each pattern's share among posts that DO have a
    detectable opener, sorted descending, so the ratios sum to ~1 and the
    first entry is the store's most common opener.
- `fillSelfIntroductionTemplate(pattern, storeName)` fills `{storeName}` /
  `{directorName}` into the template.
- `matchesAnySelfIntroductionPattern(blogDraft, patterns, storeName)` checks
  (whitespace/zero-width-space insensitive) whether a draft's opening
  reproduces one of the filled patterns; returns `true` when `patterns` is
  empty (nothing to constrain against).

Schema (`types.ts`, still `formula_v2.1`): `introFormula` gains
`selfIntroductionPatterns: SelfIntroductionPatternV2[]` (`.default([])`, so
legacy/upgraded/older-stored formulas parse cleanly with `[]`). This field is
always computed server-side from the store's own post history — both
`extractBlogFormulaV2` and `extractBlogFormulaV2WithProvider` overwrite
whatever the deterministic builder or model returns with
`analyzeSelfIntroductionPatterns(posts, store.name)`, since neither can know
real historical ratios.

OpenAI structured outputs reject `.optional()`/`.default()` fields, so
`BlogFormulaSetV2ResponseFormatSchema` (an `introFormula` variant without
`selfIntroductionPatterns`) is used only for `zodResponseFormat` in
`openAIBlogFormulaProvider.ts`; the actual `.parse()` of the model's response
still uses the full `BlogFormulaSetV2Schema`, and the field is overwritten
immediately afterwards regardless.

Draft generation, both paths:

- Deterministic (`buildDeterministicDraftCreative` in `draftOutput.ts`):
  prepends `fillSelfIntroductionTemplate(patterns[0], storeName)` (the
  highest-`usageRatio` pattern) as the first paragraph of `blogDraft`, when
  `selfIntroductionPatterns` is non-empty.
- OpenAI SL-G1 (`blogDraftPrompt.ts`): a new generation instruction tells the
  model to open `blogDraft` with a pattern from
  `formula.introFormula.selfIntroductionPatterns`, chosen with probability
  roughly proportional to its `usageRatio`, filled verbatim as the first
  sentence — never inventing a different self-introduction phrase (e.g.
  generic staff titles such as "의료진입니다").

Validation: `validateBlogFormulaV2DraftText` accepts optional
`selfIntroductionPatterns` / `storeName`; when patterns are non-empty and a
draft's opener matches none of them, it pushes a `self_introduction_pattern_mismatch`
issue (`severity: 'warning'` → overall `needs_human_review`, consistent with
the build-first-then-flag philosophy). `validateBlogFormulaV2Draft` (the
`draftGenerationId` service path) loads the draft's formula set and passes
`formula.introFormula.selfIntroductionPatterns` + `store.name` through; the
ad-hoc (no `draftGenerationId`) path has no formula reference, so the check is
skipped.

Coverage: `poc-server/test/selfIntroductionPatterns.test.ts` (pattern
discovery, template filling, match checking) and the `Self-introduction
pattern library` describe block in `poc-server/test/blogFormulaV2Services.test.ts`
(end-to-end: extraction populates ratios, deterministic draft opens with the
top pattern, validation flags a mismatched opener and passes a matching one).

## Topic Brief Library

To support long-running blog programs, a store needs more than a single
hand-typed "소재 Brief": it needs a reusable library of topic-brief *sets* mined
from its own `owner_blog_post` history, grouped by topic (e.g. for 테라스의원:
리팟레이저 ①/②/③, 인모드 세트, 울쎄라 세트). Each set carries the same fields as
the manual 소재 Brief form, so picking one auto-fills that form and the existing
retrieve-samples → generate-draft → validate-draft flow is unchanged.

Granularity is **1 owner blog post = 1 topic-brief set** (`sourcePostIds` always
holds exactly that one post). Sets are stored one-row-per-post in the new
`v2_blog_topic_brief_sets` table, FK'd to `v2_blog_formula_sets` with
`UNIQUE (formula_set_id, source_post_id)` so a post is never mined twice into the
same formula set. The row mirrors `BlogTopicBriefInput` (topic, mainKeyword,
secondaryKeywords, targetReader, coreConcern, mainAngle, mustInclude, mustAvoid,
ctaDirection) plus `FormulaEvidence` (confidence, status). `TopicBriefSetV2` /
`TopicBriefSetCandidate` (= the same shape minus the persisted `id`) live in
`types.ts`.

Extraction is a dedicated call, **SL-F2** (separate from SL-F1 so the 8-block
formula extraction is untouched and SL-F2 can run repeatedly in batches):

- `topicBriefSetPrompt.ts` — `buildTopicBriefSetV2PromptInput(store, posts)`,
  `BLOG_TOPIC_BRIEF_SET_V2_CALL_ID = 'SL-F2'`, `TOPIC_BRIEF_SET_BATCH_SIZE = 10`,
  per-post body truncation (no character-budget trimming).
- OpenAI path: `providers/openAITopicBriefSetProvider.ts` returns one set per
  post (model echoes each post `id`); the provider keeps only items whose `id`
  is in the batch and tags each with `sourcePostIds:[id]`, `confidence: 0.7`,
  `status: 'candidate'`. Response shape is `TopicBriefSetV2ResponseFormatSchema`
  (no server-only fields, `.nullable()` not `.optional()`), mirroring the
  self-introduction response-format split.
- Deterministic / safe_mock path: `topicBriefSetHeuristic.ts`
  `buildHeuristicTopicBriefSets` derives topic/mainKeyword/secondaryKeywords from
  `store.metadata.representativeKeywords` matched against title/body, with generic
  interpretive defaults, `confidence: 0.4`, `status: 'candidate'`.
- `providers/topicBriefSetProviderFactory.ts`
  `createTopicBriefSetProviderForMode(mode, options)` returns `null` for
  `deterministic`/undefined (the service runs the heuristic inline), the safe_mock
  provider, the OpenAI provider, or auto-by-`OPENAI_API_KEY` — mirroring the
  SL-F1 provider factory.

Batching / extend (`extendBlogFormulaV2TopicBriefSets` in `blogFormulaV2Service.ts`):
loads owner posts (newest-first), computes the set of already-covered
`source_post_id`s for the formula set, takes the next ≤10 uncovered posts,
produces candidates (heuristic when `provider` is null, else the provider),
inserts one row per candidate (skipping any with empty `sourcePostIds`), and
returns `{ added, topicBriefSets, remainingCount }`. `remainingCount` is computed
from the *persisted* distinct `source_post_id` count (`allPosts.length −
coveredAfter`), so it stays correct even when a provider returns fewer or
duplicate sets than the batch — matching `getBlogFormulaV2Payload`'s basis. SL-F2
is intentionally **best-effort and has no audit/run trace of its own**: a provider
error propagates and simply leaves the library partial and retryable, rather than
failing the surrounding formula flow.

Provider-mode reuse: `getTopicBriefSetProviderModeForStore` reads the formula
set's latest run `output.provider.mode` (deterministic runs have no `provider`
field → `undefined` → heuristic), so the "extend" action reuses whatever provider
the original `/extract` used.

Endpoints / payload:

- `POST /extract` populates the **first** batch (≤10) best-effort right after the
  formula set is created, using a topic-brief provider matching the requested
  formula `providerMode`. (Orchestrated in the route, not the service `extract*`
  functions, so the synchronous deterministic `extractBlogFormulaV2` stays
  synchronous and provider construction stays where the factory options live.)
  A first-batch failure is logged (`console.warn`) rather than swallowed
  silently, so an empty library right after extract is diagnosable; it still
  leaves the library empty-but-retryable via the extend route.
- `POST /topic-brief-sets/extend` (body `{ formulaSetId? }`, defaults to latest)
  mines the next batch of 10 by recency, appending/merging — never replacing —
  reusing the original provider mode.
- `GET /` payload gains `topicBriefSets: TopicBriefSetV2[]` and
  `status.topicBriefSetRemainingCount`.

UI (`web/07_마케팅전략룰셋.html` + `web/blog_formula_v2.js`): the 소재 Brief panel
gains a single "토픽 브리프 라이브러리" dropdown (first option "직접 입력", then
one option per set labelled `topic + ①②③ + angle/concern summary`, same-topic
entries numbered client-side) that fills the form via `applyTopicBriefSet` (the
inverse of `topicBriefFromForm`), plus a "더 많은 블로그에서 포뮬라 생성" button
shown while `topicBriefSetRemainingCount > 0` that POSTs to the extend endpoint
and re-renders. The extend action shows the shared progress overlay
(`showProgressOverlay`/`hideProgressOverlay`, spinner + elapsed timer) while it
runs, since the SL-F2 batch can be a slow server-side openai call. When the
library is empty, a `#v2TopicBriefEmptyNotice` element explains that no topic
briefs exist yet and points to the extend button, instead of leaving just an
empty dropdown. A successful `/extract` refreshes the library via
`loadBlogFormulaV2`.

Coverage: `blogFormulaV2TopicBriefSetRepository.test.ts` (table + UNIQUE),
`topicBriefSetSchema.test.ts`, `topicBriefSetPrompt.test.ts`,
`topicBriefSetHeuristic.test.ts` (heuristic + safe_mock provider),
`topicBriefSetOpenAIProvider.test.ts`, `topicBriefSetProviderFactory.test.ts`,
`blogFormulaV2TopicBriefSets.test.ts` (extend batching/append/dedup, the
provider-partial-return `remainingCount` case, payload fields, provider-mode
resolution), and added cases in `blogFormulaV2Api.test.ts` (first batch on
extract + extend endpoint) and `blogFormulaV2Page.test.ts` (dropdown/button +
JS wiring, plus the empty-library notice, the extend progress overlay,
compliance-comparison rendering on load, and the unvalidated-draft validation
prompt).
