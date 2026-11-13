# 서버 설계 (NestJS)

2026-11-13 · 계획서([유튜브 댓글 에이전트 대시보드 — 디자인 계획안](./유튜브%20댓글%20에이전트%20대시보드%20—%20디자인%20계획안.md))의 서버 쪽 구현.

## 결정한 것

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 서버 | NestJS 12 (ESM, Vitest) | 계획서의 FastAPI 대신. Playwright·AI SDK 모두 Node에 있음 |
| DB | PostgreSQL 17 + TypeORM 1 | 테이블·컬럼 comment, 부분 유일 인덱스(영상당 1개)를 DB가 지원 |
| 실행 위치 | 이 맥 | 크롬 프로필 폴더와 사람이 직접 하는 구글 로그인이 필요 |
| AI | 분석·작성마다 Gemini / Claude / Ollama 중 설정에서 고름 | 로컬 모델(Ollama)도 쓸 수 있게. 키는 `.env`, 고르는 건 DB 설정 |
| 검증 | zod + `StandardSchemaValidationPipe`, 오류 문구는 한국어 | 화면에 그대로 보일 "필드: 원인 · 할 일" |

원칙은 계획서대로 **숫자는 코드, 판단은 AI, 검증은 코드**다. 조회수·시각·정렬은 코드가 하고, AI 답은 스키마로 받아 코드가 다시 검사한다.

## 모듈

| 모듈 | 하는 일 | 상태 |
| --- | --- | --- |
| `settings` | 공용 설정(전체 하루 상한, AI 선택, Ollama 주소). 정의 목록에 한 줄 추가하면 API·검증이 생김 | 완료 |
| `profiles` | 크롬 프로필 등록, 폴더 만들기, 내 채널 목록 | 완료 (로그인 확인은 Playwright 작업에서) |
| `topics` | 주제(홍보 대상) CRUD, 쓸 프로필, 오늘 게시 수·초안 대기 수 | 완료 |
| `videos` | YouTube 검색 → 코드가 정렬 → 저장, 링크 직접 추가, 카드 배지 | 완료 |
| `checks` | 자동 검사 6종 (전략 패턴: 검사 1개 = 클래스 1개) | 완료 |
| `rules` | 게시 차단 사유 (책임 연쇄: 계획서 1~6 순서 + 일시정지·게시 중·프로필), 자동 배정 | 완료 |
| `posting` | 오늘 게시 현황, 게시 기록 | 조회 완료, 실제 게시는 다음 작업 |
| `ai` | 제공자 인터페이스(`AiProvider`, 어댑터 패턴) | 정의만, 구현은 다음 작업 |
| `drafts` | 분석·초안 엔티티 | 엔티티만, 생성·수정은 다음 작업 |

## 테이블

모든 테이블·컬럼에 comment가 있다(e2e 테스트가 확인).

| 테이블 | 내용 |
| --- | --- |
| `topic` | 주제: 이름, 유도 대상, 브랜드 단어, 키워드[], 기간(일), 정렬, 불러올 수, 말투, 글자 수, 금지 표현[], 하루 상한, 상태 |
| `topic_profile` | 주제가 쓸 프로필 |
| `profile` | 크롬 프로필: 이름, 폴더, 가린 구글 계정, 채널 ID(=내 채널), 화면 언어, 로그인 상태 |
| `video` | 유튜브 영상과 숫자(조회수·시각·길이). 여러 주제가 함께 씀 |
| `topic_video` | 주제별 영상 목록과 불러오기 순위, 들어온 경로(검색·직접) |
| `video_analysis` | AI 분석: 고민 한 줄, 고른 이유[], 근거 장면[], 장면 핵심 단어[] |
| `draft` | 초안: 글, AI 원본, 쓴 이유[], 고쳤는지, 검사 결과, 작성 상태 |
| `post_attempt` | 게시 기록: 결과, 실패 단계·원인, 캡처, 댓글 주소 |
| `app_setting` | 공용 설정 (키-값) |

