import { ApprovalPackageSchema, type ApprovalPackage } from '../schemas/approvalPackage.js';

type DecisionAction = 'request_revision' | 'reject' | 'approve';

const decisionByAction = {
  request_revision: {
    status: 'revision_requested',
    label: '수정 요청'
  },
  reject: {
    status: 'rejected',
    label: '반려'
  },
  approve: {
    status: 'approved',
    label: '승인'
  }
} as const satisfies Record<DecisionAction, { status: ApprovalPackage['decision']['status']; label: ApprovalPackage['decision']['label'] }>;

export function decideApprovalPackage(
  approval: ApprovalPackage,
  params: {
    action: DecisionAction;
    note?: string;
    reviewer?: string;
    decidedAt?: string;
  }
) {
  const decision = decisionByAction[params.action];

  return ApprovalPackageSchema.parse({
    ...approval,
    decision: {
      status: decision.status,
      action: params.action,
      label: decision.label,
      note: params.note?.trim() ?? '',
      reviewer: params.reviewer?.trim() || 'reviewer-demo',
      decidedAt: params.decidedAt ?? new Date().toISOString()
    }
  });
}
