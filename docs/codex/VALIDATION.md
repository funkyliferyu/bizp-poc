# Validation

## LLM-002 Commands

Run from `poc-server/`:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual smoke:

```bash
PORT=5178 npm run dev
```

## Expected Coverage

- `npm run db:migrate` keeps the Store Learning SQLite schema available.
- `npm run db:seed` keeps the demo store path available without external keys.
- `npm run typecheck` verifies provider types, async route handlers, and fake-client test injection.
- `npm test` runs existing Event-to-Operation tests plus Store Learning API/page tests.
- `npm run demo` verifies the old Event-to-Operation demo remains behaviorally unchanged.
- `npm run demo:store-learning` verifies the Store Learning demo still works in mock mode.

## TDD Evidence

- RED `npm test -- blogGenerationApi.test.ts`: failed because injected blog provider client was not called.
- RED `npm test -- blogGenerationApi.test.ts contentDetailApi.test.ts`: failed because generation and text regeneration still used mock behavior.
- GREEN `npm test -- blogGenerationApi.test.ts contentDetailApi.test.ts`: passed, 2 files / 9 tests.
- GREEN `npm run typecheck`: passed.

## Final Sequential Validation

- `npm run db:migrate`: passed.
- `npm run db:seed`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files / 94 tests.
- `npm run demo`: passed and generated the existing Event-to-Operation approval package.
- `npm run demo:store-learning`: passed and printed the Store Learning demo summary.

## Manual Smoke Result

Smoke server:

```bash
PORT=5178 npm run dev
```

Observed API smoke in default mock mode:

```text
POST /api/stores/store_demo_cake/blog-posts/generate
  generatedStatus => pending_approval
  generatedMode => mock
  generatedProvider => null

POST /api/blog-posts/blog_post_demo_pending_approval/regenerate-text
  regeneratedStatus => pending_approval
  regeneratedMode => mock
  regeneratedProvider => null

POST /api/blog-posts/blog_post_demo_pending_approval/seo-score
  seoTotalScore => 94
  seoRubricKeys => titleKeyword, bodyKeyword, metaDescription, readability, imageAltPrompt, cta
```

## Manual Smoke Checklist

Default mock mode:

- `POST /api/stores/store_demo_cake/blog-posts/generate` should work without external keys.
- Generated content should have `contentGeneration.prompt.mode = mock`.
- `POST /api/blog-posts/blog_post_demo_pending_approval/regenerate-text` should keep deterministic mock revision behavior.
- `POST /api/blog-posts/blog_post_demo_pending_approval/seo-score` should persist a local deterministic SEO score.

Credentialed OpenAI mode:

- Set `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`.
- Blog generation should use `openAIBlogProvider`.
- Text regeneration should use `openAIBlogProvider`.
- SEO rescoring should use `openAIBlogProvider`.
- Saved content generation prompt metadata should include:
  - `mode = openai`
  - `provider = openAIBlogProvider`
- Saved content output must pass `BlogProviderDraftOutputSchema`.
- Saved SEO output must pass `SeoScoreOutputSchema`.

## Boundaries

- Browser pages still call poc-server APIs only.
- OpenAI credentials stay server-side.
- Mock mode still works without external keys.
- Blog draft and SEO outputs use Zod schema validation before persistence.
- Image generation remains placeholder-only.
- Naver Blog publishing remains a local status transition only.
- Naver collection behavior is unchanged in LLM-002.
- Existing Event-to-Operation workflows should remain behaviorally unchanged.
- `admin/` and `pc-web/` should remain unchanged.
- The generated local SQLite file is under ignored `poc-server/data/`.
