# Store Learning PoC Agent Guide

## Product Source Of Truth

This repository is now planning the Store Learning & Blog Content Automation PoC.

The new PoC flow is:

1. Store registration from a Naver Place URL.
2. AI training settings using Naver Blog and Naver Place.
3. Collection run progress screen.
4. Select collected content for analysis.
5. AI learning status screen with Blog, Place, and Instagram tabs.
6. Editable marketing strategy ruleset.
7. Blog management showing AI-generated approval-pending posts.
8. AI content detail showing generated article, images, preview, SEO score, and regeneration actions.

Do not treat `README_POC.md` or `web/event_operation_poc.html` as the product source of truth for this work. They belong to the older Event-to-Operation / watermelon event flow and must stay untouched unless a future task explicitly says otherwise.

## Repository Boundaries

- Do not modify `admin/` for this PoC.
- Do not modify `pc-web/` for this PoC.
- Do not redesign existing static HTML pages in `web/` unless a future task explicitly asks for UI changes.
- Keep the old Event-to-Operation files untouched.
- Product planning and operating docs live under `docs/product/`, `docs/architecture/`, `docs/qa/`, and `docs/codex/`.
- Runtime code for the PoC will live under `poc-server/` when implementation begins.

## Git Workflow

- Branch workflow is documented in `docs/codex/GIT_WORKFLOW.md`.
- `main` is the public/stable branch and GitHub Pages source.
- `develop` is the integration branch for API-backed local validation.
- Feature work should branch from `develop` unless the user explicitly requests another base.
- Before starting a new task, confirm `pwd`, current branch, PR base, `git status --short`, task scope, forbidden areas, and validation commands.
- GitHub Pages is static UI only. Store Learning runtime behavior must be validated with local `poc-server` APIs and SQLite.

## Browser And API Rules

- Browser pages must call `poc-server` APIs only.
- Browser pages must not call Naver, OpenAI, scraping providers, or other external provider APIs directly.
- Naver/OpenAI credentials must stay server-side and must never appear in static HTML, browser JavaScript, local storage, query strings, screenshots, or fixtures committed to the repo.
- Mock mode must work without external keys so reviewers can run the PoC locally.

## Architecture Direction

- Use SQLite as the local PoC database.
- Put all persistence behind repository interfaces so the PoC can later move to Postgres without rewriting browser flows or workflow code.
- Put real Naver collection behind provider adapters.
- Account for Naver API limits: official APIs are limited, and full blog body plus Place reviews require separate provider/fallback design.
- Validate all LLM outputs with Zod schemas and structured validation before saving.
