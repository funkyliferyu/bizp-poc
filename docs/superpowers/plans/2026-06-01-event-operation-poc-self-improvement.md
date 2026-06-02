# Event Operation PoC Self Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the original PoC scope intact while making the feasibility decision more reliable, repeatable, and reviewable.

**Architecture:** Keep the existing static `web/event_operation_poc.html` UI and `poc-server` Express/Zod/JSON-file architecture. Add only lightweight evaluators, fixtures, and UI affordances that improve the current approval-package judgment; do not add real publishing, auth, databases, or external channel integrations.

**Tech Stack:** Node.js, Express, TypeScript, Zod, Vitest, static HTML/CSS/JS, existing `web/common.css` and `web/icons.js`.

---

## Scope Guardrails

This plan must stay faithful to the first instruction:

- Keep existing HTML screens working.
- Keep `web/event_operation_poc.html` as the new PoC screen.
- Keep JSON file storage.
- Keep actual Naver/RCS/chatbot publishing out of scope.
- Keep mock mode fully functional without `OPENAI_API_KEY`.
- Keep final output focused on drafts, quality report, and approval package.

## File Structure

- Modify `poc-server/src/schemas/approvalPackage.ts`: add decision readiness fields.
- Modify `poc-server/src/workflows/buildApprovalPackage.ts`: calculate readiness score and review recommendation.
- Create `poc-server/src/workflows/evaluateDecisionReadiness.ts`: pure deterministic evaluator.
- Create `poc-server/test/decisionReadiness.test.ts`: test approval/revision/rejection recommendations.
- Modify `poc-server/src/fixtures/watermelonEvent.json`: keep baseline fixture unchanged unless tests need local copies.
- Modify `web/event_operation_poc.html`: show decision recommendation and remaining blockers.
- Modify `README_POC.md`: add an explicit self-improvement loop and demo checklist.

## Task 1: Decision Readiness Evaluator

**Files:**
- Create: `poc-server/src/workflows/evaluateDecisionReadiness.ts`
- Test: `poc-server/test/decisionReadiness.test.ts`

- [ ] **Step 1: Write failing tests**

Create `poc-server/test/decisionReadiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateDecisionReadiness } from '../src/workflows/evaluateDecisionReadiness.js';
import type { QualityReport } from '../src/schemas/approvalPackage.js';

const report = (status: QualityReport['status'], failCount = 0, warnCount = 0): QualityReport => ({
  status,
  items: [
    ...Array.from({ length: failCount }, (_, index) => ({
      key: `fail.${index}`,
      label: `Fail ${index}`,
      status: 'fail' as const,
      detail: '필수 정보 누락'
    })),
    ...Array.from({ length: warnCount }, (_, index) => ({
      key: `warn.${index}`,
      label: `Warn ${index}`,
      status: 'warn' as const,
      detail: '사람 검토 필요'
    }))
  ]
});

describe('evaluateDecisionReadiness', () => {
  it('recommends approve when there are no blockers', () => {
    expect(evaluateDecisionReadiness(report('pass'))).toEqual({
      score: 100,
      recommendation: 'approve',
      blockers: []
    });
  });

  it('recommends revise when warnings exist without failures', () => {
    const result = evaluateDecisionReadiness(report('warn', 0, 2));

    expect(result.recommendation).toBe('revise');
    expect(result.score).toBe(80);
    expect(result.blockers).toEqual(['Warn 0', 'Warn 1']);
  });

  it('recommends reject when failures exist', () => {
    const result = evaluateDecisionReadiness(report('fail', 1, 1));

    expect(result.recommendation).toBe('reject');
    expect(result.score).toBe(55);
    expect(result.blockers).toEqual(['Fail 0', 'Warn 0']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd poc-server
npm test -- decisionReadiness.test.ts
```

Expected: FAIL because `evaluateDecisionReadiness.ts` does not exist.

- [ ] **Step 3: Implement evaluator**

Create `poc-server/src/workflows/evaluateDecisionReadiness.ts`:

```ts
import type { QualityReport } from '../schemas/approvalPackage.js';

export type DecisionReadiness = {
  score: number;
  recommendation: 'approve' | 'revise' | 'reject';
  blockers: string[];
};

export function evaluateDecisionReadiness(report: QualityReport): DecisionReadiness {
  const failures = report.items.filter((item) => item.status === 'fail');
  const warnings = report.items.filter((item) => item.status === 'warn');
  const blockers = [...failures, ...warnings].map((item) => item.label);

  if (failures.length > 0) {
    return {
      score: Math.max(0, 70 - failures.length * 15 - warnings.length * 5),
      recommendation: 'reject',
      blockers
    };
  }

  if (warnings.length > 0) {
    return {
      score: Math.max(70, 90 - warnings.length * 5),
      recommendation: 'revise',
      blockers
    };
  }

  return {
    score: 100,
    recommendation: 'approve',
    blockers: []
  };
}
```

