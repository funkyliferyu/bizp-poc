import { describe, expect, it } from 'vitest';
import { runDemoFlow } from '../src/workflows/runDemoFlow.js';

describe('runDemoFlow', () => {
  it('creates a reviewable approval package from the cafe fixtures', async () => {
    const approval = await runDemoFlow();

    expect(approval.title).toBe('수박주스 이벤트 자동 운영 승인 패키지');
    expect(approval.memoryChanges).toContain('수박주스 메뉴 추가');
    expect(approval.taskGraph.tasks.map((task) => task.channel)).toEqual(
      expect.arrayContaining(['blog', 'place', 'bizchat', 'chatbot'])
    );
    expect(approval.channelOutputs.blog[0].body).toContain('수박주스');
    expect(approval.channelOutputs.bizchat[0].body).toContain('1,000원');
    expect(approval.qualityReport.status).toBe('pass');
    expect(approval.approvalRequired).toBe(true);
    expect(approval.trace.mode).toBe('mock');
    expect(approval.trace.generatedBy).toEqual(
      expect.arrayContaining(['memory', 'taskGraph', 'channelDrafts', 'qualityCheck'])
    );
    expect(approval.decisionReadiness).toEqual({
      score: 100,
      recommendation: 'approve',
      blockers: []
    });
  });
});
