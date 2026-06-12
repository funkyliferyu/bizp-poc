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

Current next todo as of 2026-06-12:

1. Blog Formula V2 OpenAI formula extraction provider is merged and validated
   on `develop` through [PR #49](https://github.com/funkyliferyu/bizp-poc/pull/49),
   merge `c76c052`.
2. The first not-validated milestone is now milestone 14, final
   docs/validation cleanup or promotion prep when the user approves timing.
3. Keep V2 draft generation deterministic until the user explicitly approves
   OpenAI V2 draft generation or Hybrid/combined V1+V2 generation.
4. Keep the current ruleset preview endpoint as deterministic server/mock
   output unless the user explicitly approves a separate OpenAI preview
   provider task.
5. Keep `web/llm호출.html` as the temporary reviewer-facing verification table
   until the LLM provenance work either replaces it or the user says to remove
   it.
6. Prepare the `develop` -> `main` promotion path only after the user approves
   publication timing.

## Milestone Ledger

| # | Milestone | Current state | Tracking | Develop gate |
|---|---|---|---|---|
| 1 | 현황 감사와 데이터 매핑 | Validated on develop | [#26](https://github.com/funkyliferyu/bizp-poc/pull/26) | Covered by final develop validation after PR #38 |
| 2 | 매장정보등록 정리 | Validated on develop | [#27](https://github.com/funkyliferyu/bizp-poc/pull/27) | Covered by final develop validation after PR #38 |
| 3 | AI 학습 설정 데이터 정리 | Validated on develop | [#28](https://github.com/funkyliferyu/bizp-poc/pull/28) | Covered by final develop validation after PR #38 |
| 4 | 수집 실행 안정화 | Validated on develop | [#29](https://github.com/funkyliferyu/bizp-poc/pull/29) | Covered by final develop validation after PR #38 |
| 5 | 수집 데이터 선택/RAW 조회 확장 | Validated on develop | [#30](https://github.com/funkyliferyu/bizp-poc/pull/30) | Covered by final develop validation after PR #38 |
| 6 | 분석 실행과 룰셋 생성 계약 정리 | Validated on develop | [#31](https://github.com/funkyliferyu/bizp-poc/pull/31) | Covered by final develop validation after PR #38 |
| 7 | 마케팅 전략 룰셋 화면 적용 | Validated on develop | [#32](https://github.com/funkyliferyu/bizp-poc/pull/32) | Covered by final develop validation after PR #38 |
| 8 | AI 학습 현황 화면 적용 | Validated on develop | [#33](https://github.com/funkyliferyu/bizp-poc/pull/33) | Covered by final develop validation after PR #38 |
| 9 | 블로그 관리/콘텐츠 상세 후속 정리 | Validated on develop | [#34](https://github.com/funkyliferyu/bizp-poc/pull/34) | Covered by final develop validation after PR #38 |
| 10 | 마케팅 전략 룰셋 API 계약 후속 | Validated on develop | [#36](https://github.com/funkyliferyu/bizp-poc/pull/36) | Covered by final develop validation after PR #38 |
| 11 | 실등록 Store E2E 하드닝 | Validated on develop | [#37](https://github.com/funkyliferyu/bizp-poc/pull/37), [plan](MILESTONE_11_REAL_STORE_E2E_HARDENING_PLAN.md) | Covered by final develop validation after PR #38 |
| 12 | CR 후속: 수집 델타, 재학습 스킵, 학습 현황 표시 | Validated on develop | [#38](https://github.com/funkyliferyu/bizp-poc/pull/38), [plan](MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md), merge `204f964` | Develop validation recorded 2026-06-10 |
| 13 | LLM 호출 감사와 분석 입력 예산 | Validated on develop | [plan](NEXT_SESSION_LLM_CALL_AUDIT_PLAN.md), temporary table `web/llm호출.html`, merge `f17683b` | Follow-up validation recorded in `docs/codex/VALIDATION.md` |
| 13a | LLM 감사 로그, 근거 부족 재학습 차단, 룰셋 버전 원복 | Validated on develop | [Task 6](NEXT_SESSION_LLM_CALL_AUDIT_PLAN.md#task-6-add-server-side-llm-audit-logs), [Task 7](NEXT_SESSION_LLM_CALL_AUDIT_PLAN.md#task-7-gate-ruleset-regeneration-until-new-evidence-is-sufficient), [Task 8](NEXT_SESSION_LLM_CALL_AUDIT_PLAN.md#task-8-manage-ruleset-version-history-and-restore), PR #44, follow-up PR #45 | Develop validation recorded in `docs/codex/VALIDATION.md` |
| 13b | SL-A1 LLM 입력 구조 재설계 | Validated on develop | [plan](NEXT_SESSION_SL_A1_INPUT_REDESIGN_PLAN.md), commit `84f1684` | Pushed to `develop` and validated locally before integration |
| 13c | Blog SOP 룰셋 계약 적용 | Validated on develop | [plan](NEXT_SESSION_BLOG_SOP_RULESET_PLAN.md), PR #47, merge `b695643` | Develop validation recorded 2026-06-12 |
| 13d | Blog Formula V2 deterministic 실험 레인 | Validated on develop | [handoff](../BLOG_FORMULA_V2_HANDOFF.md), PR #48, merge `c8f1b52` | Develop validation recorded 2026-06-12 |
| 13e | Blog Formula V2 OpenAI 포뮬라 추출 provider | Validated on develop | [plan](NEXT_SESSION_BLOG_FORMULA_V2_OPENAI_FORMULA_PROVIDER_PLAN.md), [#49](https://github.com/funkyliferyu/bizp-poc/pull/49), merge `c76c052` | Develop validation recorded 2026-06-12 |
| 14 | 최종 문서/검증 정리 | Not started | - | Run after LLM call audit follow-up or when user approves publication cleanup |

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

### 10. 마케팅 전략 룰셋 API 계약 후속

- [x] Milestone plan/branch/PR exists: PR #36.
- [x] PR is merged to `develop`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 11. 실등록 Store E2E 하드닝

- [x] Milestone plan exists:
      `docs/codex/MILESTONE_11_REAL_STORE_E2E_HARDENING_PLAN.md`.
- [x] Implementation branch exists: `codex/real-store-e2e-hardening`.
- [x] Feature-branch validation is recorded in `docs/codex/VALIDATION.md`.
- [x] PR is merged to `develop`: #37, merge commit `5ffed45`.
- [ ] Develop validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Ledger is updated with current status.

### 12. CR 후속: 수집 델타, 재학습 스킵, 학습 현황 표시

Status:

- [x] Keep this as a planning backlog until the user says the CR list is
      complete.
- [x] After CR intake is complete, create a milestone-specific implementation
      plan before editing runtime code.
- [x] Milestone plan exists:
      `docs/codex/MILESTONE_12_COLLECTION_DELTA_RELEARNING_PLAN.md`.
- [x] Implementation branch exists: `codex/collection-delta-plan`.
- [x] Feature-branch validation is recorded in `docs/codex/VALIDATION.md`.
- [x] Task 12 parking manual-input CTA is implemented and feature-branch
      validated.
- [x] Task 13 our-store-analysis cleanup is implemented and feature-branch
      validated.
- [x] Task 14 writing-style actions/suggestions cleanup is implemented and
      feature-branch validated.
- [x] Task 15 no-new-content collection state is implemented and
      feature-branch validated.
- [x] Task 16 review-weakness legacy backfill is implemented and
      feature-branch validated.
- [x] Task 17 required-footer store-name/action-state cleanup is implemented
      and feature-branch validated.
- [x] Task 18 channel-level cached collection guidance is implemented and
      feature-branch validated.
- [x] PR is merged to `develop`: #38, merge commit `204f964`.
- [x] Develop validation is recorded in `docs/codex/VALIDATION.md`.

CR-Dedup-Relearning-001:

- Current behavior already prevents duplicate saves for some collected content,
  but only after provider collection finishes. The follow-up plan should keep
  this safe post-collection comparison first, then consider provider pre-filter
  optimizations later.
- Blog posts and Place reviews have identity-based duplicate handling.
  Place profile items need an identity or fingerprint so an unchanged profile
  is not treated as a new analyzable item every run.
- Add a Place profile fingerprint based on the Place URL plus stable normalized
  core metadata/body text. The comparison should distinguish `new`,
  `duplicate`, `unchanged`, and `changed` results.
- Persist collection delta state so collection progress can separately show
  신규 수집 0개, 기존 캐시 재사용, and 플레이스 정보 변경 없음.
- Before analysis execution, detect the no-op case: no new Blog posts, no new
  Place reviews, and Place profile `unchanged`.
- For the no-op case, skip analyzer execution, reuse the latest completed
  analysis/snapshot/ruleset, and navigate directly to learning status with a
  message equivalent to `이전과 동일해 학습을 종료합니다`.
- Keep `changed` Place profile behavior analyzable, so a real Place metadata
  change still regenerates the learning snapshot and ruleset.
- Add tests around collection item identity/fingerprint, collection run delta
  summaries, analysis skip/reuse behavior, and the collection/selection UI
  messages.
- Provider optimization is explicitly follow-up: after the correctness path is
  in place, evaluate latest publication date, review URL, or provider-specific
  pre-filtering to reduce fetch work.

CR-LearningStatus-Display-002:

- Blog collected-content rows in learning status must show the real blog
  publication date from provider metadata, not the collection date. The
  collection date is operational metadata and is not meaningful to the user
  reading this screen.
- Do not silently substitute `collectedAt` into a column labeled `발행일`.
  If the provider does not expose a real publication date, show an explicit
  empty/unknown value such as `-` or a separately labeled collection timestamp.
- Keep source-specific parsing server-side and continue serving the browser
  through `poc-server` APIs only.
- Add API/presenter tests that distinguish `publishedAt` from `collectedAt`
  and assert the learning status Blog tab serializes/renders the real
  publication date.
- Place reviews in learning status should show 5 reviews in the collapsed
  default state. The expanded/paginated state can continue to show larger pages,
  but the first collapsed view should provide enough review signal without
  requiring expansion.
- Add static/page tests for the Place review collapsed count and expanded
  pagination behavior so a future UI change does not regress back to 2 rows.

CR-Ruleset-StoreInfo-003:

- Marketing strategy ruleset > store info tab should apply improvement
  suggestions only for `operatingHours`, `closedDays`, and `parking`.
- For 운영시간, 휴무일, and 주차, render direct Place/store values in the
  store info tab and remove the current "future improvement" suggestion copy
  once those values are applied.
- Reject/hide improvement suggestions for store-info fields not mentioned in
  this CR. Do not silently apply or keep visible suggestion blocks for name,
  category, address, phone, business number, or store intro as part of this
  follow-up.
- Remove the lower "자동 입력 기준" block/table from the marketing strategy
  ruleset page UI. Keep source/status data behind API/tests only if it is still
  needed by existing contracts.
- Add static/page tests for `web/07_마케팅전략룰셋.html` and
  `web/ruleset_editor.js` proving:
  - 운영시간, 휴무일, and 주차 render as applied direct Place/store values.
  - unmentioned store-info improvement suggestion blocks are absent/rejected.
  - the lower automatic input criteria/source matrix block is absent from the
    rendered UI.
- Keep browser calls limited to `poc-server` APIs and avoid changing
  benchmark, preview, or live-provider scope while applying this UI cleanup.

CR-Ruleset-Reference-Industry-004:

- Marketing strategy ruleset > our-store-analysis reference boxes are excluded
  from this real-data wiring pass. They should remain common examples, not
  live connected benchmark or store-specific evidence.
- Make that example status explicit in every reference panel title by rendering
  the title in the form `(공통예시) 포지셔닝 참고`,
  `(공통예시) 업체 주장 강점 참고`, etc.
- Render the `(공통예시)` reference title treatment in red for every reference
  box, so users can immediately tell the panel is illustrative only.
- Add static/page tests covering all reference buttons/panels, not only the
  default positioning reference, so future changes do not reconnect one of the
  panels silently.
- Add industry-aware field presence rules for the our-store-analysis tab.
  Example: hospital/clinic categories should not show `대표 메뉴`; they should
  show a healthcare-appropriate field such as `대표 진료과목`.
- Keep field presence/label behavior data-driven by store category or business
  type where possible, while preserving fallback behavior for generic food,
  retail, and uncategorized stores.
- Add tests for at least one hospital/clinic fixture and one non-healthcare
  fixture proving the correct fields are visible/hidden and labels are
  category-appropriate.
- Do not modify reference boxes to call Naver, OpenAI, browser-side scraping,
  or any external provider. Browser code must continue using `poc-server` APIs
  only.

CR-Ruleset-WritingStyle-Medical-005:

- Marketing strategy ruleset > writing style needs an industry-common-rules
  row/block for industry-specific mandatory content.
- For healthcare/medical categories, add a rule equivalent to
  `블로그 하단에 반드시 의료법 관련 내용 포함`.
- Convert the attached medical-law footer reference into text and use it as
  the default required Blog footer copy for medical stores:
  `*본 포스팅은 테라스의원에서 의료정보 제공 및 병원 광고 목적으로 직접 작성한 글이며, <의료법 제 56조 제 1항>을 준수합니다.`
  and
  `*모든 시술은 개인의 피부에 따라 크고 작은 부작용이 발생할 수 있습니다. 반드시 사전에 의료진과 충분한 상담을 진행한 후 시술을 결정하시는 것을 권장드립니다.`
- Improve the catchphrase area so the user can configure content that must be
  included in every generated Blog post, instead of treating catchphrase as a
  single generic slogan only.
- Split or extend catchphrase UI into explicit required-inclusion slots such as
  Blog intro required copy and Blog footer required copy. This must support
  hospital cases where a repeated representative-doctor intro and medical-law
  footer need to appear in every post.
- Use the attached intro/footer examples as UI guidance: repeated intro copy may
  include representative doctor/profile language, and repeated footer copy may
  include clinic credentials, hours, phone, and compliance disclaimers.
- Keep these required-inclusion fields editable and lockable like existing
  ruleset fields, so user-edited mandatory copy is not overwritten by relearn.
- Ensure generated Blog preview/content can consume the new required-inclusion
  fields in a later implementation step; for this planning item, at minimum
  document the API/UI contract and tests needed.
- Add tests for healthcare category behavior and non-healthcare fallback:
  healthcare stores show medical common rules and required Blog footer controls;
  generic stores do not get medical-law copy by default.
- Browser code must continue calling only `poc-server` APIs; do not embed
  provider credentials or call external medical/legal sources from the browser.

CR-Ruleset-WritingStyle-AiSuggestions-006:

- Marketing strategy ruleset > writing style should be redesigned from a raw
  editable field list into a page that clearly shows:
  - the current writing style that AI inferred from existing Blog posts;
  - conservative AI suggestions that may improve CTA/conversion;
  - per-field evidence for why the suggestion is or is not needed.
- Remove/hide the writing-style `자동 입력 기준` source matrix block from the
  visible UI.
- Keep the existing editable text-field behavior, but present it as the
  current AI-inferred style rather than as a table-like technical settings
  dump.
- Add `글의 목적` as a top-level input in the writing-style common area.
  AI should analyze existing Blog posts and auto-fill at least 3 Blog purpose
  types. When multiple purposes exist, Blog generation should randomly select
  one or more purposes per generated post.
- Add `문장 스타일` as a top-level input in the writing-style common area.
  AI should analyze existing Blog posts and auto-fill the detected sentence
  style, then reuse that style consistently for generated posts.
- Add or promote these inputs so they are visible as first-class writing-style
  controls: `선호 길이`, `해시태그`, `이모지 사용`, `SEO 키워드`, and `CTA`.
  AI should infer them from existing Blog posts and reuse the same style in
  generated content.
- Add an AI suggestion panel to the right side of each current input. For each
  field, the panel should show:
  - a conservative improvement decision layer, either `개선 제안` or `현행유지`;
  - the suggested replacement or augmentation text when improvement is needed;
  - evidence from existing Blog/style analysis and CTA reasoning.
- Improvement decisions must be conservative. If there is no clear improvement
  opportunity, show `현행유지` rather than inventing new copy.
- Add tests proving the writing-style page no longer renders the source matrix,
  renders the current/suggestion two-column layout, exposes all required
  fields, and supports `현행유지` as a first-class AI judgment.
- Keep browser calls limited to `poc-server` APIs. AI analysis/suggestion data
  should come from server-side ruleset/analysis payloads or mock mode, not
  browser-side provider calls.

CR-Ruleset-ImageStyle-007:

- Marketing strategy ruleset > image style should make clear that the current
  image guidance is a common example, not real image-analysis output.
- Change the image-style block/header label to `(공통예시) 이미지 스타일`.
- Render that `(공통예시) 이미지 스타일` title in red, matching the common
  example treatment used by the our-store-analysis reference panels.
- Remove all visible `AI 처리`, `AI 판단`, and `개선 제안` source/note text
  from the image-style UI.
- Remove the visible image-style `자동 입력 기준` source matrix block.
- Promote source-matrix-only image guidance into top-level image-style fields:
  `비율·포맷` and `텍스트 오버레이` should appear after `피할 스타일`.
- Preserve the existing top image-style order before the new fields:
  `주 사용 색상`, `강조 색상`, `이미지 무드`, `주 사용 스타일`, `피할 스타일`.
- Keep browser calls limited to `poc-server` APIs. Do not add browser-side
  image analysis, Naver, OpenAI, or external provider calls.
- Add static/page tests proving the label, red common-example treatment,
  source-note removal, source-matrix removal, and promoted image controls.

CR-Ruleset-SimilarComparison-008:

- Marketing strategy ruleset > similar comparison should make clear that the
  current comparison content is a common example, not real competitor discovery
  or live benchmark evidence.
- Change the similar-comparison block/header label to
  `(공통예시) 유사업체비교`.
- Render that `(공통예시) 유사업체비교` title in red, matching the common
  example treatment used by the our-store-analysis reference panels and the
  planned image-style cleanup.
- Preserve existing comparison mock data, comparison type/company selection,
  `모두 비교`, evidence button behavior, and API boundaries.
- Do not add browser-side Naver, OpenAI, competitor discovery, scraping, or
  external provider calls.
- Add static/page tests proving the label, red common-example treatment, and
  absence of new external browser calls.

CR-Ruleset-ParkingManualInput-009:

- Marketing strategy ruleset > store info must treat missing parking as a
  manual input state, not an in-progress collection state.
- If parking is missing, render `수동입력 필요` instead of
  `주차 정보 수집 중`.
- Provide a right-aligned `매장정보에서 입력하기` action on the parking row.
- The action must navigate to the current store registration edit screen using
  `soho_store_register.html?storeId=<currentStoreId>&focus=parking`.
- Store registration should prefer the `storeId` query parameter over local
  storage, load the existing store, and focus or scroll to parking controls
  when `focus=parking` is present.
- Do not re-run Place collection or infer parking availability for missing
  parking. The state is explicitly manual input required.

CR-Ruleset-OurStoreAnalysis-010:

- Marketing strategy ruleset > 우리 매장 분석 needs a logic/evidence audit
  before implementation. Confirm where each field value is generated and
  whether the generation logic is clear enough for users and maintainers.
- Current ownership to verify:
  - `web/07_마케팅전략룰셋.html`: static tab markup and remaining brand
    source-matrix block.
  - `web/ruleset_editor.js`: hydration, aliases, healthcare labels,
    source-note/action/evidence modal rendering.
  - `poc-server/src/storeLearning/rulesets/rulesetService.ts`: ruleset payload,
    store facts, current values, save/reset/evidence API.
  - `poc-server/src/storeLearning/rulesets/rulesetSourceMatrix.ts`: field
    source definitions and current implementation/future suggestion metadata.
  - `poc-server/src/storeLearning/analysis/analyzer.ts` and
    `openAIAnalysisProvider.ts`: mock/live analyzer field output contract.
  - `poc-server/src/storeLearning/analysis/analysisExecutionService.ts`:
    persistence of analysis evidence and ruleset fields.
- `근거 보기` must show field-specific evidence. The current model can show
  repeated evidence when fields share the same collection item and no
  field-specific reason is persisted.
- Representative treatment subjects for healthcare stores must come from real
  Place/store metadata such as hospital subjects, not bakery/menu mock data.
- Rename visible `AI 원값` action/state copy to `초기화`.
- Remove visible `AI 처리`, `AI 판단`, and `개선 제안` diagnostics from
  우리 매장 분석.
- Remove the remaining `자동 입력 기준` block from 우리 매장 분석.
- Keep browser calls limited to `poc-server` APIs. Do not add browser-side
  Naver/OpenAI/external provider calls.

### 13. 최종 문서/검증 정리

- [ ] Confirm milestones 1-12 are merged to `develop`.
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
#26 -> #27 -> #28 -> #29 -> #30 -> #31 -> #32 -> #33 -> #34 -> #36 -> #37 -> CR follow-up
```

PRs #26-#34, #36, #37, and #38 have been merged to `develop`. Final develop
validation after PR #38 passed on 2026-06-10. LLM call audit follow-up and
SL-A1 input redesign work have since been integrated into `develop`; the Blog
SOP ruleset contract is locally validated on `codex/blog-sop-ruleset-contract`
and should be integrated next.

Blog SOP contract trim follow-up on `codex/blog-sop-ruleset-contract`:

- Remove Instagram and image-style fields from the active SL-A1 analyzer input,
  OpenAI response schema, source matrix, seed data, and ruleset UI.
- Keep only the Blog writing-style surface in the marketing ruleset page; the
  previous visible `공통` tab is now labelled `블로그`.
- Keep deferred Instagram/image prompt and schema pieces in
  `docs/codex/DEFERRED_INSTAGRAM_IMAGE_CONTRACT.md` for later reuse.
- Learning status should render `마지막 학습일` with seconds:
  `YYYY.MM.DD HH:mm:ss`.

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
