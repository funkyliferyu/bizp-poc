# Web Static Flow Analysis

## 분석 범위

- 대상: `web` 폴더의 정적 HTML 화면 25개.
- 제외: `pc-web`, `admin` 화면군은 후속 연결성 정비 범위로 남긴다.
- 실행 기준 URL: `http://localhost:5177/index.html`.
- 현재 구조: `web/index.html`이 `nav.html`과 main iframe을 열고, main iframe 안에서 개별 화면이 전환된다.

## 확인된 화면 구조

- 공통 프레임: `index.html`, `nav.html`.
- 대행사 화면: `agency_dashboard.html`, `agency_member_biz.html`, `agency_list.html`, `agency_member_staff.html`.
- 매장 화면: `soho_dashboard.html`, `soho_store_register.html`, `soho_member.html`.
- 마케팅 채널 화면: `01_대시보드*.html`, `02_블로그관리.html`, `03_AI학습_온보딩.html`, `04_AI학습_수집중.html`, `05_AI학습_콘텐츠선택.html`, `06_AI학습_현황*.html`, `07_마케팅전략룰셋.html`, `08_AI콘텐츠생성_목록.html`, `09_AI콘텐츠생성_상세.html`, `10_블로그_발행대기_상세.html`, `11_블로그_발행완료_상세.html`.
- PoC 화면: `event_operation_poc.html`.

## 문서상 확인 완료

- `web` 내부의 정적 `.html` 참조는 모두 존재하는 파일을 가리킨다.
- 공통 LNB의 `랜딩` 항목은 `event_operation_poc.html`로 연결된다.
- PoC 화면의 자체 LNB는 제거되어 공통 프레임 안에서 중복 LNB가 생기지 않는다.
- `pc-web`은 `web`과 유사한 별도 시안 묶음이고, 이번 수정 대상은 아니다.
- `admin`은 각 화면 안에 자체 LNB가 있는 독립 관리자 시안 묶음이고, 이번 수정 대상은 아니다.

## 핵심 연결 여정

- AI 학습: 학습 전 대시보드 → 학습 설정 → 수집 중 → 콘텐츠 선택 → 학습 현황.
- 블로그/콘텐츠: 블로그 관리 → 콘텐츠 상세 → 발행 대기 → 발행 완료 → 블로그 관리.
- 대행사: 대행사 대시보드 → 매장관리.
- 매장: 매장 대시보드 → 매장 정보 등록, 블로그 관리, 마케팅 전략 룰셋.
- PoC: LNB 랜딩 → Event-to-Operation PoC → 메모리 생성 → 운영 초안 생성 → 승인 결정.

## 구현 중 확정할 항목

- `04_AI학습_수집중.html`은 내부에 콘텐츠 선택 UI를 포함하고 있으나, 별도 `05_AI학습_콘텐츠선택.html`도 존재한다. 핵심 여정 검증을 쉽게 하기 위해 수집 후 CTA는 `05_AI학습_콘텐츠선택.html`로 연결한다.
- `09_AI콘텐츠생성_상세.html`의 발행 요청은 정적 플로우상 `10_블로그_발행대기_상세.html`로 이동하게 한다.
- `10_블로그_발행대기_상세.html`의 완료 처리는 정적 플로우상 `11_블로그_발행완료_상세.html`로 이동하게 한다.
- LNB active 상태는 main iframe의 현재 파일명을 기준으로 parent script에서 동기화한다.

## 비핵심 버튼

- 검색, 초기화, 엑셀/CSV 다운로드, 삭제, 수정, 페이지네이션, 단순 필터는 이번 핵심 여정 표시 대상이 아니다.
- 기존 로컬 모달/탭/상태 전환이 이미 동작하는 버튼은 유지하되, 다음 화면으로 이어지는 핵심 플로우가 아니면 `data-flow-*` 마커를 붙이지 않는다.

## 검증 기준

- 플로우 표시 ON 상태에서 핵심 이동/상태/API 요소만 파란 outline과 라벨로 식별된다.
- 플로우 표시 OFF 상태에서 일반 정적 시안처럼 보인다.
- LNB 클릭, 핵심 CTA 클릭, PoC 승인 결정 루프가 브라우저에서 끊기지 않는다.
