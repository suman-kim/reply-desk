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

| 주소 | 화면 |
| --- | --- |
| `/?topic=&video=&step=` | 대시보드: 주제 사이드바, 단계 표시줄, ① 영상 불러오기 · ② 영상 선택 · ③ 댓글 달기를 한 번에 한 화면씩 [이전]·[다음]으로 넘김 |
| `/logs?topic=` | 게시 기록: 주제·결과(성공·실패)로 거르기, 실패 원인과 캡처 |
| `/drafts` | 초안 목록: 상태·주제·검색 필터, 오른쪽에서 고치기·게시 |
| `/accounts` | 계정 관리: 프로필 카드, 새 프로필 연결 4단계 |
| `/topics/new`, `/topics/:id/edit` | 새 주제 만들기 / 주제 설정 |
| `/settings` | 설정: 하루 상한, 크롬 창 보이기, 분석·작성 AI 고르기, Ollama |

## 구조

| 폴더 | 하는 일 |
| --- | --- |
| `src/ds` | 디자인 시스템 불러오기 (React 전역 → tokens.css → bundle.css → bundle.js) |
| `src/api` | 서버 타입, 호출(`api`, `ApiError`), 데이터 훅(TanStack Query) |
| `src/live` | 실시간 이벤트(EventSource) → 데이터 캐시 반영 |
| `src/components` | ② 초안 검토(`DraftReview`), ③ 게시(`PostControl`) 등 여러 화면이 함께 쓰는 것 |
| `src/pages` | 화면 다섯 개 |

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 화면 |
| `npm test` | 테스트 (jsdom, 디자인 시스템으로 실제 그리기 포함) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | oxlint |
| `npm run build` | 배포용 빌드 (`dist/`) |
