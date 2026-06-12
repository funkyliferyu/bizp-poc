export type RulesetPreviewChannel = 'blog';

const channelLabels: Record<RulesetPreviewChannel, string> = {
  blog: '블로그'
};

const channelTags: Record<RulesetPreviewChannel, string[]> = {
  blog: ['분당 케이크', '딸기 생크림 케이크', '예약 안내']
};

export function buildRulesetPreviewPayload(input: {
  storeName: string;
  channel: RulesetPreviewChannel;
  topic: string;
  variantIndex: number;
}) {
  const variantNumber = (input.variantIndex % 3) + 1;
  return {
    provider: { name: 'mockRulesetPreviewProvider', mode: 'mock' },
    channel: input.channel,
    topic: input.topic,
    variantIndex: input.variantIndex,
    preview: {
      meta: `${channelLabels[input.channel]} 미리보기 ${variantNumber}`,
      body: `${input.storeName}의 ${input.topic} 콘텐츠 예시입니다. 예약 가능 여부와 픽업 시간을 자연스럽게 안내합니다.`,
      tags: channelTags[input.channel]
    }
  };
}
