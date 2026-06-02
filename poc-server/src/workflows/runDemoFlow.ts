import { buildBusinessMemory } from './buildBusinessMemory.js';
import { buildApprovalPackage } from './buildApprovalPackage.js';
import { generateChannelDrafts } from './generateChannelDrafts.js';
import { generateTaskGraph } from './generateTaskGraph.js';
import { createWatermelonEvent, updateMemoryForWatermelonEvent } from './runWatermelonEvent.js';

export async function runDemoFlow() {
  const seedMemory = buildBusinessMemory({
    channelUrl: 'https://blog.naver.com/cafe-demo',
    pastedText: '업체명: 카페 예시\n주소: 서울시 마포구 예시로 12'
  });
  const event = createWatermelonEvent();
  const { memory, changes } = updateMemoryForWatermelonEvent(seedMemory, event);
  const taskGraph = generateTaskGraph(event);
  const channelOutputs = await generateChannelDrafts(memory, event);

  return buildApprovalPackage({
    memory,
    event,
    memoryChanges: changes,
    taskGraph,
    channelOutputs
  });
}
