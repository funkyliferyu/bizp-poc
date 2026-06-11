# LLM Call Structures

> **Scope:** This document describes the current server-side OpenAI call
> structures in this repository. Browser pages must call `poc-server` APIs
> only; Naver/OpenAI credentials stay server-side.

**Current runtime model:** `process.env.OPENAI_MODEL ?? "gpt-4o-mini"`

**Current OpenAI client path:** `poc-server/src/ai/openaiClient.ts`

**Not LLM calls:** ruleset preview regeneration, ruleset version restore,
similar-company benchmark fixture, image prompt regeneration, RAG document
generation, review-weakness backfill, and static/server-derived writing-style
suggestions do not call OpenAI in the current implementation.

---

## Call Inventory

| ID | Type | Product area | API / trigger | OpenAI method | Response contract |
|---|---|---|---|---|---|
| SL-A1 | Budgeted structured analysis | Store Learning | `POST /api/analysis-runs/:analysisRunId/start` | `client.beta.chat.completions.parse` | `AnalyzerOutputSchema` |
| SL-B1 | Structured blog draft generation | Store Learning Blog | `POST /api/stores/:storeId/blog-posts/generate` | `client.beta.chat.completions.parse` | `BlogProviderDraftOutputSchema` |
| SL-B2 | Structured blog text regeneration | Store Learning Blog | `POST /api/blog-posts/:postId/regenerate-text` | `client.beta.chat.completions.parse` | `BlogProviderDraftOutputSchema` |
| SL-S1 | Structured SEO scoring | Store Learning Blog | `POST /api/blog-posts/:postId/seo-score` | `client.beta.chat.completions.parse` | `SeoScoreOutputSchema` |
| RT-P1 | Runtime model probe | Runtime health | `POST /api/runtime/openai-probe` | `client.models.retrieve` | No prompt / no generated content |
| LEG-M1 | Legacy structured extraction | Event-to-Operation legacy | `POST /api/memory/build` | `client.beta.chat.completions.parse` | `BusinessMemorySchema.omit({ generationTrace: true })` |
| LEG-C1 | Legacy structured channel generation | Event-to-Operation legacy | `POST /api/events/:eventId/run` | `client.beta.chat.completions.parse` | `ChannelOutputsSchema` |

---

## Server-Side LLM Audit Logs

Store Learning OpenAI paths now write server-side rows to
`llm_audit_logs`. This is an internal SQLite inspection table, not a
customer-facing browser surface. Browser pages still call only `poc-server`
APIs, and OpenAI credentials stay server-side.

Each row records:

- `store_id`
- `related_entity_type`: `analysis_run`, `content_generation`, `blog_post`,
  or `seo_score`
- `related_entity_id` when an artifact exists; failed pre-artifact Blog/SEO
  calls may store `NULL`
- `provider`, `mode`, `model`, and action
- `request_started_at`, `response_completed_at`, and `duration_ms`
- `input_budget_json`
- `prompt_input_json`: the exact compact/budgeted server prompt input
- `response_format_json`: compact schema metadata such as response format name
  and strict mode
- `parsed_output_json`: validated structured output or compact parsed output
- `status`: `completed` or `failed`
- `error_json`: sanitized product/developer metadata only

For local debugging, inspect the latest rows with SQLite, for example:

