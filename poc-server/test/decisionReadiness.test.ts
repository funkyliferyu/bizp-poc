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
