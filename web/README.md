# reply-desk 대시보드 화면

유튜브 댓글 에이전트의 관리 화면입니다. Vite + React 19 + TypeScript, 디자인 시스템은 `src/ds`의 **Desk**입니다(2026-11 리디자인, 예전 Inyeon을 대신함). 글꼴 파일만 `../design/inyeon-design-system/fonts`에서 그대로 읽습니다.

## 실행

```sh
# 서버 먼저 (../server)
cd ../server && npm run db:up && npm run start:dev

# 화면
cd ../web
npm install
npm run dev        # http://127.0.0.1:5173
```

`/api` 요청과 실시간 이벤트(SSE)는 Vite가 서버(`127.0.0.1:4100`)로 넘깁니다. 다른 주소면 `API_TARGET=http://… npm run dev`.

## 화면

모든 화면 왼쪽에 **사이드 메뉴**가 있습니다. 위에서부터 앱 이름(누르면 홈) · 주제 목록(상태 점, 오늘 n/상한, 게시 대기 수, [+ 새 주제]) · 고른 주제 메뉴 · 공통 메뉴입니다.

- **고른 주제 메뉴**(대시보드 · 작업 목록 · 댓글 게시 목록 · 주제 설정)는 주제를 고른 뒤에만 보입니다.
- 공통 화면(계정 관리 · 설정)으로 옮겨도 고른 주제와 그 메뉴는 남고, 홈으로 가면 고르지 않은 상태가 됩니다.
- 마지막에 고른 주제를 브라우저에 기억해, 앱을 다시 열면(`/`) 그 주제의 대시보드로 이어 갑니다.
- 위쪽 막대: 지금 위치(주제 › 화면) · 로그인 경고 · [작업 N](고른 주제의 작업 패널, 주제를 고르기 전에는 숨김) · 오늘 전체 게시. 알림은 모든 주제를 띄웁니다.
- 화면 너비: 1280px 이상은 메뉴를 펼쳐 둡니다. 768~1279px은 아이콘만 보이고, 767px 이하는 숨깁니다. 좁을 때는 ☰로 펼친 메뉴를 덮어 엽니다.

| 주소 | 화면 |
| --- | --- |
| `/` | 홈(주제를 고르기 전): 주제 카드(오늘 게시·게시 대기), 로그인 경고 |
| `/t/:topicId/dashboard?sort=&filter=&view=&page=` | 대시보드(영상 목록): 주제 머리 · 오늘 일의 흐름(영상 찾기 → 초안 확인·고치기 → 댓글 달기 → 결과 확인, 칸을 누르면 그 일로) · [영상 불러오기]·링크로 추가 · 거르기(초안 없음·있음·게시 완료·매칭 낮음) · 정렬(관련도·조회수·최신) · 표/카드 · 30개씩. 행을 누르면 작업 상세, 썸네일은 [영상 보기] 창(플레이어·인기 댓글) |
| `/t/:topicId/videos/:videoId` | 작업 상세: A 판단 근거(주제와 매칭 %·맞은 검색어·영상 정보·고른 이유·근거 장면) │ B 초안·게시(초안 고치기·자동 검사·쓴 이유 → [댓글 달기] → 진행 5단계·크롬 미리보기 → 다음 할 일). 좁으면 탭. 위에서 게시 대기 영상을 앞뒤로 넘긴다. 영상 목록·작업 목록·작업 패널·알림의 [보기]가 모두 여기로 온다 |
| `/t/:topicId/drafts` | 작업 목록: 이 주제의 초안, 상태·검색 필터, 행을 누르면 작업 상세 |
| `/t/:topicId/logs` | 댓글 게시 목록: 이 주제의 게시 결과(성공·실패), 실패 원인과 캡처 |
| `/t/:topicId/settings` | 주제 설정 |
| `/topics/new` | 새 주제 만들기 |
| `/accounts` | 계정 관리: 프로필 카드, 새 프로필 연결 4단계 |
| `/settings` | 설정: 하루 상한, 크롬 창 보이기, 분석·작성 AI 고르기, Ollama |

예전 주소(`/?topic=&video=`, `/drafts?topic=&video=`, `/logs?topic=`, `/topics/:id/edit`, RD-26 전 `/t/:id/dashboard?video=`·`/t/:id/drafts?video=`)는 새 주소로 넘어갑니다. 영상이 있으면 작업 상세로 갑니다.

## 구조

| 폴더 | 하는 일 |
| --- | --- |
| `src/ds` | 디자인 시스템 Desk: 토큰(`tokens.css`), 부품 모양(`components.css`), 부품(`components.tsx`: Button · Badge · Field · Segmented · Tabs · Chips · MatchBar 등) |
| `src/api` | 서버 타입, 호출(`api`, `ApiError`), 데이터 훅(TanStack Query) |
| `src/live` | 실시간 이벤트(EventSource) → 데이터 캐시 반영, 알림 규칙 |
| `src/lib` | 글자 모양(`format`), 영상 정렬·게시 대기 앞뒤(`video-order`), 검색 안내 글(`search-text`) |
| `src/nav` | 화면 주소 만들기·읽기(`paths`), 고른 주제(`SelectedTopicProvider`, 마지막 주제 기억), 주제 화면의 주제(`useRouteTopic`) |
| `src/menu.tsx` | 메뉴 목록(레지스트리): 고른 주제 메뉴 · 공통 메뉴. 사이드 메뉴·지금 위치·화면 주소가 여기서 만들어진다 |
| `src/components` | 사이드 메뉴(`SideNav`), 위쪽 막대(`TopBar`), 작업 패널·알림(`TaskShell`), 작업 상세의 판단 근거(`EvidencePanel`)·초안(`DraftCard`)·게시(`PostControl`) 등 여러 화면이 함께 쓰는 것 |
| `src/pages` | 화면들과 주제 화면 틀(`TopicLayout`: 불러오는 중·없는 주제를 한 번만 보인다) |

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 화면 |
| `npm test` | 테스트 (jsdom, 디자인 시스템으로 실제 그리기 포함) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | oxlint |
| `npm run build` | 배포용 빌드 (`dist/`) |