```sql
SELECT
  created_at,
  store_id,
  related_entity_type,
  related_entity_id,
  provider,
  model,
  action,
  status,
  duration_ms
FROM llm_audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

`prompt_input_json` can include collected Blog/review text after server-side
budgeting. Do not expose this table through customer-facing HTML, screenshots,
query strings, or localStorage. The table must not store API keys, OpenAI raw
HTTP headers, or raw SDK response objects.

Ruleset version restore is intentionally absent from `llm_audit_logs`: it
copies a selected historical `marketing_rulesets` row and its `ruleset_fields`
into a new `draft` version, records restore metadata in
`marketing_rulesets.ruleset`, and does not call OpenAI or create an
`analysis_run`.

---

## Type 1: Budgeted Structured Analysis

**Call ID:** `SL-A1`

**Purpose:** Analyze selected Store Learning collection items and generate
learning snapshot, evidence rows, marketing ruleset, and ruleset fields.

**Provider:** `openAIAnalysisProvider`

**Key files:**

- `poc-server/src/storeLearning/analysis/openAIAnalysisProvider.ts`
- `poc-server/src/storeLearning/analysis/analysisPromptBudget.ts`
- `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`
- `poc-server/src/storeLearning/routes/analysisRuns.ts`

**Current budget behavior:**

- Store metadata is reduced to allowlisted profile facts.
- Item metadata is reduced to allowlisted metadata fields.
- Blog body is capped at 1,200 characters per item.
- Place review body is capped at 500 characters per item.
- Place profile body is excluded; normalized facts are used instead.
- Current development version sends at most 3 latest Blog sources and 10 latest
  Place review sources.
- Prompt JSON is capped by `DEFAULT_PROMPT_CHARACTER_BUDGET = 60000`.
- Aggregate body text is capped by `DEFAULT_BODY_CHARACTER_BUDGET = 32000`.

**Ruleset regeneration gate:** for stores that already have a learning
snapshot and marketing ruleset, `SL-A1` full analyzer regeneration is allowed
only when the current explicit meaningful-change collection contains at least
3 new Blog post assets and 10 new Place review assets. If either threshold is
missing, the server creates a completed skipped analysis run with
`skippedReason = "insufficient_new_evidence_for_ruleset_regeneration"`,
required/new evidence counts, `reusedAnalysisRunId`, `learningSnapshotId`, and
`marketingRulesetId`; it reuses the latest artifacts and does not call OpenAI
or create a new `llm_audit_logs` row. Initial learning, no-change reuse, and
Place profile-only reuse/backfill paths remain separate.

```mermaid
flowchart TD
  Browser[Browser: content_selection.js] --> API[POST /api/analysis-runs/:id/start]
  API --> Service[startAnalysisRun]
  Service --> Provider[openAIAnalysisProvider.analyze]
  Provider --> Budget[buildAnalysisPromptInput]
  Budget --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Zod[zodResponseFormat + validateAnalyzerOutput]
  Zod --> Contract[required ruleset field contract + evidence reference validation]
  Contract --> Persist[analysis_evidence + learning_snapshots + marketing_rulesets + ruleset_fields]
  Persist --> RunResult[analysis_runs.result provenance and budget metadata]
  RunResult --> UI[Selection/Learning status provenance UI]
```

### System Prompt

```text
You are a Korean local-store marketing strategist. Analyze collected blog/place evidence and return a strict JSON ruleset. Use only provided collection items as evidence. Avoid unsupported superlatives and medical/legal/guarantee claims.
```

### User Prompt Shape

```ts
{
  task: "Analyze selected collected content for Store Learning & Blog Content Automation PoC.",
  constraints: [
    "Return Korean marketing strategy analysis only.",
    "Every evidence.collectionItemId must be one of the provided promptItemIds.",
    "Every ruleset field evidenceItemIds entry must be one of the provided promptItemIds.",
    "Do not invent customer reviews or collection items.",
    "Keep claims conservative and evidence-linked.",
    "Populate every required ruleset field once."
  ],
  store: {
    id,
    name,
    category,
    address,
    description,
    metadata: {
      // allowlisted profile facts only:
      // category, address, phone, businessHours, closedDays,
      // parking, intro, description, treatmentSubjects,
      // representativeTreatmentSubjects, representativeMenu
    }
  },
  selectedItemIds: string[],
  promptItemIds: string[],
  selectedItems: [
    {
      id,
      channel,
      sourceType,
      title,
      bodyText, // budgeted, or null for profile items
      sourceUrl,
      metadata: {
        // allowlisted item metadata only:
        // publishedAt, postDate, reviewDate, rating,
        // reviewerName, bodyAvailability, sourceKind,
        // sourceOwnership, blogId, logNo, tags, profileFacts
      }
    }
  ],
  requiredRulesetFieldKeys: REQUIRED_ANALYZER_RULESET_FIELD_KEYS,
  requiredRulesetFields: [
    {
      fieldKey,
      label,
      section,
      valueKind,
      sourceTier,
      inputSources,
      expectedOutput,
      evidenceGuidance
    }
  ]
}
```

`requiredRulesetFields` is built from the AI source matrix only. Direct
Place/manual facts such as `operatingHours`, `closedDays`, `parking`, and
`representativeTreatmentSubjects` stay direct and are not included as
LLM-generated ruleset fields.

### Response Handling

```mermaid
flowchart LR
  Parsed[OpenAI parsed JSON] --> AnalyzerSchema[AnalyzerOutputSchema]
  AnalyzerSchema --> FieldContract[validateAnalyzerRulesetFieldContract]
  FieldContract --> ReferenceValidation[validateAnalyzerReferences]
  ReferenceValidation --> Evidence[analysis_evidence]
  ReferenceValidation --> Snapshot[learning_snapshots]
  ReferenceValidation --> Ruleset[marketing_rulesets]
  ReferenceValidation --> Fields[ruleset_fields]
