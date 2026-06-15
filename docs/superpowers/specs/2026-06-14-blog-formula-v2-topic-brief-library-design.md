# Blog Formula V2 — Topic Brief Library Design

- **Date**: 2026-06-14
- **Status**: Approved (brainstorming)
- **Branch**: `codex/blog-formula-v2-openai-draft`
- **Author**: YeonGeun Ryu (with Claude)

## Problem

Blog Formula V2 currently generates a single draft from a hand-typed "소재 Brief"
form (topic, main keyword, secondary keywords, target reader, core concern, main
angle, must-include, must-avoid, CTA direction). The form defaults are hardcoded
in `web/07_마케팅전략룰셋.html` (주제=리팟레이저 등). This does not scale to a
long-running blog program where one store covers the same topic from many angles.

A store like 테라스의원 has ~50 owner blog posts: ~30 on 리팟레이저/흑자 from
varying angles (재발, 원인, 병원선택, 부작용 …), plus 써마지, 울쎄라, 인모드FX,
리쥬란, etc. The store should be able to pick from a **library of topic-brief
"sets"** mined from its own post history — e.g. 리팟레이저 ①/②/③, 인모드 세트,
울쎄라 세트 — each pre-filled with the brief fields, and feed any one of them into
the existing formula-based draft flow.

## Goals

- Mine a **Topic Brief Library** from the store's own `owner_blog_post` history:
  one `TopicBriefSetV2` per post (1 post = 1 set), grouped by topic in the UI.
- Each set carries the same fields as the existing 소재 Brief form, so selecting
  one auto-fills the form and the **downstream retrieve-samples / generate-draft
  flow is unchanged**.
- Extract interpretive fields (coreConcern / mainAngle / mustInclude / mustAvoid /
  ctaDirection) with OpenAI via a dedicated call (SL-F2); deterministic and
  safe_mock providers use title/keyword heuristics plus generic defaults.
- Process the most-recent **10 posts** on first extraction; allow the user to
  pull additional batches of 10 (by recency) with a "더 많은 블로그에서 포뮬라
  생성" button that **appends/merges** into the existing library, never replaces.
- The extend action **reuses the same provider mode** used for the original
  `/extract` call.

## Non-Goals

- No change to retrieve-samples, generate-draft, or validate-draft behaviour.
- No change to the existing ad-hoc `v2_blog_topic_briefs` table (still written
  per-generation via `createTopicBrief`). The library is a new, separate concern.
- No automatic merging/deduplication of *similar* topics into a single set.
  Grouping/numbering of same-topic entries is presentation-only, done client-side.
- No backfill of topic-brief sets for formula sets created before this feature.

## Data Model

### New type: `TopicBriefSetV2` (`types.ts`)

Built on `FormulaEvidenceSchema` (carries `sourcePostIds`, `confidence`,
`status` like other formula blocks) plus the `BlogTopicBriefInput` fields:

```ts
export const TopicBriefSetV2Schema = FormulaEvidenceSchema.extend({
  id: z.string(),
  topic: z.string(),
  mainKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  targetReader: z.string().nullable(),
  coreConcern: z.string().nullable(),
  mainAngle: z.string().nullable(),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  ctaDirection: z.string().nullable()
});
export type TopicBriefSetV2 = z.infer<typeof TopicBriefSetV2Schema>;
```

`sourcePostIds` always holds exactly one id (the post the set was mined from).

For the OpenAI (SL-F2) `response_format`, a parallel schema **without**
`sourcePostIds`/`confidence`/`status`/`id` is used (the server tags each
candidate with its `sourcePostId` and fills evidence afterwards), mirroring the
`BlogFormulaSetV2ResponseFormatSchema` split already used for self-introduction
patterns. The model returns only the interpretive content; it is told which post
each candidate belongs to via the per-post `id` in the prompt.

### New table: `v2_blog_topic_brief_sets`

Mirrors the per-post-row pattern of `v2_blog_formula_source_posts`, FK'd to
`v2_blog_formula_sets`. One row per post per formula set.

```sql
CREATE TABLE IF NOT EXISTS v2_blog_topic_brief_sets (
  id TEXT PRIMARY KEY,
  formula_set_id TEXT NOT NULL REFERENCES v2_blog_formula_sets(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  source_post_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  main_keyword TEXT NOT NULL,
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  target_reader TEXT,
  core_concern TEXT,
  main_angle TEXT,
  must_include_json TEXT NOT NULL DEFAULT '[]',
  must_avoid_json TEXT NOT NULL DEFAULT '[]',
  cta_direction TEXT,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (formula_set_id, source_post_id)
);
CREATE INDEX IF NOT EXISTS idx_v2_blog_topic_brief_sets_formula_set_id
  ON v2_blog_topic_brief_sets(formula_set_id);
```

The `UNIQUE (formula_set_id, source_post_id)` constraint makes the extend
operation idempotent per post: a post already covered by the current formula set
is never re-mined into a duplicate set.

