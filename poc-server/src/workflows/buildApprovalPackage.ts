import { ApprovalPackageSchema, type ApprovalPackage } from '../schemas/approvalPackage.js';
import type { BusinessMemory, GenerationStepTrace } from '../schemas/businessMemory.js';
import type { ChannelOutputs } from '../schemas/channelOutputs.js';
import type { EventInput } from '../schemas/event.js';
import type { TaskGraph } from '../schemas/taskGraph.js';
import { evaluateDecisionReadiness } from './evaluateDecisionReadiness.js';
import { runQualityCheck } from './runQualityCheck.js';

function summarizeTraceMode(steps: GenerationStepTrace[]) {
  const llmSteps = steps.filter((step) => step.mode !== 'deterministic');
  if (llmSteps.length === 0) return 'mock';
  if (llmSteps.every((step) => step.mode === 'openai')) return 'openai';
  if (llmSteps.some((step) => step.mode === 'openai')) return 'mixed';
  return 'mock';
}

export function buildApprovalPackage(params: {
  memory: BusinessMemory;
  event: EventInput;
  memoryChanges: string[];
  taskGraph: TaskGraph;
  channelOutputs: ChannelOutputs;
  generationSteps?: GenerationStepTrace[];
}): ApprovalPackage {
  const qualityReport = runQualityCheck(
    params.event,
    params.channelOutputs,
    params.memory.brandVoice.forbidden
  );
  const generatedAt = new Date().toISOString();
  const generationSteps = params.generationSteps ?? [
    params.memory.generationTrace ?? { name: 'memory', mode: 'mock', generatedAt },
    { name: 'taskGraph', mode: 'deterministic', generatedAt },
    { name: 'channelDrafts', mode: 'mock', generatedAt },
    { name: 'qualityCheck', mode: 'deterministic', generatedAt }
  ];

  return ApprovalPackageSchema.parse({
    approvalId: `approval-${params.event.eventId}`,
    title: '수박주스 이벤트 자동 운영 승인 패키지',
    businessMemory: params.memory,
    event: params.event,
    memoryChanges: params.memoryChanges,
    taskGraph: params.taskGraph,
    channelOutputs: params.channelOutputs,
    qualityReport,
    approvalRequired: params.event.approvalRequired,
    decisionReadiness: evaluateDecisionReadiness(qualityReport),
    decision: {
      status: 'pending',
      action: 'none',
      label: '승인 대기',
      note: '',
      reviewer: '',
      decidedAt: null
    },
    trace: {
      mode: summarizeTraceMode(generationSteps),
      generatedBy: generationSteps.map((step) => step.name),
      generatedAt,
      steps: generationSteps
    },
    createdAt: generatedAt
  });
}
