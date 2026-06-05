# Data Model v0

## Scope

This data model is for the Store Learning & Blog Content Automation PoC.

Use SQLite as the local PoC database. All persistence must go through repository interfaces so the database can later move to Postgres.

## Repository Layer

Recommended repository boundaries:

| Repository | Owns |
| --- | --- |
| `StoreRepository` | Store profile, Naver Place URL, editable store fields, uploaded asset metadata. |
| `LearningSettingsRepository` | Channel settings, keyword settings, selected source ranges. |
| `CollectionRunRepository` | Collection run lifecycle, provider status, errors, collected source items. |
| `AnalysisRepository` | Content selections, analysis jobs, learning status per channel. |
| `StrategyRulesetRepository` | Current and historical editable marketing rulesets. |
| `BlogPostRepository` | Generated blog posts, approval state, publish request state, published result. |
| `ProviderRunRepository` | Provider adapter calls, capabilities, non-secret request metadata, errors. |
| `LlmOutputRepository` | Validated structured LLM outputs and validation failures. |

Route handlers should depend on repositories and workflow services, not on SQLite SQL directly.

## Core Tables

### `stores`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable store id. |
| `name` | text | Editable store name. |
| `naver_place_url` | text | Original URL entered by the user. |
| `naver_place_id` | text nullable | Provider-resolved id when available. |
| `category` | text nullable | Store category. |
| `address` | text nullable | Store address. |
| `phone` | text nullable | Store phone. |
| `description` | text nullable | Editable description used for learning. |
| `profile_json` | text | JSON for hours, menus, links, images, documents. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `learning_settings`

| Column | Type | Notes |
| --- | --- | --- |
| `store_id` | text primary key | References `stores.id`. |
| `blog_enabled` | integer | Boolean 0/1. |
| `place_enabled` | integer | Boolean 0/1. |
| `instagram_enabled` | integer | Boolean 0/1, mock/manual until scoped. |
| `blog_url` | text nullable | Naver Blog URL or resolved source. |
| `place_url` | text nullable | Naver Place URL. |
| `collection_window_json` | text | Counts/date range/provider options. |
| `keywords_json` | text | Representative keywords. |
| `include_store_materials` | integer | Boolean 0/1. |
| `updated_at` | text | ISO timestamp. |

### `collection_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Run id. |
| `store_id` | text | References `stores.id`. |
| `status` | text | `queued`, `running`, `selection_ready`, `failed`, `canceled`. |
| `mode` | text | `mock` or `real`. |
| `started_at` | text nullable | ISO timestamp. |
| `completed_at` | text nullable | ISO timestamp. |
| `summary_json` | text | Counts, channel status, next action. |
| `error_json` | text nullable | Non-secret error details. |

### `collected_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Collected item id. |
| `run_id` | text | References `collection_runs.id`. |
| `store_id` | text | References `stores.id`. |
| `channel` | text | `blog`, `place`, `instagram`, `store_material`. |
| `source_type` | text | `post`, `review`, `profile`, `image`, `document`, `manual`. |
| `source_url` | text nullable | Public source URL when safe. |
| `title` | text nullable | Display title. |
| `published_at` | text nullable | Source timestamp. |
| `body_text` | text nullable | Available body text; may be null due provider limits. |
| `media_json` | text | Image/file metadata. |
| `provider_json` | text | Provider, capability, confidence, non-secret metadata. |
| `created_at` | text | ISO timestamp. |

### `content_selections`

| Column | Type | Notes |
| --- | --- | --- |
| `run_id` | text | References `collection_runs.id`. |
| `item_id` | text | References `collected_items.id`. |
| `selected` | integer | Boolean 0/1. |
| `selection_reason` | text nullable | Optional user/system reason. |
| `updated_at` | text | ISO timestamp. |

Composite key: `run_id`, `item_id`.

### `analysis_jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Analysis job id. |
| `run_id` | text | References `collection_runs.id`. |
| `store_id` | text | References `stores.id`. |
| `status` | text | `queued`, `running`, `succeeded`, `failed`. |
| `started_at` | text nullable | ISO timestamp. |
| `completed_at` | text nullable | ISO timestamp. |
| `error_json` | text nullable | Non-secret error details. |

