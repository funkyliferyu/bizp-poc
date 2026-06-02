import type { ChannelOutputs } from '../schemas/channelOutputs.js';
import type { EventInput } from '../schemas/event.js';
import type { QualityItem, QualityReport } from '../schemas/approvalPackage.js';

const channelLabels: Record<keyof ChannelOutputs, string> = {
  blog: '네이버 블로그',
  place: '네이버 플레이스',
  bizchat: '비즈챗',
  chatbot: '챗봇'
};

const flattenDrafts = (drafts: unknown[]) =>
  drafts
    .map((draft) => Object.values(draft as Record<string, unknown>).join(' '))
    .join(' ');

const compact = (value: string) => value.replace(/\s/g, '');

const moneyVariants = (amount: number) => [
  amount.toLocaleString('ko-KR'),
  String(amount),
  `${amount.toLocaleString('ko-KR')}원`,
  `${amount}원`
];

const dateVariants = (isoDate: string) => {
  const [, month, day] = isoDate.split('-');
  return [isoDate, `${Number(month)}월 ${Number(day)}일`, `${Number(month)}월${Number(day)}일`];
};

const includesAnyVariant = (text: string, variants: string[]) => {
  const compactText = compact(text);
  return variants.some((variant) => compactText.includes(compact(variant)));
};

export function runQualityCheck(
  event: EventInput,
  channelOutputs: ChannelOutputs,
  forbiddenWords: string[]
): QualityReport {
  const requiredFactGroups = [
    { label: '메뉴명', variants: [event.menuName] },
    { label: '할인금액', variants: moneyVariants(event.discount.amount) },
    { label: '시작일', variants: dateVariants(event.period.startDate) },
    { label: '종료일', variants: dateVariants(event.period.endDate) }
  ];

  const items: QualityItem[] = [];

  for (const [channel, drafts] of Object.entries(channelOutputs) as [keyof ChannelOutputs, unknown[]][]) {
    const text = flattenDrafts(drafts);
    const missing = requiredFactGroups
      .filter((fact) => !includesAnyVariant(text, fact.variants))
      .map((fact) => fact.label);
    const forbidden = forbiddenWords.filter((word) => text.includes(word));

    items.push({
      key: `${channel}.requiredFacts`,
      label: `${channelLabels[channel]} 필수 정보 일치`,
      status: missing.length ? 'fail' : 'pass',
      detail: missing.length ? `누락: ${missing.join(', ')}` : '메뉴명, 할인금액, 시작일, 종료일이 포함됨'
    });

    items.push({
      key: `${channel}.forbiddenWords`,
      label: `${channelLabels[channel]} 금지어 검사`,
      status: forbidden.length ? 'fail' : 'pass',
      detail: forbidden.length ? `금지어 포함: ${forbidden.join(', ')}` : '금지어 없음'
    });
  }

  items.push({
    key: 'approval.required',
    label: '승인 필요 항목',
    status: 'pass',
    detail: event.approvalRequired ? '발행 전 사람 승인 필요' : '자동 승인 가능'
  });

  const status = items.some((item) => item.status === 'fail')
    ? 'fail'
    : items.some((item) => item.status === 'warn')
      ? 'warn'
      : 'pass';

  return { status, items };
}