```

The OpenAI provider requests `rulesetFieldsByKey`, a field-keyed object where
every `REQUIRED_ANALYZER_RULESET_FIELD_KEYS` key is present exactly once.
Evidence IDs in the structured response are constrained to `promptItemIds`,
the IDs that actually appear in the budgeted prompt payload. The provider then
normalizes this object to internal `rulesetFields[]` with
`source = "openai_analysis"`. Before persistence, `SL-A1` rejects
duplicate/unknown/source mismatches and revalidates all evidence item
references. A failure at this stage marks the analysis run as failed and saves
no evidence, snapshot, marketing ruleset, or ruleset fields.

**Stored metadata:** `analysis_runs.result` stores
`analyzerProvider`, `analyzerMode`, `analyzerModel`, selected/prompt/omitted
counts, Blog limit/counts, review limit/counts, character budgets, and
`promptBudgetReason`. Current development defaults include at most 3 Blog
items and at most 10 Place review items in the SL-A1 prompt.

**Failure handling:** context-length errors are sanitized as
`errorType: "analysis_context_too_large"` with a Korean product message.
Ruleset field contract failures are sanitized as
`errorType: "analysis_contract_invalid"` with `contractIssue` metadata, and
raw fieldKey lists are not stored in `analysis_runs.error` or returned to the
browser.

---

## Type 2: Structured Blog Draft Generation

**Call ID:** `SL-B1`

**Purpose:** Generate an approval-pending Naver Blog draft and image prompts
from the current marketing ruleset.

**Provider:** `openAIBlogProvider.generateDraft`

**Key files:**

- `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
- `poc-server/src/storeLearning/blog/blogPromptBudget.ts`
- `poc-server/src/storeLearning/blog/blogGenerator.ts`
- `poc-server/src/storeLearning/routes/stores.ts`

**Current budget behavior:** `buildBlogDraftPromptInput()` compacts the OpenAI
prompt before serialization. Store metadata is allowlisted, ruleset JSON is
reduced to an allowlisted summary plus compact ruleset fields, ruleset field
values are capped, media assets are limited, and prompt budget metadata is
recorded as `inputBudget`. If the serialized prompt still exceeds the
configured budget, the builder progressively reduces media asset count, article
section count/body length, and ruleset field value length until it fits or
reaches minimum context. Only Blog/SEO-relevant ruleset field keys are included.

```mermaid
flowchart TD
  Browser[Browser: blog list/generate action] --> API[POST /api/stores/:storeId/blog-posts/generate]
  API --> Generator[generateApprovalPendingBlogPost]
  Generator --> Provider[openAIBlogProvider.generateDraft]
  Provider --> Prompt[draftPromptInput action=generate_blog_post]
  Prompt --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Schema[BlogProviderDraftOutputSchema]
  Schema --> Draft[BlogDraftOutputSchema]
  Draft --> Save[content_generations + blog_posts + media_assets + seo_scores]
```

### System Prompt

```text
You are a Korean local-store blog content strategist. Return validated structured blog draft data only. Follow the ruleset, keep claims evidence-safe, and produce image prompts instead of image assets.
```

### User Prompt Shape

```ts
{
  task: "Generate a Korean approval-pending Naver Blog article draft for the store.",
  constraints: [
    "Return only structured data matching the requested schema.",
    "Use Korean copy suitable for a local-store Naver Blog post.",
    "Respect the current marketing ruleset and avoid forbidden or exaggerated expressions.",
    "Do not claim unsupported facts, discounts, guarantees, medical effects, or official rankings.",
    "Image generation is out of scope; return image prompts only.",
    "Keep the draft approval-pending and do not include publishing instructions."
  ],
  store: {
    id,
    name,
    category,
    address,
    phone,
    description,
    metadata // allowlisted profile facts only
  },
  ruleset: {
    id,
    status,
    version,
    summary, // allowlisted ruleset summary only
    fields: [{ fieldKey, finalValue, source, locked }]
  },
  rulesetFields: [
    {
      fieldKey,
      finalValue,
      source,
      locked
    }
  ],
  currentPost: null,
  mediaAssets: []
}
```