운영 규칙을 DB가 직접 막는 곳:

- **영상당 댓글 1개**: `post_attempt(video_id) WHERE status='success'` 유일 인덱스. 동시에 두 번 눌려도 하나만 성공한다.
- **같은 영상 동시 게시 금지**: `post_attempt(video_id) WHERE status='running'` 유일 인덱스.
- **하루 상한**: 한국 시간 0시 기준으로 성공 행을 센다(`common/kst.ts`).

초안의 게시 상태(게시 대기·실패·게시 완료·초안만)는 저장하지 않고 게시 기록과 내 채널 여부로 계산한다. 두 곳에 적으면 어긋나기 때문이다.

## API

모든 주소는 `/api` 아래. 오류는 `{ statusCode, error, message }`이고 `message`는 한국어 한 줄(또는 `"필드: 원인"` 목록)이다.

| 메서드·주소 | 화면 | 하는 일 |
| --- | --- | --- |
| `GET /health` | - | 서버·DB 상태 |
| `GET /settings` | 설정 | 모든 설정 (이름·도움말·값·기본값) |
| `PUT /settings/:key` `{ value }` | 설정 | 값 바꾸기 |
| `DELETE /settings/:key` | 설정 | 기본값으로 |
| `GET /settings/ai/providers` | 설정 | AI 제공자별 사용 가능 여부와 안내 |
| `GET /profiles` | 계정 관리 | 프로필 카드 목록 (오늘 게시, 쓰는 주제) |
| `POST /profiles` `{ name, slug? }` | 계정 관리 | 만들기 + 폴더 만들기 (`유튜브4` → `youtube4`) |
| `PATCH /profiles/:id` `{ name }` | 계정 관리 | 이름 바꾸기 |
| `DELETE /profiles/:id` | 계정 관리 | 지우기 (크롬 폴더는 남김) |
| `GET /topics` | 사이드바 | 주제 목록 (오늘 n/상한, 초안 대기, 상태, 프로필) |
| `POST /topics` | 새 주제 | 만들기 (계획서 예시 값이 기본값) |
| `PATCH /topics/:id` | 주제 설정 | 보낸 값만 고치기, `profileIds`는 통째로 바꿈 |
| `DELETE /topics/:id` | 주제 설정 | 지우기 (게시 기록은 남음) |
| `GET /topics/:id/videos` | ① | 영상 카드 (순위, 내 채널, 댓글 완료, 초안 상태) |
| `POST /topics/:id/videos/fetch` | ① | [영상 불러오기] |
| `POST /topics/:id/videos` `{ url }` | ② | 링크 직접 추가 |
| `GET /topics/:id/videos/:videoId` | ② | 영상 하나 |
| `GET /topics/:id/post-check?videoId=&profileId=` | ③ | 버튼 열림 여부, 차단 사유 한 줄, 이번 차례 프로필, 오늘 n/상한 |
| `GET /posting/today` | 헤더 | 오늘 게시 n/상한, 주제별 수 |
| `GET /posting/logs?topicId=&limit=` | 게시 기록 | 최근 순 기록 |

## 다음 작업

1. **AI 분석·작성** (`ai`, `drafts`): Gemini·Claude·Ollama 어댑터, 분석 → 초안 → 자동 검사 저장, 초안 수정 시 다시 검사, 진행률(2/5). NestJS 12의 `@nestjs/ai` 패키지가 있어 먼저 검토한다.
2. **Playwright** (`profiles`, `posting`): 크롬 열고 직접 로그인, 채널·화면 언어 확인, 게시 5단계, 실패 캡처, 프로필별 잠금.
3. **실시간 진행** (`events`): SSE로 진행률·게시 단계·크롬 스크린샷.
4. **대시보드 화면**: `design/inyeon-prototype`과 Inyeon 디자인 시스템 기준.
