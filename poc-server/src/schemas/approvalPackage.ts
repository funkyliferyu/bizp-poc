import { z } from 'zod';
import { BusinessMemorySchema, GenerationStepTraceSchema } from './businessMemory.js';
import { ChannelOutputsSchema } from './channelOutputs.js';
import { EventSchema } from './event.js';
import { TaskGraphSchema } from './taskGraph.js';

export const QualityItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  detail: z.string()
});

export const QualityReportSchema = z.object({
  status: z.enum(['pass', 'warn', 'fail']),
  items: z.array(QualityItemSchema)
});

export const ApprovalDecisionSchema = z.object({
  status: z.enum(['pending', 'revision_requested', 'rejected', 'approved']),
  action: z.enum(['none', 'request_revision', 'reject', 'approve']),
  label: z.enum(['승인 대기', '수정 요청', '반려', '승인']),
  note: z.string(),
  reviewer: z.string(),
  decidedAt: z.string().nullable()
});

export const ApprovalPackageSchema = z.object({
  approvalId: z.string(),
  title: z.string(),
  businessMemory: BusinessMemorySchema,
  event: EventSchema,
  memoryChanges: z.array(z.string()),
  taskGraph: TaskGraphSchema,
  channelOutputs: ChannelOutputsSchema,
  qualityReport: QualityReportSchema,
  approvalRequired: z.boolean(),
  decisionReadiness: z.object({
    score: z.number().min(0).max(100),
    recommendation: z.enum(['approve', 'revise', 'reject']),
    blockers: z.array(z.string())
  }),
  decision: ApprovalDecisionSchema,
  trace: z.object({
    mode: z.enum(['mock', 'openai', 'mixed']),
    generatedBy: z.array(z.string()),
    generatedAt: z.string(),
    steps: z.array(GenerationStepTraceSchema)
  }),
  createdAt: z.string()
});

export type QualityItem = z.infer<typeof QualityItemSchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalPackage = z.infer<typeof ApprovalPackageSchema>;
