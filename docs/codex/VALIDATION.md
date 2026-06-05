# Validation

## Docs-Only Validation

For this planning-docs task, validate by checking the diff and confirming only requested docs changed.

Commands:

```bash
git status --short
git diff --name-only
git diff --stat
git diff -- AGENTS.md poc-server/AGENTS.md docs/product/store-learning-blog-content-poc.md docs/architecture/runtime-model-v0.md docs/architecture/data-model-v0.md docs/architecture/api-contract-v0.md docs/qa/acceptance-checklist-v0.md docs/codex/PLAN.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
```

Expected result:

- Only the requested planning/operating documents are added or changed.
- No files under `admin/` are changed.
- No files under `pc-web/` are changed.
- Existing Event-to-Operation files are unchanged.
- Existing `web/*.html` pages are unchanged.

## Future Server Validation

When product behavior is implemented, run:

```bash
cd poc-server
npm test
npm run typecheck
```

Add focused tests for:

- Store registration from Naver Place URL in mock mode.
- Learning settings persistence.
- Collection run progress and retry state.
- Collected content selection.
- Analysis job success and failure.
- Strategy ruleset Zod validation.
- Blog article Zod validation.
- SEO score Zod validation.
- Blog approval and publishing state transitions.
- Provider capability errors for full blog body and Place reviews.

## Future Browser Validation

When static pages are wired to APIs:

- Start `poc-server` in mock mode.
- Open `web/index.html` through the server.
- Walk the eight-step Store Learning & Blog Content Automation PoC flow.
- Confirm all product data requests are same-origin `/api/*` calls to `poc-server`.
- Confirm browser devtools never expose Naver/OpenAI credentials.
- Confirm the flow works without external keys.
- Confirm current HTML layout is not redesigned unless that task explicitly requests it.

