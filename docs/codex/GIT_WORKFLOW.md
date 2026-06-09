# Git Workflow

This repository uses a stable-public plus integration branch model for the Store Learning & Blog Content Automation PoC.

## Branch Roles

- `main`: public/stable branch.
  - GitHub Pages should use this branch for static UI access.
  - Keep this branch in a demo-safe state.
  - Do not use GitHub Pages alone as runtime validation; it is static UI only.
- `develop`: integration branch.
  - Merge feature PRs here first.
  - Run local server and SQLite-backed smoke validation here before promoting to `main`.
- `feature/*` or `codex/*`: task branches.
  - Branch from `develop` unless the user explicitly requests a different base.
  - Open PRs back to `develop`.

## PR Flow

```text
feature/* -> develop -> main
```

Feature PRs should be small enough to review and validate locally.

When a group of feature PRs is stable on `develop`, open a promotion PR:

```text
develop -> main
```

## Sequential Plan Ledger

`docs/codex/PLAN.md` is the develop-based sequential plan ledger for Store
Learning work.

Before creating a milestone-specific `docs/codex/MILESTONE_*` plan, branch, or
PR:

- Read `docs/codex/PLAN.md`.
- Confirm the first milestone that is not merged and validated on `develop`.
- Use that item as the next todo.
- Update the ledger when a milestone is planned, opened as a PR, merged to
  `develop`, validated on `develop`, or promoted to `main`.

An open branch or draft PR is progress, but it is not completion. Completion
means the work is on `develop` and the relevant validation has been recorded.

Stacked PRs are allowed only when the user explicitly chooses that flow. If a
stack is used, record the stack order in `docs/codex/PLAN.md`, merge parents
first, and retarget child PRs as needed.

## Runtime Validation

GitHub Pages can show static pages, but it cannot validate Store Learning runtime behavior.

The product flow depends on:

- `poc-server` APIs
- local SQLite data
- server-side `.env` credentials for real providers
- mock mode for no-key review

Use local validation before merging into `main`:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo
npm run demo:store-learning
npm run dev
```

Then open:

```text
http://localhost:5177/soho_store_register.html
```

## PR Checklist

Before opening a PR:

- Confirm the current branch.
- Confirm the PR base branch.
- Run `git status --short`.
- Run `git diff --stat`.
- Run the relevant validation commands.
- Confirm no `admin/` or `pc-web/` changes are included unless explicitly requested.
- Confirm no `.DS_Store`, SQLite runtime DB, `.env`, generated approval files, or secret-bearing files are staged.
- Update `docs/codex/HANDOFF.md` and `docs/codex/VALIDATION.md` when behavior, validation, or operating notes change.

## New Session Startup

For a new Codex session, ask the agent to read:

- `AGENTS.md`
- `poc-server/AGENTS.md`
- `docs/codex/GIT_WORKFLOW.md`
- `docs/codex/CURRENT_TASK.md`
- `docs/codex/PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`

The agent should confirm `pwd`, current branch, `git status --short`, task
scope, the next ledger todo, forbidden areas, and validation commands before
editing files.
