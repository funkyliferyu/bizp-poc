# Codex Handoff

## Current Scope

LLM-002 adds an OpenAI-backed blog content provider for the Store Learning & Blog Content Automation PoC.

This change keeps deterministic mock blog generation as the default no-key path and uses OpenAI only when `OPENAI_API_KEY` is configured. It does not change Naver collection, analysis generation, learning status UI, ruleset editing UI, image generation, real publishing, `admin/`, `pc-web/`, or existing Event-to-Operation workflows.

## Added Runtime Pieces

- `poc-server/src/storeLearning/blog/blogProvider.ts`
  - Defines shared Zod schemas for blog draft output and itemized SEO output.
  - Defines the server-side blog content provider interface.
- `poc-server/src/storeLearning/blog/openAIBlogProvider.ts`
  - Adds `createOpenAIBlogProvider`.
  - Adds `createBlogContentProvider` for env-based mock/openai selection.
  - Uses the existing OpenAI SDK `chat.completions.parse` flow with `zodResponseFormat`.
  - Requests structured draft and SEO outputs and validates them with Zod before persistence.
- `poc-server/src/storeLearning/blog/blogGenerator.ts`
  - Accepts an optional blog provider for post generation, text regeneration, and SEO rescoring.
  - Persists provider metadata in `content_generations.prompt`.
  - Persists OpenAI-generated draft output, image prompt placeholders, and SEO scores into existing repositories.
- `poc-server/src/storeLearning/routes/stores.ts`
  - Selects mock or OpenAI blog provider server-side for `POST /api/stores/:storeId/blog-posts/generate`.
  - Accepts provider/client injection for tests.
- `poc-server/src/storeLearning/routes/blogPosts.ts`
  - Selects mock or OpenAI blog provider server-side for text regeneration and SEO rescoring.
  - Keeps image regeneration as deterministic prompt placeholder behavior.
- `poc-server/test/blogGenerationApi.test.ts`
  - Covers OpenAI-backed approval-pending blog generation using a fake parse client.
- `poc-server/test/contentDetailApi.test.ts`
  - Covers OpenAI-backed text regeneration and SEO rescoring using fake parse clients.

## Runtime Behavior

Default local demo:

```text
OPENAI_API_KEY is unset
```

Result:

- Blog generation uses the existing deterministic mock ruleset generator.
- Text regeneration uses the existing deterministic mock revision flow.
- SEO rescoring uses the existing deterministic local scorer.
- No OpenAI request is made.

Credentialed OpenAI mode:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini # optional
```

Result:

- `POST /api/stores/:storeId/blog-posts/generate` uses `openAIBlogProvider`.
- `POST /api/blog-posts/:postId/regenerate-text` uses `openAIBlogProvider`.
- `POST /api/blog-posts/:postId/seo-score` uses `openAIBlogProvider`.
- OpenAI draft output is saved only after `BlogProviderDraftOutputSchema` validation.
- OpenAI SEO output is saved only after `SeoScoreOutputSchema` validation.
- Image regeneration remains placeholder-only and does not call image APIs.
- Publish request still only changes local status to `publish_requested`.

## Guardrails

- Browser pages still call poc-server APIs only.
- OpenAI credentials stay server-side.
- Mock mode still works without external keys.
- Blog draft and SEO outputs use Zod schema validation before persistence.
- Real image generation and real Naver Blog publishing remain out of scope.
- Naver collection behavior is unchanged in LLM-002.
- Existing Event-to-Operation workflows are unchanged.

## Manual Smoke

Run from `poc-server/`:

```bash
PORT=5178 npm run dev
```

Default mock smoke:

```bash
curl -X POST http://localhost:5178/api/stores/store_demo_cake/blog-posts/generate
curl -X POST http://localhost:5178/api/blog-posts/blog_post_demo_pending_approval/regenerate-text
curl -X POST http://localhost:5178/api/blog-posts/blog_post_demo_pending_approval/seo-score
```

Expected no-key result:

- `contentGeneration.prompt.mode = mock` for generated/revised content.
- Blog post status remains `pending_approval`.
- SEO score is persisted locally.

Credentialed OpenAI smoke:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Repeat the same API flow.
- Expect generated/revised `contentGeneration.prompt.mode = openai`.
- Expect generated/revised `contentGeneration.prompt.provider = openAIBlogProvider`.

## Next Suggested Task

Step 5 should handle final real-operation readiness: provider observability, failure UX, credential documentation, real fallback/provider decisions for unsupported Naver data, and any required production publishing boundary. Keep image API calls and Naver Blog publishing behind explicit provider adapters.