### Response Shape

```ts
{
  title: string,
  metaDescription: string,
  bodySections: Array<{ heading: string, body: string }>,
  seoKeywords: string[],
  cta: string,
  imagePrompts: string[],
  seoScore: SeoScoreOutput | null
}
```

**Stored provenance:** `content_generations.prompt` stores mode, provider,
model, action, providerSeoScoreReturned, `inputBudget`, generator, rulesetId,
and fieldKeys. The database column is `prompt_json`. The generation API
response also exposes the same content metadata as `contentProvenance`, and
the initial SEO score separates provider metadata into `seoScore.provenance`.

**Fallback:** if no provider is created, `buildDraft()` creates a deterministic
mock draft. Context-length provider errors are sanitized to a Korean product
message before they reach route error responses.

---

## Type 3: Structured Blog Text Regeneration

**Call ID:** `SL-B2`

**Purpose:** Regenerate an existing approval-pending Blog article using the
same `generateDraft` provider method with `action = "regenerate_text"`.

**Provider:** `openAIBlogProvider.generateDraft`

**Key files:**

- `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
- `poc-server/src/storeLearning/blog/blogPromptBudget.ts`
- `poc-server/src/storeLearning/blog/blogGenerator.ts`
- `poc-server/src/storeLearning/routes/blogPosts.ts`

**Current budget behavior:** `buildBlogDraftPromptInput()` uses the same compact
store/ruleset shape as `SL-B1`, compacts `currentPost.article` to title, meta,
bounded body sections/body text, keywords, CTA, and image prompts, and
allowlists media asset metadata.

```mermaid
flowchart TD
  Browser[Browser: content detail regenerate text] --> API[POST /api/blog-posts/:postId/regenerate-text]
  API --> Generator[regenerateBlogPostText]
  Generator --> Provider[openAIBlogProvider.generateDraft]
  Provider --> Prompt[draftPromptInput action=regenerate_text]
  Prompt --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Schema[BlogProviderDraftOutputSchema]
  Schema --> Update[blog_posts.article + content_generations text revision]
  Update --> Score[provider SEO score or local score]
  Score --> Detail[content detail API response]
```

### System Prompt

Same as `SL-B1`.

```text
You are a Korean local-store blog content strategist. Return validated structured blog draft data only. Follow the ruleset, keep claims evidence-safe, and produce image prompts instead of image assets.
```

### User Prompt Shape

```ts
{
  task: "Regenerate a Korean approval-pending Naver Blog article draft for the store.",
  constraints: [
    "Return only structured data matching the requested schema.",
    "Use Korean copy suitable for a local-store Naver Blog post.",
    "Respect the current marketing ruleset and avoid forbidden or exaggerated expressions.",
    "Do not claim unsupported facts, discounts, guarantees, medical effects, or official rankings.",
    "Image generation is out of scope; return image prompts only.",
    "Keep the draft approval-pending and do not include publishing instructions."
  ],
  store: {
    id,
    name,
    category,
    address,
    phone,
    description,
    metadata // allowlisted profile facts only
  },
  ruleset: {
    id,
    status,
    version,
    summary,
    fields: [{ fieldKey, finalValue, source, locked }]
  },
  rulesetFields: [
    {
      fieldKey,
      finalValue,
      source,
      locked
    }
  ],
  currentPost: {
    id,
    status,
    title,
    article: {
      title,
      metaDescription,
      bodySections, // bounded section count and body length
      bodyText,
      seoKeywords,
      cta,
      imagePrompts
    }
  },
  mediaAssets: [
    {
      id,
      assetType,
      status,
      prompt,
      metadata // prompt, alt, placement, generator only
    }
  ]
}
```

**Stored provenance:** a new `content_generations` row is created with
`contentType = "blog_post_text_revision"`. `inputBudget` is stored in
`content_generations.prompt` and exposed through `contentProvenance`.
SEO provenance is stored under `seo_scores.rubric._provenance` and serialized
as `seoScore.provenance`. The content detail UI renders provider, model,
action, and prompt input character budget in its compact provenance line.

**Fallback:** if no provider is created, local mock revision content is built.
Context-length provider errors are sanitized to a Korean product message.

---

## Type 4: Structured SEO Scoring

**Call ID:** `SL-S1`

**Purpose:** Score the current Blog draft for Naver Blog SEO and approval
readiness.

**Provider:** `openAIBlogProvider.scoreSeo`

**Key files:**

- `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
- `poc-server/src/storeLearning/blog/blogPromptBudget.ts`
- `poc-server/src/storeLearning/blog/blogGenerator.ts`
- `poc-server/src/storeLearning/routes/blogPosts.ts`

