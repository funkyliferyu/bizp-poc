# Milestone 02 Store Registration Cleanup Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make store registration a reliable base for later Store Learning steps by treating `사업자번호` as optional while preserving current Naver Place metadata population.

**Architecture:** This milestone is a narrow browser contract change. Static page tests define required-field behavior, then `web/soho_store_register.html` and `web/soho_store_register.js` are updated without changing provider, API, database, or visual layout boundaries.

**Tech Stack:** Static HTML/JavaScript in `web/`, Vitest static page tests in `poc-server/test`, Store Learning docs under `docs/codex`.

---

## Scope

Included:

- Remove the visible required marker from the business-number field.
- Remove `f-biz` from browser required-field validation in both the current page script and the legacy inline fallback script.
- Keep business number as an optional manual metadata value when entered.
- Preserve existing Naver Place parsed metadata population and RAW/RAG hooks.
- Update Codex handoff and validation notes for this milestone.

Excluded:

- Server schema changes.
- Database migrations.
- Provider changes.
- UI redesign.
- Blog collection changes.
- `admin/`, `pc-web/`, and old Event-to-Operation files.

## Task 1: Branch And Baseline

**Files:**

- Read: `docs/product/STORE_LEARNING_DATA_MAP.md`
- Read: `web/soho_store_register.html`
- Read: `web/soho_store_register.js`
- Read: `poc-server/test/storeRegistrationPage.test.ts`

- [x] Step 1: Create `codex/store-registration-cleanup` from the current Milestone 01 branch.

Expected:

- This branch is stacked on `codex/store-learning-data-map-audit` until PR #26 is merged.
- Existing unrelated `.DS_Store` local modification remains unstaged.

- [x] Step 2: Confirm the current business-number required behavior.

Expected current state:

- `web/soho_store_register.html` shows `사업자번호 <span class="req">*</span>`.
- `web/soho_store_register.js` includes `f-biz` in `validateRequiredFields`.
- The legacy inline `submitForm` script in `web/soho_store_register.html` also includes `f-biz` in its required array.

## Task 2: TDD For Optional Business Number

**Files:**

- Modify: `poc-server/test/storeRegistrationPage.test.ts`

- [x] Step 1: Add a failing static page contract test.

Add a test named:

```ts
it('treats business number as optional in browser validation', () => {
  const html = readFileSync(path.join(webRoot, 'soho_store_register.html'), 'utf8');
  const js = readFileSync(path.join(webRoot, 'soho_store_register.js'), 'utf8');

  expect(html).toContain('<label>사업자번호</label>');
  expect(html).not.toContain('<label>사업자번호 <span class="req">*</span></label>');
  expect(js).toContain("const required = ['f-type', 'f-name', 'f-tel', 'f-addr1', 'f-open', 'f-close']");
  expect(js).not.toContain("const required = ['f-type', 'f-name', 'f-biz'");
  expect(html).not.toContain("const required = ['f-type', 'f-name', 'f-biz'");
});
```

- [x] Step 2: Run the focused test and verify RED.

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts -t "business number"
```

Expected:

- FAIL because the label still includes the required marker or `f-biz` remains in a required array.

## Task 3: Make Business Number Optional

**Files:**

- Modify: `web/soho_store_register.html`
- Modify: `web/soho_store_register.js`

- [x] Step 1: Remove the business-number required marker.

Change:

```html
<label>사업자번호 <span class="req">*</span></label>
```

to:

```html
<label>사업자번호</label>
```

- [x] Step 2: Remove `f-biz` from the legacy inline required array.

Change:

```js
const required = ['f-type', 'f-name', 'f-biz', 'f-tel', 'f-addr1', 'f-open', 'f-close'];
```

to:

```js
const required = ['f-type', 'f-name', 'f-tel', 'f-addr1', 'f-open', 'f-close'];
```

- [x] Step 3: Remove `f-biz` from the current page script required array.

Change the same required array in `validateRequiredFields`.

- [x] Step 4: Keep optional persistence.

Do not remove:

```js
businessNumber: readValue('f-biz')
```

Expected:

- Empty business number does not block browser save.
- Entered business number still persists in metadata.

## Task 4: GREEN And Regression Validation

**Files:**

- Read: `poc-server/test/storeRegistrationPage.test.ts`
- Read: `web/soho_store_register.html`
- Read: `web/soho_store_register.js`

- [x] Step 1: Run focused business-number test.

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts -t "business number"
```

Expected: PASS.

- [x] Step 2: Run full store registration page test.

Run from `poc-server/`:

```bash
npm test -- storeRegistrationPage.test.ts
```

Expected: PASS.

- [x] Step 3: Run typecheck.

Run from `poc-server/`:

```bash
npm run typecheck
```

Expected: PASS.

- [x] Step 4: Check whitespace.

Run from repo root:

```bash
git diff --check
```

Expected: no output and exit code `0`.

## Task 5: Update Operating Docs

**Files:**

- Modify: `docs/codex/HANDOFF.md`
- Modify: `docs/codex/VALIDATION.md`

- [x] Step 1: Add Milestone 02 scope to `HANDOFF.md`.
- [x] Step 2: Add Milestone 02 commands and final validation evidence to `VALIDATION.md`.

Expected:

- Future sessions know `사업자번호` optionality was intentionally changed.

## Task 6: Publish

**Files:**

- Stage only milestone files.

- [x] Step 1: Confirm staged files exclude `.DS_Store`.

Expected milestone files:

- `docs/codex/MILESTONE_02_STORE_REGISTRATION_PLAN.md`
- `docs/codex/HANDOFF.md`
- `docs/codex/VALIDATION.md`
- `poc-server/test/storeRegistrationPage.test.ts`
- `web/soho_store_register.html`
- `web/soho_store_register.js`

- [ ] Step 2: Commit.

Suggested commit:

```bash
git commit -m "fix: make business number optional"
```

- [ ] Step 3: Push and open a draft stacked PR.

Expected:

- PR targets `codex/store-learning-data-map-audit` while PR #26 is open.
- After PR #26 merges, retarget this PR to `develop`.
