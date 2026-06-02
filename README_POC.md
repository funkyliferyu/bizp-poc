# Event-to-Operation PoC

카페 채널 자료를 업체 메모리로 만들고, 수박주스 이벤트를 네이버 블로그/플레이스/비즈챗/챗봇 운영 초안과 승인 패키지로 변환하는 PoC입니다.

## 실행

```bash
cd poc-server
npm install
npm run dev
```

브라우저에서 `http://localhost:5177/event_operation_poc.html`을 엽니다.

## 테스트와 데모

```bash
cd poc-server
npm test
npm run demo
```

`npm run demo`는 fixture 기반 전체 플로우를 실행하고 `poc-server/data/approvals/approval-event-watermelon-202607.json`을 생성합니다.

## API

- `POST /api/assets/ingest`
- `POST /api/memory/build`
- `GET /api/memory/:businessId`
- `POST /api/events/watermelon`
- `POST /api/events/:eventId/run`
- `GET /api/approvals/:approvalId`

## LLM 모드

현재 PoC는 `OPENAI_API_KEY` 없이도 동일 구조를 반환하는 mock generator로 동작합니다. 실제 OpenAI 호출 경계는 `poc-server/src/ai/`에 분리되어 있으며, 생성 결과는 Zod schema로 검증하는 구조입니다.

## PoC 판단 기준

- 사람이 5분 안에 승인/수정/반려 판단을 할 수 있다.
- 모든 채널 초안에 메뉴명, 혜택, 기간이 일관되게 포함된다.
- 금지어와 누락 항목은 deterministic 검수에서 표시된다.
- `OPENAI_API_KEY`가 없어도 mock mode로 동일 흐름을 시연한다.

## 이번 PoC에서 제외

- 실제 네이버 블로그/플레이스/RCS/챗봇 발행 연동
- 운영자 권한/로그인
- DB 마이그레이션
- 이미지 생성 또는 이미지 업로드 검수

## 자기 개선 루프

1. 승인 패키지 생성 후 `decisionReadiness`를 먼저 확인한다.
2. `reject`이면 필수 사실 누락 또는 금지어를 수정한다.
3. `revise`이면 경고 항목을 사람이 검토한다.
4. `approve`이면 채널별 초안과 메모리 변경사항을 5분 안에 검토한다.
5. 검토자가 판단하기 어려운 항목은 deterministic 검수 항목으로 승격한다.

## 데모 체크리스트

- [ ] 업체 메모리 생성 결과에 업체명, 메뉴, 금지어가 보인다.
- [ ] 수박주스 이벤트 실행 후 4개 채널 초안이 생성된다.
- [ ] 승인 요약에 업체, 기간, 혜택, 검수, 생성 모드, 판정이 보인다.
- [ ] 검수 리포트가 메뉴명, 할인금액, 시작일, 종료일을 검사한다.
- [ ] 패키지 복사와 JSON 저장이 동작한다.
