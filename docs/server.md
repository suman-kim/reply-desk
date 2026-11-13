# 서버 설계 (NestJS)

2026-11-13 · 계획서([유튜브 댓글 에이전트 대시보드 — 디자인 계획안](./유튜브%20댓글%20에이전트%20대시보드%20—%20디자인%20계획안.md))의 서버 쪽 구현.

## 결정한 것

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 서버 | NestJS 12 (ESM, Vitest) | 계획서의 FastAPI 대신. Playwright·AI SDK 모두 Node에 있음 |
| DB | PostgreSQL 17 + TypeORM 1 | 테이블·컬럼 comment, 부분 유일 인덱스(영상당 1개)를 DB가 지원 |
| 실행 위치 | 이 맥 | 크롬 프로필 폴더와 사람이 직접 하는 구글 로그인이 필요 |
| AI | 분석·작성마다 Gemini / Claude / OpenAI / Ollama 중 설정에서 고름 | 로컬 모델(Ollama)도 쓸 수 있게. 키는 환경 파일, 고르는 건 DB 설정 |
| AI 호출 | Gemini·Claude·OpenAI는 Vercel AI SDK 7, Ollama는 `/api/chat` 직접 | `@nestjs/ai`는 모델을 미리 이름으로 등록하는 방식이라 DB에서 고르는 이 앱과 맞지 않음. Ollama는 `think:false`·`num_ctx`를 확실히 넣어야 함 |
| 환경 파일 | `.env.<NODE_ENV>`(development·production) → `.env` 순서로 읽음 | NestJS가 정한 값이 아니라 Node 관례. `env.schema.ts`가 development·production·test만 받음 |
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
| `ai` | 제공자 어댑터 4개(`AiProvider`, 어댑터 패턴), 역할별 선택(`AiService`) | 완료 |
| `drafts` | 영상 분석 → 초안 작성 → 자동 검사, 작성 대기열(차례로 하나씩), 다시 생성, 고치기, 초안 목록 | 완료 |

## 영상 분석과 초안 작성

1. **[영상 불러오기]** (`POST /topics/:id/load`): 영상을 불러와 순위를 매긴 뒤, 초안이 없는 영상마다 `draft` 행을 `writing`으로 먼저 만들어 대기열에 넣는다. 그래서 카드에 "초안 작성 중"이 바로 보인다.
2. **대기열**: 한 번에 하나씩 처리한다. 로컬 GPU(Ollama)와 API 사용량 한도를 지키기 위해서다. 주제별 진행률(2/5)은 `GET /topics/:id/drafts/progress`로 본다. 대기열은 메모리에 있어서, 서버가 다시 뜨면 `writing`으로 남은 행을 `error`로 바꾼다.
3. **분석** (설정 `ai.analysis`):
   - Gemini는 유튜브 주소를 그대로 받아 영상을 직접 본다.
   - 나머지 AI는 영상 설명과 인기 댓글(YouTube 공식 API `commentThreads`)로 분석한다.
   - **코드가 검증한다**: 인용은 원문(설명·댓글)과 대조해 없으면 버린다. 시점은 형식과 영상 길이를 본다. 장면 핵심 단어는 인용에 있는 것만 남긴다. 고른 이유의 숫자는 AI가 `{조회수}`·`{올린때}`·`{채널}` 자리만 쓰고 코드가 채운다.
4. **작성** (설정 `ai.drafting`): 초안을 쓰고 자동 검사를 돌린다. 걸리면 걸린 이유를 붙여 한 번 더 쓰고(최대 2번), 그래도 걸리면 "검사 미통과"로 두어 사람이 고친다.
5. **고치기** (`PATCH /drafts/:id`): 고치면 바로 다시 검사한다. AI 원본과 다르면 `edited`가 참이 되어, 화면에서 "AI 초안 기준" 표시를 붙인다.

실측 (2026-11-13, AI PC `gemma4:12b`, 생각 끔, `num_ctx` 16384): 작성 한 번은 모델을 올릴 때 9.6초, 그 뒤 1.4~2.1초였다. JSON 모양은 6번 모두 맞았다. 길이 검사 실패가 1번 있었고, "쓴 이유"의 짧은 말투 예시를 넣은 뒤에는 3번 모두 통과했다. 다만 예시 문구를 그대로 따라 쓰는 경향이 있다.

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
| `GET /settings/ai/providers` | 설정 | AI 제공자별 사용 가능 여부, 안내, 영상 직접 보기 여부, 모델 예시 |
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
| `POST /topics/:id/load` | ① | [영상 불러오기] + 초안 자동 작성 시작 (쓰는 중이면 409) |
| `GET /topics/:id/drafts/progress` | ① | 자동 작성 진행률 (total·done·failed·running·lastError) |
| `GET /topics/:id/videos/:videoId/draft` | ② | 영상·분석·초안·검사·상태·게시 기록 |
| `POST /topics/:id/videos/:videoId/draft` `{ reanalyze? }` | ② | [다시 생성] (쓰는 중이면 409) |
| `PATCH /drafts/:id` `{ text }` | ②·초안 목록 | 고치기 → 바로 다시 검사 |
| `GET /drafts?status=&topicId=&q=` | 초안 목록 | 영상마다 최근 초안, 상태별 개수 (게시 대기·실패·검사 미통과·게시 완료·초안만·작성 중·작성 실패) |
| `GET /posting/today` | 헤더 | 오늘 게시 n/상한, 주제별 수 |
| `GET /posting/logs?topicId=&limit=` | 게시 기록 | 최근 순 기록 |

## 남은 것

- 영상을 볼 수 없는 AI(Claude·OpenAI·Ollama)는 자막을 쓰지 못한다. 공식 자막 API는 내 채널 영상만, OAuth로만 받을 수 있다. 그래서 지금은 영상 설명과 인기 댓글만 쓴다.
- 실제 Gemini·Claude·OpenAI 호출은 키가 없어 확인하지 못했다(테스트는 가짜 AI로 했다).

## 다음 작업

1. **Playwright** (`profiles`, `posting`): 크롬 열고 직접 로그인, 채널·화면 언어 확인, 게시 5단계, 실패 캡처, 프로필별 잠금.
2. **실시간 진행** (`events`): SSE로 진행률·게시 단계·크롬 스크린샷. 지금 진행률은 조회 API로 본다.
3. **대시보드 화면**: `design/inyeon-prototype`과 Inyeon 디자인 시스템 기준.
