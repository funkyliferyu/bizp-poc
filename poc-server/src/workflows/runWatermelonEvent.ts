import type { BusinessMemory } from '../schemas/businessMemory.js';
import { BusinessMemorySchema } from '../schemas/businessMemory.js';
import type { EventInput } from '../schemas/event.js';
import { watermelonEventFixture } from '../fixtures/watermelonEvent.js';

export function createWatermelonEvent(overrides: Partial<EventInput> = {}): EventInput {
  return {
    ...watermelonEventFixture,
    ...overrides,
    discount: {
      ...watermelonEventFixture.discount,
      ...overrides.discount
    },
    period: {
      ...watermelonEventFixture.period,
      ...overrides.period
    }
  };
}

export function updateMemoryForWatermelonEvent(memory: BusinessMemory, event: EventInput) {
  const hasMenu = memory.menus.some((menu) => menu.name === event.menuName);
  const menus = hasMenu
    ? memory.menus
    : [
        ...memory.menus,
        {
          name: event.menuName,
          category: 'juice',
          price: null,
          status: 'planned' as const
        }
      ];

  const faq = [
    ...memory.faq,
    {
      question: `${event.menuName} 할인 기간이 언제인가요?`,
      answer: `${event.menuName}는 ${event.period.startDate}부터 ${event.period.endDate}까지 ${event.discount.amount.toLocaleString('ko-KR')}원 할인됩니다.`
    }
  ];

  const updated = BusinessMemorySchema.parse({
    ...memory,
    menus,
    marketingAngles: Array.from(new Set([...memory.marketingAngles, event.description, '7월 할인 이벤트'])),
    faq,
    executionHistory: [...memory.executionHistory, `${event.menuName} 이벤트 메모리 업데이트`]
  });

  return {
    memory: updated,
    changes: [`${event.menuName} 메뉴 추가`, '7월 할인 이벤트 추가', '챗봇 FAQ 후보 추가']
  };
}
