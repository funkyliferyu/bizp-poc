# Store Learning Sequential Plan Ledger

> **For agentic workers:** This is the develop-based source of truth for
> "next todo" selection. Before creating a milestone-specific plan, branch, or
> PR, read this ledger and update it as the work moves through plan, PR,
> develop merge, and develop validation.

**Goal:** Keep Store Learning work sequential, reviewable, and recoverable
across Codex sessions.

**Architecture:** Milestone-specific plans and PRs are subordinate to this
ledger. A milestone is not complete just because a branch or draft PR exists;
it is complete only after it is merged to `develop` and validated on
`develop`.

**Tech Stack:** Static HTML/CSS/JS in `web/`, Express/TypeScript in
`poc-server`, SQLite local PoC persistence, GitHub PRs, and local validation
commands under `poc-server/`.

---

## Operating Rules

- Work sequentially from the first milestone whose develop gate is not done.
- Do not start a later milestone from `develop` until earlier milestones are
  merged and validated, unless the user explicitly chooses a stacked PR flow.
- If a stacked PR flow is used, record the stack order here and still treat
  `develop` merge plus validation as the completion gate.
- Create `docs/codex/MILESTONE_*` plans only for the current next todo.
- Update this ledger whenever a milestone moves from planned to PR open,
  merged to `develop`, validated on `develop`, or promoted to `main`.
- Keep `admin/`, `pc-web/`, and old Event-to-Operation files untouched unless
  the user explicitly changes scope.
- Browser pages must call only `poc-server` APIs. Naver/OpenAI credentials stay
  server-side.

## Status Vocabulary

- `Not started`: no active branch or milestone plan.
- `Planned`: the milestone plan exists, but implementation is not ready for
  review.
- `Implementation PR open`: a branch/PR exists, but it is not merged to
  `develop`.
- `Merged to develop`: the PR contents are on `develop`, but full develop
  validation is not yet recorded.
- `Validated on develop`: local validation passed on `develop`.
- `Promoted to main`: the validated develop work has been merged to `main` for
  GitHub Pages/static publication.

## Next Todo Rule

The next todo is the first milestone below that is not `Validated on develop`.
If its PR is open, the todo is to review, merge or retarget that PR, then
validate on `develop`; it is not to skip ahead.

Current next todo as of 2026-06-09:

1. Run milestone 10 final develop validation.
2. Update `docs/codex/HANDOFF.md` and `docs/codex/VALIDATION.md` with the
   develop validation result.
3. Prepare the `develop` -> `main` promotion path only after validation passes
   and the user approves publication timing.

## Milestone Ledger

| # | Milestone | Current state | Tracking | Develop gate |
|---|---|---|---|---|
| 1 | 현황 감사와 데이터 매핑 | Merged to develop | [#26](https://github.com/funkyliferyu/bizp-poc/pull/26) | Awaiting milestone 10 validation |
| 2 | 매장정보등록 정리 | Merged to develop | [#27](https://github.com/funkyliferyu/bizp-poc/pull/27) | Awaiting milestone 10 validation |
| 3 | AI 학습 설정 데이터 정리 | Merged to develop | [#28](https://github.com/funkyliferyu/bizp-poc/pull/28) | Awaiting milestone 10 validation |
| 4 | 수집 실행 안정화 | Merged to develop | [#29](https://github.com/funkyliferyu/bizp-poc/pull/29) | Awaiting milestone 10 validation |
| 5 | 수집 데이터 선택/RAW 조회 확장 | Merged to develop | [#30](https://github.com/funkyliferyu/bizp-poc/pull/30) | Awaiting milestone 10 validation |
| 6 | 분석 실행과 룰셋 생성 계약 정리 | Merged to develop | [#31](https://github.com/funkyliferyu/bizp-poc/pull/31) | Awaiting milestone 10 validation |
| 7 | 마케팅 전략 룰셋 화면 적용 | Merged to develop | [#32](https://github.com/funkyliferyu/bizp-poc/pull/32) | Awaiting milestone 10 validation |
| 8 | AI 학습 현황 화면 적용 | Merged to develop | [#33](https://github.com/funkyliferyu/bizp-poc/pull/33) | Awaiting milestone 10 validation |
| 9 | 블로그 관리/콘텐츠 상세 후속 정리 | Merged to develop | [#34](https://github.com/funkyliferyu/bizp-poc/pull/34) | Awaiting milestone 10 validation |
| 10 | 최종 문서/검증 정리 | Not started | - | Ready to run |

## Sequential Checklist

### 1. 현황 감사와 데이터 매핑

- [x] Milestone plan/branch/PR exists: PR #26.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 2. 매장정보등록 정리

- [x] Milestone plan/branch/PR exists: PR #27.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 3. AI 학습 설정 데이터 정리

- [x] Milestone plan/branch/PR exists: PR #28.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 4. 수집 실행 안정화

- [x] Milestone plan/branch/PR exists: PR #29.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 5. 수집 데이터 선택/RAW 조회 확장

- [x] Milestone plan/branch/PR exists: PR #30.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 6. 분석 실행과 룰셋 생성 계약 정리

- [x] Milestone plan/branch/PR exists: PR #31.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 7. 마케팅 전략 룰셋 화면 적용

- [x] Milestone plan/branch/PR exists: PR #32.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 8. AI 학습 현황 화면 적용

- [x] Milestone plan/branch/PR exists: PR #33.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 9. 블로그 관리/콘텐츠 상세 후속 정리

- [x] Milestone plan/branch/PR exists: PR #34.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 10. 최종 문서/검증 정리

- [x] Confirm milestones 1-9 are merged to `develop`.
- [ ] Run `cd poc-server && npm run typecheck`.
- [ ] Run `cd poc-server && npm test`.
- [ ] Run `cd poc-server && npm run demo:store-learning`.
- [ ] If live credentials are available and the user requests it, run
      `cd poc-server && npm run naver:verify`.
- [ ] Update `docs/codex/HANDOFF.md`.
- [ ] Update `docs/codex/VALIDATION.md`.
- [ ] Open or prepare the `develop` -> `main` promotion PR if GitHub Pages
      should receive the static UI snapshot.

## Session Startup Procedure

1. Read `AGENTS.md`, `poc-server/AGENTS.md`,
   `docs/codex/GIT_WORKFLOW.md`, `docs/codex/CURRENT_TASK.md`,
   this file, `docs/codex/HANDOFF.md`, and `docs/codex/VALIDATION.md`.
2. Confirm:
   - `pwd`
   - current branch
   - `git status --short --branch`
   - intended milestone number
   - PR base
   - allowed files
   - forbidden areas
   - validation commands
3. Use the Next Todo Rule above to choose work.
4. If implementation is needed, branch from `develop` unless the user
   explicitly requests another base.
5. If the chosen milestone already has a PR, inspect that PR before making new
   changes.
6. Update this ledger after each meaningful state change.

## Current PR Stack Order

The current implementation stack should be integrated in this order:

```text
#26 -> #27 -> #28 -> #29 -> #30 -> #31 -> #32 -> #33 -> #34
```

This stack has been merged to `develop`. The next todo is milestone 10
develop validation and document handoff.

## Validation Commands

For documentation-only ledger updates:

```bash
git diff --check
```

For implementation milestones:

```bash
cd poc-server
npm run typecheck
npm test
npm run demo:store-learning
```

Optional live-provider validation when explicitly requested and credentials are
available:

```bash
cd poc-server
npm run naver:verify
```
