# reply-desk 대시보드 화면

유튜브 댓글 에이전트의 관리 화면입니다. Vite + React 19 + TypeScript, 디자인 시스템은 `../design/inyeon-design-system`(Inyeon)을 복사하지 않고 그대로 불러옵니다.

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
| `/t/:topicId/dashboard?video=&step=` | 대시보드: 단계 표시줄, ① 영상 불러오기(영상만, 링크로 추가, [영상 보기] 창: 플레이어·인기 댓글) · ② 영상 선택(고른 영상의 근거·초안, [초안 작성]) · ③ 댓글 달기를 한 번에 한 화면씩 [이전]·[다음]으로 넘김 |
| `/t/:topicId/drafts?video=` | 작업 목록: 이 주제의 초안, 상태·검색 필터, 행을 누르면 작업 창(고치기·게시) |
| `/t/:topicId/logs` | 댓글 게시 목록: 이 주제의 게시 결과(성공·실패), 실패 원인과 캡처 |
| `/t/:topicId/settings` | 주제 설정 |
| `/topics/new` | 새 주제 만들기 |
| `/accounts` | 계정 관리: 프로필 카드, 새 프로필 연결 4단계 |
| `/settings` | 설정: 하루 상한, 크롬 창 보이기, 분석·작성 AI 고르기, Ollama |

예전 주소(`/?topic=`, `/drafts?topic=&video=`, `/logs?topic=`, `/topics/:id/edit`)는 새 주소로 넘어갑니다.

## 구조

| 폴더 | 하는 일 |
| --- | --- |
| `src/ds` | 디자인 시스템 불러오기 (React 전역 → tokens.css → bundle.css → bundle.js) |
| `src/api` | 서버 타입, 호출(`api`, `ApiError`), 데이터 훅(TanStack Query) |
| `src/live` | 실시간 이벤트(EventSource) → 데이터 캐시 반영, 알림 규칙 |
| `src/nav` | 화면 주소 만들기·읽기(`paths`), 고른 주제(`SelectedTopicProvider`, 마지막 주제 기억), 주제 화면의 주제(`useRouteTopic`) |
| `src/menu.tsx` | 메뉴 목록(레지스트리): 고른 주제 메뉴 · 공통 메뉴. 사이드 메뉴·지금 위치·화면 주소가 여기서 만들어진다 |
| `src/components` | 사이드 메뉴(`SideNav`), 위쪽 막대(`TopBar`), 작업 패널·알림(`TaskShell`), ② 초안 검토(`DraftReview`), ③ 게시(`PostControl`) 등 여러 화면이 함께 쓰는 것 |
| `src/pages` | 화면들과 주제 화면 틀(`TopicLayout`: 불러오는 중·없는 주제를 한 번만 보인다) |

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 화면 |
| `npm test` | 테스트 (jsdom, 디자인 시스템으로 실제 그리기 포함) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | oxlint |
| `npm run build` | 배포용 빌드 (`dist/`) |
