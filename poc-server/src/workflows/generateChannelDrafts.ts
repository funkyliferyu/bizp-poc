import { ChannelOutputsSchema, type ChannelOutputs } from '../schemas/channelOutputs.js';
import type { BusinessMemory, GenerationStepTrace } from '../schemas/businessMemory.js';
import type { EventInput } from '../schemas/event.js';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from '../ai/openaiClient.js';
import { prompts } from '../ai/prompts.js';

type ParseClient = {
  beta: {
    chat: {
      completions: {
        parse: (params: unknown) => Promise<{ choices: Array<{ message: { parsed: unknown } }> }>;
      };
    };
  };
};

type GenerationOptions = {
  client?: ParseClient | null;
  now?: () => string;
};

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;
const nowIso = () => new Date().toISOString();
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function generateMockChannelDrafts(memory: BusinessMemory, event: EventInput): ChannelOutputs {
  const period = `${event.period.startDate} ~ ${event.period.endDate}`;
  const discount = won(event.discount.amount);

  return ChannelOutputsSchema.parse({
    blog: [
      {
        title: `${memory.business.name} 여름 한정 ${event.menuName} 출시 안내`,
        body: `${memory.business.name}에서 ${event.description}를 준비했습니다. ${event.period.startDate}부터 ${event.period.endDate}까지 ${event.menuName} 주문 시 ${discount} 할인 혜택을 받을 수 있습니다. 점심시간 테이크아웃 음료로도 가볍게 즐겨보세요.`
      },
      {
        title: `7월 시즌 메뉴 ${event.menuName} 할인 소식`,
        body: `${period} 동안 ${event.menuName} ${discount} 할인 이벤트가 진행됩니다. 기존 블로그 하단 안내 블록에도 동일한 기간과 혜택을 추가합니다.`
      }
    ],
    place: [
      {
        type: '새소식',
        body: `${event.menuName} 출시! ${period} 동안 ${discount} 할인됩니다.`
      },
      {
        type: '메뉴 정보',
        body: `${event.menuName} - ${event.description}. 이벤트 기간 ${period}, 할인 혜택 ${discount}.`
      },
      {
        type: '리뷰 댓글',
        body: `방문해 주셔서 감사합니다. 7월에는 ${event.menuName} ${discount} 할인 이벤트도 진행 중입니다.`
      }
    ],
    bizchat: [
      {
        messageType: 'RCS',
        target: '최근 60일 내 여름 음료 또는 테이크아웃 관심 고객',
        sendTime: '평일 11:00 또는 14:00',
        cta: '플레이스에서 확인하기',
        body: `${memory.business.name} 7월 혜택 안내: ${event.menuName} ${discount} 할인. 기간은 ${event.period.startDate}부터 ${event.period.endDate}까지입니다.`
      }
    ],
    chatbot: [
      {
        question: `${event.menuName} 판매하나요?`,
        answer: `네, ${event.menuName}는 ${event.description}로 준비된 여름 시즌 메뉴입니다.`
      },
      {
        question: `${event.menuName} 할인 기간은 언제인가요?`,
        answer: `${event.period.startDate}부터 ${event.period.endDate}까지 ${event.menuName} ${discount} 할인 이벤트가 진행됩니다.`
      },
      {
        question: `할인 혜택이 얼마인가요?`,
        answer: `${event.menuName} 주문 시 ${discount} 할인 혜택을 받을 수 있습니다.`
      }
    ]
  });
}

export async function generateChannelDraftsWithAI(
  memory: BusinessMemory,
  event: EventInput,
  options: GenerationOptions = {}
): Promise<{ channelOutputs: ChannelOutputs; trace: GenerationStepTrace }> {
  const generatedAt = (options.now ?? nowIso)();
  const client = 'client' in options ? options.client : getOpenAIClient();

  if (!client) {
    return {
      channelOutputs: generateMockChannelDrafts(memory, event),
      trace: {
        name: 'channelDrafts',
        mode: 'mock',
        generatedAt,
        fallbackReason: 'OPENAI_API_KEY is not configured'
      }
    };
  }

  try {
    const completion = await client.beta.chat.completions.parse({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `${prompts.channelGenerator} 카페 이벤트를 네이버 블로그, 네이버 플레이스, 비즈챗, 챗봇 채널 초안으로 생성한다. ` +
            '모든 초안에는 메뉴명, 할인금액, 시작일, 종료일을 포함하고 금지어를 피한다.'
        },
        {
          role: 'user',
          content: JSON.stringify({ businessMemory: memory, event }, null, 2)
        }
      ],
      response_format: zodResponseFormat(ChannelOutputsSchema, 'channel_outputs')
    });

    const parsed = completion.choices[0]?.message.parsed;
    return {
      channelOutputs: ChannelOutputsSchema.parse(parsed),
      trace: { name: 'channelDrafts', mode: 'openai', generatedAt }
    };
  } catch (error) {
    return {
      channelOutputs: generateMockChannelDrafts(memory, event),
      trace: {
        name: 'channelDrafts',
        mode: 'mock',
        generatedAt,
        fallbackReason: errorMessage(error)
      }
    };
  }
}

export async function generateChannelDrafts(memory: BusinessMemory, event: EventInput): Promise<ChannelOutputs> {
  return (await generateChannelDraftsWithAI(memory, event)).channelOutputs;
}
