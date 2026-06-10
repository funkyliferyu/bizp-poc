# Current Codex Task

## Current Phase

Sequential plan ledger control for Store Learning work.

## Repository State

- `main` is the intended public/stable branch.
- `develop` is the intended integration branch.
- `docs/codex/PLAN.md` is the central checklist for deciding the next todo.
- Milestone PRs #26-#34, #36, and #37 are merged to `develop`.
- Milestone 12 CR follow-up is implemented and validated through Task 16 on
  `codex/collection-delta-plan`, including the additional ruleset store-info,
  common-reference, industry-field, writing-style, image-style,
  similar-comparison, parking, our-store-analysis, no-new-content collection,
  and review-weakness backfill CR items.
- Image-style and similar-comparison UI CRs are implemented and validated on
  the milestone 12 branch as Task 10 and Task 11.
- PR #38 is open and ready for review from `codex/collection-delta-plan` to
  `develop`.
- Non-admin merge attempts for PR #38 are blocked by the `develop` base branch
  policy; repository auto-merge is disabled.
- The parking manual-input CR is implemented and validated as milestone 12
  Task 12. PR #38 has been updated with the follow-up.
- The our-store-analysis CR is implemented and validated as milestone 12
  Task 13. PR #38 has been updated with the follow-up.
- The writing-style action/suggestion/placeholder CR is implemented and
  validated as milestone 12 Task 14. PR #38 has been updated with the
  follow-up.
- The no-new-content collection state bugfix is implemented and validated as
  milestone 12 Task 15 on the PR #38 branch.
- The review-weakness legacy backfill/action bugfix is implemented and
  validated as milestone 12 Task 16 on the PR #38 branch.
- The required-footer store-name/action-state cleanup CR is implemented and
  validated as milestone 12 Task 17 on the PR #38 branch.
- Milestones are not fully complete until the work is merged to `develop` and
  develop validation is recorded.
- `docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md` is the current
  implementation plan; PR #38 merge is the next item after Task 17 validation.

## Branch Policy

Use:

```text
feature/* -> develop -> main
```

`main` is for public/static UI access and stable snapshots. `develop` is for API-backed local integration validation.

## Runtime Validation Policy

GitHub Pages is static UI only. Store Learning runtime behavior requires:

- local `poc-server`
- SQLite
- server-side `.env` for real providers when needed
- mock mode for no-key local review

Default local validation:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
```

Manual runtime smoke:

```bash
cd poc-server
npm run dev
```

Open:

```text
http://localhost:5177/soho_store_register.html
```

## Next Exact Step

Start every session by reading `docs/codex/PLAN.md` and choosing the first
milestone that is not validated on `develop`.

Current next todo:

1. Have an authorized reviewer/admin satisfy the PR #38 base branch policy
   and merge it to `develop` after Task 17 is complete.
2. After the CR follow-up work merges to `develop`, run final validation:
   - `cd poc-server && npm run typecheck`
   - `cd poc-server && npm test`
   - `cd poc-server && npm run demo:store-learning`
4. Update `docs/codex/HANDOFF.md` and `docs/codex/VALIDATION.md` with the
   validation result.
5. Prepare the `develop` -> `main` promotion path only after validation passes
   and the user approves publication timing.

Before editing files, confirm:

1. `pwd`
2. current branch
3. `git status --short`
4. next ledger todo
5. intended task id and scope
6. files allowed to change
7. files forbidden to change
8. validation commands

## Forbidden Areas By Default

- `admin/`
- `pc-web/`
- old Event-to-Operation source-of-truth files
- browser-side Naver/OpenAI calls
- committed `.env`, runtime SQLite DBs, `.DS_Store`, or secrets
