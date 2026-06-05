# Acceptance Checklist v0

## Scope

This checklist is for the Store Learning & Blog Content Automation PoC planning and future implementation.

## Docs-Only PR Checklist

- [ ] `AGENTS.md` exists and names the Store Learning & Blog Content Automation PoC.
- [ ] `poc-server/AGENTS.md` exists and keeps server credentials/provider calls server-side.
- [ ] `docs/product/store-learning-blog-content-poc.md` documents the eight-step new flow.
- [ ] `docs/product/store-learning-blog-content-poc.md` maps every existing `web/*.html` static screen to future API/data responsibility.
- [ ] `docs/architecture/runtime-model-v0.md` states browser pages call `poc-server` APIs only.
- [ ] `docs/architecture/runtime-model-v0.md` states mock mode works without external keys.
- [ ] `docs/architecture/data-model-v0.md` recommends SQLite for the local PoC DB.
- [ ] `docs/architecture/data-model-v0.md` includes repository-layer guidance for future Postgres migration.
- [ ] `docs/architecture/api-contract-v0.md` keeps Naver/OpenAI credentials server-side.
- [ ] `docs/architecture/api-contract-v0.md` includes provider capability/error handling for Naver API limitations.
- [ ] `docs/codex/PLAN.md`, `docs/codex/HANDOFF.md`, and `docs/codex/VALIDATION.md` exist.
- [ ] Existing Event-to-Operation files are untouched.
- [ ] `admin/` is untouched.
- [ ] `pc-web/` is untouched.
- [ ] Existing HTML screens are not redesigned in this PR.

## Future Product Acceptance Checklist

- [ ] Store registration accepts a Naver Place URL and resolves store fields through a server-side adapter.
- [ ] Store registration can run in mock mode without Naver credentials.
- [ ] AI learning settings save Naver Blog, Naver Place, representative keywords, and store material inclusion.
- [ ] Collection run progress polls `poc-server` and shows per-channel status.
- [ ] Collection failure state can retry failed channels only.
- [ ] Content selection shows collected Blog and Place items with body availability/capability status.
- [ ] Analysis can run using selected content only.
- [ ] AI learning status includes Blog, Place, and Instagram tabs.
- [ ] Instagram can remain mock/manual until provider scope is approved.
- [ ] Strategy ruleset is editable and persists changes.
- [ ] Strategy ruleset preview regeneration does not overwrite saved rules without explicit save.
- [ ] Blog management lists AI-generated approval-pending posts.
- [ ] AI content detail displays generated article, image choices, preview, SEO score, and regeneration actions.
- [ ] Blog post approval, publish request, and published states are persisted.
- [ ] LLM-generated strategy rulesets are validated with Zod before save.
- [ ] LLM-generated blog articles are validated with Zod before save.
- [ ] LLM-generated SEO scores and image prompts are validated with Zod before save.
- [ ] Real Naver collection is adapter-backed.
- [ ] Official Naver API limitations are visible through provider capabilities and fallback states.
- [ ] No browser code contains Naver/OpenAI credentials.
- [ ] Browser pages call only `poc-server` API endpoints.

## Validation Commands

Run these for docs-only changes:

```bash
git diff --name-only
git diff --stat
git diff -- AGENTS.md poc-server/AGENTS.md docs/product/store-learning-blog-content-poc.md docs/architecture/runtime-model-v0.md docs/architecture/data-model-v0.md docs/architecture/api-contract-v0.md docs/qa/acceptance-checklist-v0.md docs/codex/PLAN.md docs/codex/HANDOFF.md docs/codex/VALIDATION.md
```

When product behavior is implemented later, also run:

```bash
cd poc-server
npm test
npm run typecheck
```

