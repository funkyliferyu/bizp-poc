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
      score: Math.max(0, 70 - failures.length * 10 - warnings.length * 5),
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
