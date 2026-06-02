import { describe, expect, it } from 'vitest';
import { decideApprovalPackage } from '../src/workflows/decideApprovalPackage.js';
import { runDemoFlow } from '../src/workflows/runDemoFlow.js';

describe('decideApprovalPackage', () => {
  it('records an approval decision on the approval package', async () => {
    const approval = await runDemoFlow();

    const decided = decideApprovalPackage(approval, {
      action: 'approve',
      note: '초안 확인 완료',
      reviewer: 'reviewer-demo',
      decidedAt: '2026-06-02T09:00:00.000Z'
    });

    expect(decided.decision).toEqual({
      status: 'approved',
      action: 'approve',
      label: '승인',
      note: '초안 확인 완료',
      reviewer: 'reviewer-demo',
      decidedAt: '2026-06-02T09:00:00.000Z'
    });
  });

  it.each([
    ['request_revision', 'revision_requested', '수정 요청'],
    ['reject', 'rejected', '반려']
  ] as const)('records %s as %s', async (action, status, label) => {
    const approval = await runDemoFlow();

    const decided = decideApprovalPackage(approval, {
      action,
      note: '운영팀 검토 메모',
      reviewer: 'reviewer-demo',
      decidedAt: '2026-06-02T09:05:00.000Z'
    });

    expect(decided.decision.status).toBe(status);
    expect(decided.decision.label).toBe(label);
    expect(decided.decision.note).toBe('운영팀 검토 메모');
  });
});