- [ ] **Step 4: Verify green**

Run:

```bash
cd poc-server
npm test -- decisionReadiness.test.ts
```

Expected: PASS.

## Task 2: Add Readiness to Approval Package

**Files:**
- Modify: `poc-server/src/schemas/approvalPackage.ts`
- Modify: `poc-server/src/workflows/buildApprovalPackage.ts`
- Test: `poc-server/test/demoFlow.test.ts`

- [ ] **Step 1: Write failing assertions**

In `poc-server/test/demoFlow.test.ts`, add:

```ts
expect(approval.decisionReadiness).toEqual({
  score: 100,
  recommendation: 'approve',
  blockers: []
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd poc-server
npm test -- demoFlow.test.ts
```

Expected: FAIL because `decisionReadiness` is missing.

- [ ] **Step 3: Extend schema**

Add to `ApprovalPackageSchema`:

```ts
decisionReadiness: z.object({
  score: z.number().min(0).max(100),
  recommendation: z.enum(['approve', 'revise', 'reject']),
  blockers: z.array(z.string())
})
```

- [ ] **Step 4: Populate from evaluator**

In `buildApprovalPackage.ts`, import and use:

```ts
import { evaluateDecisionReadiness } from './evaluateDecisionReadiness.js';
```

Then add:

```ts
decisionReadiness: evaluateDecisionReadiness(qualityReport),
```

- [ ] **Step 5: Verify package behavior**

Run:

```bash
cd poc-server
npm test
npm run typecheck
```

Expected: all tests and typecheck pass.

## Task 3: Make UI Decision-Centered

**Files:**
- Modify: `web/event_operation_poc.html`

- [ ] **Step 1: Add readiness metric to review summary**

In `renderApproval`, add a summary metric:

```js
['판정', `${approval.decisionReadiness.recommendation} (${approval.decisionReadiness.score})`]
```

- [ ] **Step 2: Add blocker list below review summary**

Add:

```html
<div class="hint-box hidden" id="readinessBlockers"></div>
```

In `renderApproval`, set:

```js
const blockers = approval.decisionReadiness.blockers;
$('readinessBlockers').classList.toggle('hidden', blockers.length === 0);
$('readinessBlockers').innerHTML = blockers.length
  ? `<span data-icon="alert-triangle"></span><div>확인 필요: ${blockers.join(', ')}</div>`
  : '';
```

- [ ] **Step 3: Make approval button state follow recommendation**

In `renderApproval`, add:

```js
const approveBtn = $('approveBtn');
approveBtn.disabled = approval.decisionReadiness.recommendation === 'reject';
approveBtn.className = approval.decisionReadiness.recommendation === 'reject'
  ? 'btn btn-ghost'
  : 'btn btn-primary';
```

Give the existing approval button `id="approveBtn"`.

- [ ] **Step 4: Browser QA**

Run:

```bash
cd poc-server
npm run dev
```

Open `http://localhost:5177/event_operation_poc.html`, click `운영 초안 생성`, and verify:

- review summary includes `판정 approve (100)`
- no blocker box appears for the clean fixture
- approval button remains active
- browser console has zero errors

## Task 4: Add Demo Checklist

**Files:**
- Modify: `README_POC.md`

- [ ] **Step 1: Add self-improvement loop**

Append:

```md
## 자기 개선 루프

1. 승인 패키지 생성 후 `decisionReadiness`를 먼저 확인한다.
2. `reject`이면 필수 사실 누락 또는 금지어를 수정한다.
3. `revise`이면 경고 항목을 사람이 검토한다.
4. `approve`이면 채널별 초안과 메모리 변경사항을 5분 안에 검토한다.
5. 검토자가 판단하기 어려운 항목은 deterministic 검수 항목으로 승격한다.
```

- [ ] **Step 2: Add demo checklist**

Append:

```md
## 데모 체크리스트

- [ ] 업체 메모리 생성 결과에 업체명, 메뉴, 금지어가 보인다.
- [ ] 수박주스 이벤트 실행 후 4개 채널 초안이 생성된다.
- [ ] 승인 요약에 업체, 기간, 혜택, 검수, 생성 모드, 판정이 보인다.
- [ ] 검수 리포트가 메뉴명, 할인금액, 시작일, 종료일을 검사한다.
- [ ] 패키지 복사와 JSON 저장이 동작한다.
```

- [ ] **Step 3: Final verification**

Run:

```bash
cd poc-server
npm test
npm run typecheck
npm run demo
```

Expected: all commands exit 0.

## Self-Review

- Spec coverage: This plan keeps the original PoC boundaries and improves the core feasibility question: can a human quickly approve, revise, or reject the generated operations package?
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `decisionReadiness` is introduced in evaluator, schema, builder, tests, and UI with one consistent name.