### `learning_channel_status`

| Column | Type | Notes |
| --- | --- | --- |
| `store_id` | text | References `stores.id`. |
| `channel` | text | `blog`, `place`, `instagram`. |
| `status` | text | `not_configured`, `collecting`, `collected`, `analyzed`, `failed`. |
| `collected_count` | integer | Count shown in tabs. |
| `selected_count` | integer | Count selected for analysis. |
| `last_run_id` | text nullable | References `collection_runs.id`. |
| `updated_at` | text | ISO timestamp. |

Composite key: `store_id`, `channel`.

### `strategy_rulesets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Ruleset version id. |
| `store_id` | text | References `stores.id`. |
| `status` | text | `draft`, `active`, `archived`. |
| `version` | integer | Incrementing per store. |
| `ruleset_json` | text | Zod-validated strategy fields, writing style, image style, evidence links. |
| `source_analysis_job_id` | text nullable | References `analysis_jobs.id`. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `blog_posts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Blog post id. |
| `store_id` | text | References `stores.id`. |
| `ruleset_id` | text nullable | References `strategy_rulesets.id`. |
| `status` | text | `draft`, `pending_approval`, `publish_requested`, `published`, `canceled`. |
| `title` | text | Generated or edited title. |
| `article_json` | text | Zod-validated article structure. |
| `seo_score_json` | text | Deterministic or validated AI score details. |
| `preview_json` | text | Blog preview layout metadata. |
| `publish_json` | text nullable | Scheduled time, external URL, completed timestamp. |
| `created_at` | text | ISO timestamp. |
| `updated_at` | text | ISO timestamp. |

### `generated_assets`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Asset id. |
| `blog_post_id` | text | References `blog_posts.id`. |
| `asset_type` | text | `image`, `thumbnail`, `inline_image`. |
| `status` | text | `generated`, `selected`, `rejected`, `failed`. |
| `url` | text nullable | Local/static path or provider URL. |
| `metadata_json` | text | Prompt, source item linkage, dimensions, non-secret provider metadata. |
| `created_at` | text | ISO timestamp. |

### `provider_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Provider run id. |
| `store_id` | text nullable | Store id when applicable. |
| `provider` | text | `naver_official`, `naver_fallback`, `manual`, `mock`, etc. |
| `capability` | text | `place_url_resolution`, `blog_collection`, `place_reviews`, etc. |
| `status` | text | `succeeded`, `failed`, `partial`, `unsupported`. |
| `request_json` | text | Non-secret request summary. |
| `response_json` | text | Non-secret response summary. |
| `error_json` | text nullable | Non-secret error details. |
| `created_at` | text | ISO timestamp. |

### `llm_outputs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | LLM output id. |
| `store_id` | text nullable | Store id when applicable. |
| `output_type` | text | `strategy_ruleset`, `blog_article`, `seo_score`, `image_prompt`, etc. |
| `schema_name` | text | Zod schema name/version. |
| `status` | text | `validated`, `validation_failed`, `rejected`. |
| `validated_json` | text nullable | Saved only after Zod parse succeeds. |
| `validation_error_json` | text nullable | Structured validation errors. |
| `run_metadata_json` | text | Model, prompt version, token metadata without secrets. |
| `created_at` | text | ISO timestamp. |

## Zod Schema Targets

Create schemas before saving data for:

- Store profile resolved from Naver Place URL.
- Learning settings.
- Collected item.
- Content selection request.
- Learning status response.
- Marketing strategy ruleset.
- Blog article draft.
- Blog image selection and regeneration request.
- SEO score response.
- Provider capability/error result.
- LLM output envelope.

## Migration To Postgres

SQLite is recommended for local PoC speed. To keep Postgres migration realistic:

- Keep ids as text.
- Store timestamps as ISO strings in API contracts.
- Keep JSON columns behind repository methods.
- Avoid SQLite-only SQL in route handlers.
- Make repository tests run against an in-memory or temp SQLite database first, then add a Postgres repository later with the same contract.