**Current budget behavior:** `buildBlogSeoPromptInput()` compacts the post
article to bounded article fields, uses the compact ruleset/ruleset field shape,
allowlists media asset metadata, and records `inputBudget` in SEO provenance.
It uses the same progressive fit loop and Blog/SEO-relevant ruleset field
allowlist as `SL-B1`/`SL-B2`.

```mermaid
flowchart TD
  Browser[Browser: content detail SEO rescore] --> API[POST /api/blog-posts/:postId/seo-score]
  API --> Service[rescoreBlogPostSeo]
  Service --> Provider[openAIBlogProvider.scoreSeo]
  Provider --> Prompt[seoPromptInput]
  Prompt --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Schema[SeoScoreOutputSchema]
  Schema --> Save[seo_scores.rubric with _provenance]
  Save --> Response[seoScore.provenance in API response]
```

### System Prompt

```text
You are a Korean Naver Blog SEO reviewer. Return strict structured SEO scoring only. Use the rubric fields exactly and do not rewrite the article.
```

### User Prompt Shape

```ts
{
  task: "Score this Korean Naver Blog draft for SEO and approval readiness.",
  constraints: [
    "Return only structured SEO scores matching the requested schema.",
    "Score conservatively using the provided article, image prompts, and marketing ruleset.",
    "Do not rewrite the article in this response."
  ],
  store: {
    id,
    name,
    category,
    address
  },
  ruleset: {
    id,
    status,
    version,
    summary,
    fields: [{ fieldKey, finalValue, source, locked }]
  } | null,
  rulesetFields: [
    {
      fieldKey,
      finalValue,
      source,
      locked
    }
  ],
  post: {
    id,
    status,
    title,
    article: {
      title,
      metaDescription,
      bodySections,
      bodyText,
      seoKeywords,
      cta,
      imagePrompts
    }
  },
  mediaAssets: [
    {
      id,
      assetType,
      status,
      prompt,
      metadata // prompt, alt, placement, generator only
    }
  ]
}
```

### Response Shape

```ts
{
  totalScore: number,
  rubric: {
    titleKeyword: SeoScoreItem,
    bodyKeyword: SeoScoreItem,
    metaDescription: SeoScoreItem,
    readability: SeoScoreItem,
    imageAltPrompt: SeoScoreItem,
    cta: SeoScoreItem
  }
}
```

**Stored provenance:** provider/mode/model/action and `inputBudget` are stored
in `seo_scores.rubric._provenance`, then separated into `seoScore.provenance`
in API responses. The content detail UI renders the SEO provider, model,
action, and prompt input character budget in its compact provenance line.

**Fallback:** if no provider is created, `scoreBlogPost()` computes a
deterministic local score. Context-length provider errors are sanitized to a
Korean product message.

---

## Type 5: Runtime Model Probe

**Call ID:** `RT-P1`

**Purpose:** Check whether the configured OpenAI model can be retrieved.
This does not generate content and has no prompt.

**Key files:**

- `poc-server/src/ai/runtimeHealth.ts`
- `poc-server/src/index.ts`

```mermaid
flowchart TD
  BrowserOrCurl[Browser/curl] --> API[POST /api/runtime/openai-probe]
  API --> Runtime[probeOpenAIRuntime]
  Runtime --> Status[getRuntimeStatus]
  Status --> Client[getOpenAIClient]
  Client --> Retrieve[OpenAI models.retrieve(model)]
  Retrieve --> Probe[ok/message response]
```

### Request Shape

No prompt is sent. The only provider input is the model name.

