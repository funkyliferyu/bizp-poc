import { describe, expect, it } from 'vitest';
import { decideApprovalPackage } from '../src/workflows/decideApprovalPackage.js';
import { runDemoFlow } from '../src/workflows/runDemoFlow.js';
import { summarizeApprovalHistory } from '../src/workflows/approvalHistory.js';

describe('approval history summaries', () => {
  it('summarizes approval packages for a recoverable UI history list', async () => {
    const pending = await runDemoFlow();
    const decidedAt = new Date(Date.parse(pending.createdAt) + 1000).toISOString();
    const approved = decideApprovalPackage(pending, {
      action: 'approve',
      note: '확인 완료',
      reviewer: 'reviewer-demo',
      decidedAt
    });

    const summaries = summarizeApprovalHistory([pending, approved]);

    expect(summaries).toEqual([
      {
        approvalId: approved.approvalId,
        title: approved.title,
        businessName: '카페 예시',
        eventName: '수박주스',
        decisionLabel: '승인',
        decisionStatus: 'approved',
        qualityStatus: 'pass',
        traceMode: 'mock',
        createdAt: approved.createdAt,
        decidedAt
      },
      {
        approvalId: pending.approvalId,
        title: pending.title,
        businessName: '카페 예시',
        eventName: '수박주스',
        decisionLabel: '승인 대기',
        decisionStatus: 'pending',
        qualityStatus: 'pass',
        traceMode: 'mock',
        createdAt: pending.createdAt,
        decidedAt: null
      }
    ]);
  });
});
