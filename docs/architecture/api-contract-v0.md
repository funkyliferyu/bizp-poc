# API Contract v0

## Scope

This API contract is for the Store Learning & Blog Content Automation PoC.

Browser pages must call `poc-server` APIs only. Naver/OpenAI credentials stay server-side. Mock mode must work without external keys.

## Conventions

- Base path: `/api`.
- Request and response bodies are JSON.
- Timestamps are ISO strings.
- Server responses must not include secrets.
- Validation errors use `400`.
- Missing resources use `404`.
- Provider limitations use explicit capability errors rather than pretending data exists.
- LLM-generated responses are saved only after Zod validation.

Common error shape:

```json
{
  "error": {
    "code": "provider_capability_unsupported",
    "message": "Full Naver Place reviews are not available through the configured provider.",
    "details": {
      "provider": "naver_official",
      "capability": "place_reviews"
    }
  }
}
```

## Runtime

### `GET /api/runtime`

Returns runtime mode, provider capability flags, and whether required server-side keys are configured.

```json
{
  "mode": "mock",
  "providers": {
    "naverPlace": "mock",
    "naverBlog": "mock",
    "openai": "mock"
  },
  "capabilities": {
    "placeUrlResolution": true,
    "blogMetadata": true,
    "blogFullBody": true,
    "placeReviews": true,
    "contentGeneration": true
  }
}
```

## Store Registration

### `POST /api/stores/from-place-url`

Creates or updates a store draft from a Naver Place URL.

Request:

```json
{
  "naverPlaceUrl": "https://naver.me/example",
  "mode": "mock"
}
```

Response:

```json
{
  "store": {
    "id": "store_demo_cake",
    "name": "분당 케이크하우스",
    "naverPlaceUrl": "https://naver.me/example",
    "naverPlaceId": "place_123",
    "category": "베이커리",
    "address": "경기도 성남시 분당구 정자동",
    "phone": "031-000-0000",
    "description": "커스텀 케이크 전문점",
    "profile": {
      "hours": [],
      "menus": [],
      "links": []
    }
  },
  "providerRunId": "provider_run_001"
}
```

### `GET /api/stores/:storeId`

Returns editable store profile.

### `PUT /api/stores/:storeId`

Saves editable store profile fields, uploaded image metadata, and store documents.

## AI Learning Settings

### `GET /api/stores/:storeId/learning-settings`

Returns settings for Naver Blog, Naver Place, Instagram placeholder, keyword strategy, and store materials.

### `PUT /api/stores/:storeId/learning-settings`

Saves settings.

Request:

```json
{
  "channels": {
    "blog": {
      "enabled": true,
      "url": "https://blog.naver.com/example",
      "postLimit": 50
    },
    "place": {
      "enabled": true,
      "url": "https://naver.me/example",
      "includeReviews": true
    },
    "instagram": {
      "enabled": false,
      "mode": "mock"
    }
  },
  "keywords": ["분당 케이크", "당일 제작", "레터링 케이크"],
  "includeStoreMaterials": true
}
```

## Collection Runs

### `POST /api/stores/:storeId/collection-runs`

Starts collection.

Response:

```json
{
  "runId": "collection_run_001",
  "storeId": "store_demo_cake",
  "status": "running",
  "channels": [
    { "channel": "blog", "status": "running", "collectedCount": 0 },
    { "channel": "place", "status": "queued", "collectedCount": 0 }
  ]
}
```

### `GET /api/collection-runs/:runId`

Returns progress for the collection run.

### `POST /api/collection-runs/:runId/retry`

Retries failed channels.

Request:

```json
{
  "channels": ["blog", "place"]
}
```

## Collected Content Selection

### `GET /api/collection-runs/:runId/items`

Returns collected Blog, Place, Instagram, and store material items. Items with unavailable full body text must state capability status.

Response:

```json
{
  "items": [
    {
      "id": "item_blog_001",
      "channel": "blog",
      "sourceType": "post",
      "title": "분당 케이크 후기",
      "sourceUrl": "https://blog.naver.com/example/1",
      "publishedAt": "2026-05-20T00:00:00.000Z",
      "bodyAvailability": "available",
      "selected": true
    },
    {
      "id": "item_place_review_001",
      "channel": "place",
      "sourceType": "review",
      "title": "영수증 리뷰 요약",
      "bodyAvailability": "provider_unsupported",
      "selected": false
    }
  ]
}
```

### `PUT /api/collection-runs/:runId/selections`

Saves selected items.

### `POST /api/collection-runs/:runId/analyze`

Starts analysis and strategy ruleset generation from selected content.

## Learning Status

### `GET /api/stores/:storeId/learning-status`

Returns aggregate learning state and tab counts.

### `GET /api/stores/:storeId/learning-sources?channel=blog|place|instagram`

Returns analyzed sources and evidence for the selected tab.

## Analysis Jobs

### `GET /api/analysis-jobs/:jobId`

Returns analysis job status, errors, and generated ruleset id when available.

### `POST /api/analysis-jobs/:jobId/retry`

Retries failed analysis/ruleset generation without re-running collection when selected content is still valid.

## Marketing Strategy Ruleset

### `GET /api/stores/:storeId/strategy-ruleset`

Returns the active editable ruleset.

### `PUT /api/stores/:storeId/strategy-ruleset`

Saves edited ruleset fields.

### `POST /api/stores/:storeId/strategy-ruleset/regenerate-preview`

Regenerates preview copy from current ruleset without overwriting saved rules unless explicitly saved.

### `GET /api/stores/:storeId/strategy-ruleset/benchmark-evidence`

Returns competitor/reference evidence through server-side provider adapters or mock fixtures.

## Blog Management

### `GET /api/stores/:storeId/blog-posts`

Query parameters:

- `status`: comma-separated statuses.
- `limit`: page size.
- `cursor`: pagination cursor.

Returns AI-generated blog posts, including approval-pending posts for the blog management screen.

### `GET /api/blog-posts/:postId`

Returns article, images, preview metadata, SEO score, approval state, publish request state, and published result.

### `PUT /api/blog-posts/:postId/draft`

Saves manual edits to title/article/image choices.

### `POST /api/blog-posts/:postId/request-approval`

Moves generated draft to approval-pending when local workflow requires explicit request.

### `POST /api/blog-posts/:postId/request-publish`

Requests immediate or scheduled publishing.

Request:

```json
{
  "publishMode": "scheduled",
  "scheduledAt": "2026-06-08T01:00:00.000Z"
}
```

### `POST /api/blog-posts/:postId/mark-published`

Simulates agency/publisher completion for the PoC.

## Regeneration And SEO

### `POST /api/blog-posts/:postId/regenerate-article`

Regenerates article content using current ruleset and selected evidence. Result must pass Zod validation before saving.

### `POST /api/blog-posts/:postId/regenerate-images`

Regenerates image prompts or mock image assets using current ruleset. Result must pass Zod validation before saving.

### `POST /api/blog-posts/:postId/seo-score`

Calculates or regenerates SEO scoring. The result must use a validated score schema before saving.

## Provider Constraints

Official Naver APIs are limited. The API must expose capability status for:

- Place URL resolution.
- Place profile fields.
- Place review availability.
- Blog metadata availability.
- Full blog body availability.

Full blog body and Place reviews require a provider/fallback design. The contract should support `available`, `partial`, `provider_unsupported`, `not_configured`, and `failed` states.