### New repository: `createV2BlogTopicBriefSetsRepository` (`v2_blog_formula.ts`)

- Entity type `V2BlogTopicBriefSet` (BaseEntity + the columns above; `confidence`
  number, `status` string, json columns `secondaryKeywords`/`mustInclude`/
  `mustAvoid`).
- `jsonColumns`/`columnOverrides` for the three `_json` columns (same pattern as
  `createV2BlogTopicBriefsRepository`).
- Extra finders: `listByFormulaSetId(formulaSetId)` and
  `listBySourcePost(formulaSetId, sourcePostId)` (or filter in the service).
- Registered in `createStoreLearningRepositories` as `v2BlogTopicBriefSets`.

## Extraction Call (SL-F2)

A new call **separate from SL-F1**, to keep the existing 8-block / 8-post
formula extraction untouched and to allow repeated invocation for batches.

New files (mirroring the SL-F1 structure):

- `topicBriefSetPrompt.ts`
  - `BLOG_TOPIC_BRIEF_SET_V2_CALL_ID = 'SL-F2'`
  - `BLOG_TOPIC_BRIEF_SET_V2_PROMPT_SCHEMA_VERSION = 'blog_topic_brief_set_v2_extraction_input.v1'`
  - `BLOG_TOPIC_BRIEF_SET_V2_RESPONSE_FORMAT_NAME = 'store_learning_blog_topic_brief_set_v2'`
  - `TOPIC_BRIEF_SET_BATCH_SIZE = 10`
  - `buildTopicBriefSetV2PromptInput(store, posts)` → exposes the store profile
    (name, category, representativeKeywords) and each post as
    `{ id (= collectionItemId), title, bodyText (trimmed) }`. The instruction
    asks the model to return one topic-brief set per post, tagged with `id`,
    inferring topic/keywords from the title and the interpretive fields from the
    body, with medical-ad-safe phrasing.
- `providers/topicBriefSetProvider.ts` — provider type:
  ```ts
  export type TopicBriefSetV2Provider = {
    name: string;
    mode: 'deterministic' | 'safe_mock' | 'openai';
    model: string;
    extractTopicBriefSets(input: { store; posts }): Promise<{
      sets: TopicBriefSetV2[];      // one per post, sourcePostIds = [post.id]
      provider: ProviderProvenance;
    }>;
    getLastAuditMetadata?: () => LlmCallAuditMetadata | null;
  };
  ```
- `providers/openAITopicBriefSetProvider.ts` — OpenAI structured-output call
  using the SL-F2 response-format schema; tags each returned candidate with its
  `sourcePostId`, sets `confidence`/`status` (e.g. `0.7`/`candidate`).
- `providers/safeMockTopicBriefSetProvider.ts` — deterministic heuristic output
  (no external call), used for `safe_mock` and as the OpenAI offline fallback.
- `providers/topicBriefSetProviderFactory.ts` —
  `createTopicBriefSetProviderForMode(mode, options)` returning `null` for
  `deterministic` (service runs the heuristic inline), mirroring
  `createBlogFormulaV2ProviderForMode`.

### Deterministic / safe_mock heuristic

For each post:
- `topic` / `mainKeyword`: pick the store `metadata.representativeKeywords` entry
  (or title token) that appears in the post title; fall back to the first
  representative keyword, else the leading title phrase.
- `secondaryKeywords`: other representative keywords / notable title tokens found
  in the post.
- `targetReader`, `coreConcern`, `mainAngle`, `mustInclude`, `mustAvoid`,
  `ctaDirection`: generic safe defaults (e.g. coreConcern = "부작용·재발 등에 대한
  걱정", mustInclude = the required disclosures, ctaDirection = soft consultation
  guidance).
- `confidence: 0.4`, `status: 'candidate'`, `sourcePostIds: [post.collectionItemId]`.

## Batching / Extend Logic

New service function:

```ts
extendBlogFormulaV2TopicBriefSets(repos, storeId, options?: {
  formulaSetId?: string;   // defaults to latest formula set
  provider?: TopicBriefSetV2Provider | null; // injected by route per resolved mode
}): {
  added: TopicBriefSetV2[];
  topicBriefSets: TopicBriefSetV2[];   // full library after this batch
  remainingCount: number;
}
```

Algorithm:
1. Resolve the target formula set (latest by `updatedAt` if not given).
2. Load owner posts (already sorted newest-first by `listOwnerBlogPostsForFormulaV2`).
3. Load existing `v2_blog_topic_brief_sets` rows for the formula set; build a set
   of covered `source_post_id`s.
4. `remaining = posts.filter(p => !covered.has(p.collectionItemId))`;
   `batch = remaining.slice(0, TOPIC_BRIEF_SET_BATCH_SIZE)`.
5. If `batch.length === 0`, return `{ added: [], topicBriefSets: <all>, remainingCount: 0 }`.
6. Run the provider (or deterministic heuristic) over `batch`; insert one row per
   returned set (guarded by the UNIQUE constraint).
