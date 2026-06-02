import { describe, expect, it } from 'vitest';
import { runQualityCheck } from '../src/workflows/runQualityCheck.js';
import { watermelonEventFixture } from '../src/fixtures/watermelonEvent.js';
import type { ChannelOutputs } from '../src/schemas/channelOutputs.js';

const completeOutputs: ChannelOutputs = {
  blog: [
    {
      title: '수박주스 출시 안내',
      body: '2026-07-01부터 2026-07-31까지 수박주스 1,000원 할인 이벤트를 진행합니다.'
    }
  ],
  place: [
    {
      type: '새소식',
      body: '수박주스 1,000원 할인: 2026-07-01 ~ 2026-07-31'
    }
  ],
  bizchat: [
    {
      messageType: 'RCS',
      target: '여름 음료 관심 고객',
      sendTime: '점심 전',
      cta: '방문하기',
      body: '수박주스 1,000원 할인은 2026-07-01부터 2026-07-31까지입니다.'
    }
  ],
  chatbot: [
    {
      question: '수박주스 할인 기간이 언제인가요?',
      answer: '수박주스는 2026-07-01부터 2026-07-31까지 1,000원 할인됩니다.'
    }
  ]
};

describe('runQualityCheck', () => {
  it('passes when every channel contains the menu, discount, and event dates', () => {
    const report = runQualityCheck(watermelonEventFixture, completeOutputs, ['전국 최고']);

    expect(report.status).toBe('pass');
    expect(report.items.every((item) => item.status === 'pass')).toBe(true);
  });

  it('fails when required event facts are missing or forbidden words appear', () => {
    const report = runQualityCheck(
      watermelonEventFixture,
      {
        ...completeOutputs,
        blog: [{ title: '신메뉴 안내', body: '전국 최고 여름 메뉴를 할인합니다.' }]
      },
      ['전국 최고']
    );

    expect(report.status).toBe('fail');
    expect(report.items.some((item) => item.key === 'blog.requiredFacts' && item.status === 'fail')).toBe(true);
    expect(report.items.some((item) => item.key === 'blog.forbiddenWords' && item.status === 'fail')).toBe(true);
  });

  it('accepts common Korean money and date variants for event facts', () => {
    const report = runQualityCheck(
      watermelonEventFixture,
      {
        blog: [{ title: '수박주스 안내', body: '7월 1일부터 7월 31일까지 수박주스 1000원 할인' }],
        place: [{ type: '새소식', body: '수박주스 1000원 할인, 7월 1일~7월 31일' }],
        bizchat: [
          {
            messageType: 'RCS',
            target: '방문 고객',
            sendTime: '11:00',
            cta: '확인',
            body: '수박주스 1000원 할인 7월 1일-7월 31일'
          }
        ],
        chatbot: [{ question: '기간', answer: '수박주스는 7월 1일부터 7월 31일까지 1000원 할인됩니다.' }]
      },
      []
    );

    expect(report.status).toBe('pass');
  });
});
