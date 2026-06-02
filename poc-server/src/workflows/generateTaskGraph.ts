import { TaskGraphSchema, type TaskGraph } from '../schemas/taskGraph.js';
import type { EventInput } from '../schemas/event.js';

export function generateTaskGraph(event: EventInput): TaskGraph {
  return TaskGraphSchema.parse({
    eventId: event.eventId,
    tasks: [
      {
        id: `${event.eventId}-blog-launch`,
        channel: 'blog',
        title: '네이버 블로그 출시 안내 포스트',
        description: `${event.menuName} 출시와 할인 정보를 자연 후기형 포스트로 작성`,
        approvalRequired: true
      },
      {
        id: `${event.eventId}-place-news`,
        channel: 'place',
        title: '네이버 플레이스 새소식/메뉴/이벤트 공지',
        description: '새소식, 메뉴 정보, 이벤트 공지, 리뷰 댓글 문구 생성',
        approvalRequired: true
      },
      {
        id: `${event.eventId}-bizchat-rcs`,
        channel: 'bizchat',
        title: '비즈챗 RCS 발송 초안',
        description: '추천 타겟, 발송 시간, CTA 포함 메시지 생성',
        approvalRequired: true
      },
      {
        id: `${event.eventId}-chatbot-faq`,
        channel: 'chatbot',
        title: '챗봇 FAQ 및 자연 안내',
        description: '판매 여부, 할인 기간, 가격/혜택 문의 응대 생성',
        approvalRequired: true
      }
    ]
  });
}