7. Return `added`, the full library, and
   `remainingCount = remaining.length - batch.length`.

**Provider-mode reuse**: the route resolves the mode for the extend call by
reading the formula set's extraction run
(`repos.v2BlogFormulaRuns.listByFormulaSetId(formulaSetId)` → latest →
`run.output.provider?.mode`). Deterministic runs have no `provider` field, so the
mode resolves to `deterministic`. The route then builds the matching
`TopicBriefSetV2Provider` via the factory and passes it in.

**First batch on extraction**: the `/extract` route calls
`extendBlogFormulaV2TopicBriefSets` once (first ≤10 posts) right after the formula
set is created, building a topic-brief-set provider that matches the requested
formula provider mode (or `null` for deterministic). Orchestration lives in the
route rather than the service `extract*` functions so the synchronous
deterministic `extractBlogFormulaV2` stays synchronous and provider construction
stays where the factory options already exist.

**Error handling**: SL-F2 is best-effort and non-fatal. If the OpenAI call or
schema parse throws, the surrounding `/extract` still succeeds; the library is
left empty/partial and is retryable via the extend button. The deterministic
heuristic does not throw (pure function over loaded posts).

## API Changes

- `GET /` (`getBlogFormulaV2Payload`) gains:
  - `topicBriefSets: TopicBriefSetV2[]` — all rows for the current formula set.
  - `status.topicBriefSetRemainingCount: number` — owner posts not yet covered by
    the current formula set (0 when no formula set exists).
- New route `POST /topic-brief-sets/extend`:
  - Body: `{}` (operates on the latest formula set). Optional
    `{ formulaSetId?: string }` for forward-compatibility.
  - Resolves provider mode from the formula run, builds the provider, calls
    `extendBlogFormulaV2TopicBriefSets`.
  - Response: `{ added, topicBriefSets, remainingCount }`.
  - 404 / clear error if no formula set exists yet.

## UI Changes (소재 Brief panel, `web/07_마케팅전략룰셋.html` + `web/blog_formula_v2.js`)

Above the existing 소재 Brief form:
- A `<select>` "토픽 브리프 라이브러리" whose first option is "직접 입력"
  (keeps current manual behaviour), followed by one option per `topicBriefSet`.
  - Option label: `${topic}${n>1 ? ' ' + circledNumber(i) : ''} · ${mainAngle ?? coreConcern ?? mainKeyword}`
    where same-`topic` entries are numbered client-side (e.g.
    "리팟레이저 ① · 재발 걱정 해소", "리팟레이저 ② · 부작용 우려 해소").
  - On `change`: populate every 소재 Brief field from the selected set (inverse of
    `topicBriefFromForm()`); selecting "직접 입력" leaves fields as-is.
- A "더 많은 블로그에서 포뮬라 생성" button:
  - Shown only when `status.topicBriefSetRemainingCount > 0`.
  - On click: `POST /topic-brief-sets/extend`; append new options to the dropdown,
    update or hide the button from the response `remainingCount`, using the same
    overlay/loading pattern as the existing extract button.
- `renderPayload` (or equivalent) populates the dropdown from
  `payload.topicBriefSets` and sets initial button visibility.

Downstream (retrieve-samples → generate-draft → validate-draft) is unchanged: the
selected set merely fills the existing form, which still drives `topicBriefFromForm()`.

## Testing

- **Schema**: `TopicBriefSetV2Schema` parse/round-trip; response-format schema
  rejects/omits server-only fields.
- **Repository**: insert + `listByFormulaSetId`; UNIQUE `(formula_set_id,
  source_post_id)` prevents duplicates.
- **Deterministic heuristic**: given the V2 fixture posts, produces one set per
  post with topic/mainKeyword drawn from representative keywords and generic
  interpretive defaults; `confidence`/`status` as specified.
- **Batching/extend service**:
  - First extraction mines ≤10 sets and reports correct `remainingCount`.
  - A second `extend` call mines the next batch, appends (does not replace), and
    skips already-covered posts; `remainingCount` decreases to 0.
  - Provider-mode resolution: deterministic run → deterministic heuristic;
    safe_mock/openai run → corresponding provider (use a stub client).
  - Best-effort: a throwing OpenAI client leaves `/extract` succeeding with an
    empty library.
- **API**: `GET /` exposes `topicBriefSets` + `topicBriefSetRemainingCount`;
  `POST /topic-brief-sets/extend` returns `added`/`topicBriefSets`/`remainingCount`.
- **Page**: dropdown renders one option per set with grouped numbering; selecting
  a set fills the form; extend button visibility follows `remainingCount`.

## Rollout / Migration

- Add the `CREATE TABLE` + index to `src/db/schema.sql` (idempotent
  `IF NOT EXISTS`); no data migration. Formula sets created before this feature
  simply have an empty library until re-extracted.
- Backward compatible: all additions are new fields/tables/routes; existing
  payload consumers ignore the new fields.
