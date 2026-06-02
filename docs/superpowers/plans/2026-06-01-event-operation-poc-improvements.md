# Event Operation PoC Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the original Event-to-Operation PoC scope while improving decision quality, workflow trust, and demo readiness.

**Architecture:** Keep the current static UI plus `poc-server` Express/Zod/JSON-store architecture. Improvements should remain modular: quality checks stay in workflows, LLM/mock generation stays behind the AI boundary, and the UI only renders API results.

**Tech Stack:** Node.js, Express, TypeScript, Zod, Vitest, static HTML/CSS/JS, existing `web/common.css` and `web/icons.js`.

---

## File Structure

- Modify `poc-server/src/workflows/runQualityCheck.ts`: strengthen deterministic consistency checks.
- Modify `poc-server/test/qualityCheck.test.ts`: add regression cases for Korean date/money variants and channel omissions.
- Modify `poc-server/src/workflows/generateChannelDrafts.ts`: enforce output normalization after mock or OpenAI generation.
- Modify `poc-server/src/ai/openaiClient.ts`: expose a clear mock/OpenAI mode indicator.
- Modify `poc-server/src/index.ts`: return mode and trace metadata in approval responses.
- Modify `web/event_operation_poc.html`: improve visibility for review decisions, warnings, and approval package export.
- Modify `README_POC.md`: document decision criteria and known PoC boundaries.

## Task 1: Deterministic Quality Gate Upgrade

**Files:**
- Modify: `poc-server/src/workflows/runQualityCheck.ts`
- Test: `poc-server/test/qualityCheck.test.ts`

- [ ] **Step 1: Write failing tests for accepted fact formats**

Add tests that pass when drafts use either `1,000원` or `1000원`, and either ISO dates or Korean dates.

```ts
it('accepts common Korean money and date variants for event facts', () => {
  const report = runQualityCheck(
    watermelonEventFixture,
    {
      blog: [{ title: '수박주스 안내', body: '7월 1일부터 7월 31일까지 수박주스 1000원 할인' }],
      place: [{ type: '새소식', body: '수박주스 1000원 할인, 7월 1일~7월 31일' }],
      bizchat: [{ messageType: 'RCS', target: '방문 고객', sendTime: '11:00', cta: '확인', body: '수박주스 1000원 할인 7월 1일-7월 31일' }],
      chatbot: [{ question: '기간', answer: '수박주스는 7월 1일부터 7월 31일까지 1000원 할인됩니다.' }]
    },
    []
  );

  expect(report.status).toBe('pass');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd poc-server && npm test -- qualityCheck.test.ts`

Expected: FAIL because current checks only look for exact ISO dates and comma-formatted discount.

- [ ] **Step 3: Implement fact variant matching**

Add helpers in `runQualityCheck.ts`:

```ts
const compact = (value: string) => value.replace(/\s/g, '');
const moneyVariants = (amount: number) => [
  amount.toLocaleString('ko-KR'),
  String(amount),
  `${amount.toLocaleString('ko-KR')}원`,
  `${amount}원`
];
const dateVariants = (isoDate: string) => {
  const [, month, day] = isoDate.split('-');
  return [isoDate, `${Number(month)}월 ${Number(day)}일`, `${Number(month)}월${Number(day)}일`];
};
```

Then check each fact group with “at least one variant exists” rather than one exact string.

- [ ] **Step 4: Run tests**

Run: `cd poc-server && npm test`

Expected: all tests pass.

## Task 2: Approval Package Traceability

**Files:**
- Modify: `poc-server/src/schemas/approvalPackage.ts`
- Modify: `poc-server/src/workflows/buildApprovalPackage.ts`
- Modify: `poc-server/src/index.ts`
- Test: `poc-server/test/demoFlow.test.ts`

- [ ] **Step 1: Add failing test for source trace**

Add assertions:

```ts
expect(approval.trace.mode).toBe('mock');
expect(approval.trace.generatedBy).toEqual(expect.arrayContaining(['memory', 'taskGraph', 'channelDrafts', 'qualityCheck']));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd poc-server && npm test -- demoFlow.test.ts`

Expected: FAIL because `trace` is not in the schema.

- [ ] **Step 3: Add trace schema**

Add to `ApprovalPackageSchema`:

```ts
trace: z.object({
  mode: z.enum(['mock', 'openai']),
  generatedBy: z.array(z.string()),
  generatedAt: z.string()
})
```

- [ ] **Step 4: Populate trace**

In `buildApprovalPackage`, set:

```ts
trace: {
  mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
  generatedBy: ['memory', 'taskGraph', 'channelDrafts', 'qualityCheck'],
  generatedAt: new Date().toISOString()
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `cd poc-server && npm test && npm run typecheck`

Expected: tests and typecheck pass.

## Task 3: UI Reviewability Improvements

**Files:**
- Modify: `web/event_operation_poc.html`

- [ ] **Step 1: Add approval summary panel**

Above channel drafts, render:

```html
<div class="review-summary" id="reviewSummary"></div>
```

Include business name, event period, discount, quality status, and generation mode.

- [ ] **Step 2: Add copy/export controls**

Add buttons:

```html
<button class="btn btn-ghost" id="copyApprovalBtn"><span data-icon="file-text"></span>패키지 복사</button>
<button class="btn btn-ghost" id="downloadApprovalBtn"><span data-icon="file-check"></span>JSON 저장</button>
```

- [ ] **Step 3: Implement copy/download handlers**

Use the rendered `approval` object:

```js
navigator.clipboard.writeText(JSON.stringify(currentApproval, null, 2));
```

For download, create a Blob and trigger an `<a download="approval-event-watermelon-202607.json">`.

- [ ] **Step 4: Browser QA**

Run: `cd poc-server && npm run dev`

Open: `http://localhost:5177/event_operation_poc.html`

Expected: memory generation, event run, approval rendering, copy, and download all work without console errors.

## Task 4: README Decision Criteria

**Files:**
- Modify: `README_POC.md`

- [ ] **Step 1: Add “PoC 판단 기준”**

Document:

```md
## PoC 판단 기준

- 사람이 5분 안에 승인/수정/반려 판단을 할 수 있다.
- 모든 채널 초안에 메뉴명, 혜택, 기간이 일관되게 포함된다.
- 금지어와 누락 항목은 deterministic 검수에서 표시된다.
- OPENAI_API_KEY가 없어도 mock mode로 동일 흐름을 시연한다.
```

- [ ] **Step 2: Add “이번 PoC에서 제외”**

Document:

```md
## 이번 PoC에서 제외

- 실제 네이버 블로그/플레이스/RCS/챗봇 발행 연동
- 운영자 권한/로그인
- DB 마이그레이션
- 이미지 생성 또는 이미지 업로드 검수
```

- [ ] **Step 3: Verify commands**

Run:

```bash
cd poc-server
npm test
npm run typecheck
npm run demo
```

Expected: all commands exit 0.

## Self-Review

- Spec coverage: The plan preserves the original flow and improves quality checks, review package clarity, mock/OpenAI transparency, and documentation.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: New `trace` object is added to schema, builder, and tests with matching property names.
