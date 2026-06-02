import type { ApprovalPackage } from '../schemas/approvalPackage.js';

export type ApprovalHistorySummary = {
  approvalId: string;
  title: string;
  businessName: string;
  eventName: string;
  decisionLabel: string;
  decisionStatus: ApprovalPackage['decision']['status'];
  qualityStatus: ApprovalPackage['qualityReport']['status'];
  traceMode: ApprovalPackage['trace']['mode'];
  createdAt: string;
  decidedAt: string | null;
};

export function summarizeApprovalHistory(approvals: ApprovalPackage[]): ApprovalHistorySummary[] {
  return approvals
    .map((approval) => ({
      approvalId: approval.approvalId,
      title: approval.title,
      businessName: approval.businessMemory.business.name,
      eventName: approval.event.menuName,
      decisionLabel: approval.decision.label,
      decisionStatus: approval.decision.status,
      qualityStatus: approval.qualityReport.status,
      traceMode: approval.trace.mode,
      createdAt: approval.createdAt,
      decidedAt: approval.decision.decidedAt
    }))
    .sort((a, b) => {
      const aTime = Date.parse(a.decidedAt ?? a.createdAt);
      const bTime = Date.parse(b.decidedAt ?? b.createdAt);
      return bTime - aTime;
    });
}