```ts
{
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini"
}
```

### Response Shape

```ts
{
  mode: "mock" | "openai",
  openaiConfigured: boolean,
  model: string,
  checkedAt: string,
  ok: boolean,
  message: string
}
```

**Failure handling:** OpenAI secret-like strings in error messages are
redacted by `redactSecrets()`.

---

## Type 6: Legacy Structured Extraction

**Call ID:** `LEG-M1`

**Product status:** Legacy Event-to-Operation / cafe event flow. This is not
the Store Learning source of truth, but the server route still exists.

**Purpose:** Extract cafe business memory facts from pasted channel material.

**Key files:**

- `poc-server/src/workflows/buildBusinessMemory.ts`
- `poc-server/src/ai/prompts.ts`
- `poc-server/src/index.ts`

```mermaid
flowchart TD
  BrowserOrCurl[Legacy caller] --> API[POST /api/memory/build]
  API --> Workflow[buildBusinessMemoryWithAI]
  Workflow --> Client{OpenAI client?}
  Client -- no --> Mock[buildBusinessMemory deterministic seed]
  Client -- yes --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Schema[BusinessMemorySchema without generationTrace]
  Schema --> Trace[Add generationTrace mode=openai]
  OpenAI -. catch .-> Fallback[Mock memory with fallbackReason]
```

### System Prompt

```text
Extract cafe business memory facts from pasted channel material. Return a complete Korean cafe business memory JSON. Preserve factual channel material, infer only conservative marketing facts, and avoid unsupported claims.
```

### User Prompt Shape

```ts
{
  businessId: input.businessId ?? cafeSeedFixture.businessId,
  channelUrl: input.channelUrl ?? "",
  pastedText: input.pastedText ?? "",
  fallbackShape: cafeSeedFixture
}
```

### Response Contract

```ts
BusinessMemorySchema.omit({ generationTrace: true })
```

**Fallback:** missing client or provider error returns deterministic cafe seed
memory with `generationTrace.mode = "mock"` and `fallbackReason`.

---

## Type 7: Legacy Structured Channel Draft Generation

**Call ID:** `LEG-C1`

**Product status:** Legacy Event-to-Operation / cafe event flow. This is not
the Store Learning source of truth, but the server route still exists.

**Purpose:** Generate channel-specific Korean marketing drafts for a cafe
event.

**Key files:**

- `poc-server/src/workflows/generateChannelDrafts.ts`
- `poc-server/src/ai/prompts.ts`
- `poc-server/src/index.ts`

```mermaid
flowchart TD
  LegacyRun[POST /api/events/:eventId/run] --> Workflow[generateChannelDraftsWithAI]
  Workflow --> Client{OpenAI client?}
  Client -- no --> Mock[generateMockChannelDrafts]
  Client -- yes --> OpenAI[OpenAI chat.completions.parse]
  OpenAI --> Schema[ChannelOutputsSchema]
  Schema --> Approval[Approval package generation]
  OpenAI -. catch .-> Fallback[Mock channel drafts with fallbackReason]
```

### System Prompt

```text
Generate channel-specific Korean marketing drafts from a cafe event. 카페 이벤트를 네이버 블로그, 네이버 플레이스, 비즈챗, 챗봇 채널 초안으로 생성한다. 모든 초안에는 메뉴명, 할인금액, 시작일, 종료일을 포함하고 금지어를 피한다.
```

### User Prompt Shape

```ts
{
  businessMemory: memory,
  event
}
```

### Response Contract

```ts
{
  blog: Array<{ title: string, body: string }>,
  place: Array<{ type: string, body: string }>,
  bizchat: Array<{
    messageType: string,
    target: string,
    sendTime: string,
    cta: string,
    body: string
  }>,
  chatbot: Array<{ question: string, answer: string }>
}
```

**Fallback:** missing client or provider error returns deterministic channel
drafts with `generationTrace.mode = "mock"` and `fallbackReason`.

---

## Current Gaps And Next Planning Targets

1. **Provider telemetry symmetry:** Analysis run metadata is still broader than
   Blog/SEO metadata because analysis tracks selected/prompt/omitted source
   item counts.
2. **Legacy route isolation:** Legacy Event-to-Operation calls are still
   server-reachable and should stay clearly separated from Store Learning
   validation.
