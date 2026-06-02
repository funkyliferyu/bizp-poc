# API 기반 Event-to-Operation PoC Design

## 목적

정적 화면 플로우 위에 실제 API 기반 생성 흐름을 붙인다. 사용자는 같은 PoC 화면에서 업체 메모리 생성, 운영 초안 생성, 승인/수정 요청/반려를 실행하고, 각 결과가 mock인지 OpenAI인지 확인할 수 있어야 한다.

## 범위

- 포함: `poc-server`의 메모리 생성 API, 채널 초안 생성 API, 승인 패키지 trace, PoC 화면의 생성 모드 표시.
- 제외: 실제 채널 발행, 외부 운영계 API, 사용자 인증, 운영 DB, 배포 환경 구성.
- OpenAI 키가 없거나 LLM 응답이 스키마에 맞지 않으면 기존 mock 결과로 fallback한다.

## 아키텍처

생성 단계는 `memory`, `taskGraph`, `channelDrafts`, `qualityCheck`로 trace를 남긴다. `memory`와 `channelDrafts`는 OpenAI 사용 가능 시 LLM 경로를 시도하고, `taskGraph`와 `qualityCheck`는 deterministic 로직을 유지한다. 승인 패키지의 `trace.mode`는 OpenAI 단계가 없으면 `mock`, 전부 OpenAI면 `openai`, 일부만 OpenAI면 `mixed`로 표시한다.

## 데이터 흐름

1. 사용자가 PoC에서 `업체 메모리 생성`을 누른다.
2. 서버는 `/api/memory/build`에서 OpenAI 키 여부를 확인한다.
3. OpenAI 경로가 가능하면 스키마 기반 JSON 생성을 시도하고, 실패하면 mock memory를 반환한다.
4. 사용자가 `운영 초안 생성`을 누르면 이벤트 저장 후 `/api/events/:eventId/run`이 실행된다.
5. 서버는 메모리 trace, task graph trace, channel draft trace, quality check trace를 합쳐 승인 패키지에 저장한다.
6. UI는 메모리 결과와 승인 패키지 요약에 생성 모드와 단계별 trace를 표시한다.

## 오류 처리

- OpenAI 클라이언트가 없으면 즉시 mock 모드로 생성한다.
- OpenAI 호출 오류, 빈 parsed 응답, Zod 검증 실패는 mock fallback으로 처리한다.
- fallback 사유는 trace의 `fallbackReason`에 남긴다.
- UI는 API 오류만 상단 상태 문구로 표시하고, fallback 자체는 정상 생성 결과로 표시한다.

## 테스트 전략

- fake OpenAI client로 메모리 생성이 `openai` trace를 남기는지 테스트한다.
- fake OpenAI client 오류 시 메모리 생성이 `mock` trace와 fallback 사유를 남기는지 테스트한다.
- fake OpenAI client로 채널 초안 생성이 `openai` trace를 남기는지 테스트한다.
- 승인 패키지가 mixed trace를 요약하고 `trace.steps`를 보존하는지 테스트한다.
- 기존 전체 테스트와 타입체크를 유지한다.
