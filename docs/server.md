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
| `profiles` | 크롬 프로필 등록, 폴더 만들기, 내 채널 목록, [크롬 열고 직접 로그인]·[로그인 확인] | 완료 |
| `topics` | 주제(홍보 대상) CRUD, 쓸 프로필, 오늘 게시 수·초안 대기 수 | 완료 |
| `videos` | YouTube 검색 → 코드가 정렬 → 저장, 링크 직접 추가, 카드 배지 | 완료 |
| `checks` | 자동 검사 6종 (전략 패턴: 검사 1개 = 클래스 1개) | 완료 |
| `rules` | 게시 차단 사유 (책임 연쇄: 계획서 1~6 순서 + 일시정지·게시 중·프로필), 자동 배정 | 완료 |
| `posting` | 오늘 게시 현황, 게시 기록 | 완료 |
| `browser` | 크롬 조작 인터페이스(`YoutubeBrowser`·`YoutubePage`, 어댑터)와 Playwright 구현, 프로필 잠금 | 완료 |
| `publish` | [댓글 달기]: 규칙 재확인 → 게시 중 행 → 5단계(단계마다 객체), 미리보기·실패 캡처 | 완료 |
| `events` | 실시간 이벤트(관찰자 패턴, rxjs `Subject`)와 SSE `GET /events?topicId=` | 완료 |
| `ai` | 제공자 어댑터 4개(`AiProvider`, 어댑터 패턴), 역할별 선택(`AiService`) | 완료 |
| `drafts` | 영상 분석 → 초안 작성 → 자동 검사, 작성 대기열(차례로 하나씩), 다시 생성, 고치기, 초안 목록 | 완료 |

## 다른 채널 영상 게시와 광고 표시

계획서는 "내 채널 영상만 게시, 다른 채널은 초안까지"였다. 2026-11-13에 **모든 영상에 게시할 수 있게** 바꿨다. 대신 다른 채널 영상에 다는 댓글은 업체 홍보라는 표시를 맨 앞에 둔다.
- 이유: 초안은 시청자 말투로 운명원을 추천한다. 남의 영상에 표시 없이 달면 표시·광고법이 막는 '소비자인 척하는 광고'(공정위 추천·보증 심사지침: 경제적 이해관계를 첫 부분에 밝힌다)가 되고, YouTube 스팸·기만 행위 정책에도 걸린다.
- 주제마다 `topic.ad_disclosure`(기본 `[광고]`, '광고'나 '협찬'이 들어가야 함)를 둔다. 내 채널 영상에는 붙이지 않는다.
- 초안 작성: AI에게 맡기지 않고 코드가 맨 앞에 붙인다(`checks/ad-disclosure.ts`). 글 안 다른 곳에 있던 표시는 빼고 한 번만 둔다.
- 자동 검사 `ad_disclosure`: 다른 채널 영상이면 맨 앞에 표시가 있어야 통과한다. 길이·해시태그 등 다른 검사는 표시를 뺀 본문만 본다(`#광고`로 정해도 해시태그 검사에 걸리지 않는다).
- 차단 규칙 4번 `ad_disclosure_missing`(예전 `not_my_channel` 자리): 게시 직전에 글을 다시 본다. 검사 뒤에 프로필이 지워져 '내 채널'이 바뀐 경우까지 막는다.
- 초안 목록의 "초안만" 상태는 없앴다. 영상당 1개·하루 상한·사람 확인은 그대로다.

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

## 크롬 로그인과 댓글 게시

- **로그인**: 구글은 자동화 크롬에서 로그인을 막는다. 그래서 [크롬 열기](`POST /profiles/:id/login`)는 **일반 크롬**을 그 프로필 폴더로 열기만 한다(`open -na "Google Chrome" --args --user-data-dir=… --remote-debugging-port=0 --disable-blink-features=AutomationControlled`). 사람이 로그인하면 [연결 확인](`POST /profiles/:id/check`)이 로그인 여부, 채널 ID, 채널 이름, 화면 언어를 읽는다. 채널 ID는 `/profile`이 넘겨 주는 내 채널 주소(또는 canonical 링크)에서 읽고, 안 되면 `/account_advanced`의 읽기 전용 입력 칸 값에서 읽는다(이 화면은 ID를 입력 칸에 넣어 innerText로는 안 보인다). 다른 프로필이 이미 쓰는 채널이면 막는다.
- **열어 둔 크롬에 붙기** (`browser/chrome-session.ts`): 로그인 창을 닫지 않아도 된다.
  - 크롬을 쓰기 전에 프로필 폴더의 `SingletonLock`(`컴퓨터이름-프로세스번호`)으로 그 폴더를 쓰는 크롬이 살아 있는지 본다.
  - 없으면 Playwright로 새로 띄운다(로그인 확인은 창 없이, 게시는 설정 `posting.headless`대로). 끝나면 닫는다.
  - 있고 그 크롬이 `--remote-debugging-port`로 떴으면, 폴더의 `DevToolsActivePort`에 적힌 포트로 붙어(`connectOverCDP`) **새 탭**에서 일한다. 끝나면 그 탭만 닫고 연결을 끊는다. 크롬과 사람이 연 탭은 그대로 둔다. 게시도 이 창의 새 탭에서 한다.
  - **창을 모두 닫은 크롬**: 맥은 창을 닫아도 크롬이 남는다. 창이 하나도 없으면 크롬이 그 프로필을 내려놓아 원격 연결이 `Browser context management is not supported`로 실패한다. 그래서 탭이 없으면 `PUT /json/new?about:blank`로 빈 탭을 먼저 열어 프로필을 다시 올리고, 그 탭에서 일한 뒤 닫는다(창 없는 상태로 돌아감). 실제 계정에서 창을 닫은 뒤 [연결 확인]이 이 오류로 막혔던 것을 고쳤다(2026-11-13).
  - 붙지 못하면 원래 오류를 서버 로그에 "원인:"으로 남긴다.
  - 원격 연결 없이 연 크롬(직접 연 크롬, 이 기능 전에 연 창)에는 붙을 수 없다. [연결 확인]·게시는 "[크롬 열기]를 누르면 다시 열려 이어 쓸 수 있어요"로 막는다.
  - **[크롬 열기]는 그런 크롬을 정상 종료(SIGTERM, ⌘Q와 같이 쿠키를 저장하고 끝남)한 뒤 원격 연결로 다시 연다.** 그냥 열면 macOS가 이미 떠 있는 크롬에 창만 더 열어 원격 연결 인자가 무시되기 때문이다. 15초 안에 끝나지 않으면 강제로 끄지 않고 "⌘Q로 직접 종료" 안내(409)를 낸다. 닫고 여는 동안은 프로필 잠금으로 [연결 확인]·게시가 끼어들지 못한다. 응답의 `restarted`로 화면이 "닫고 다시 열었어요"를 알린다.
  - 원격 연결 포트만 켜면 크롬이 `navigator.webdriver`를 true로 바꿔 구글이 로그인을 막을 수 있다. 그래서 `--disable-blink-features=AutomationControlled`를 함께 넣어 false로 둔다(Chrome 157에서 붙기 전 값을 페이지가 직접 보고해 확인함: 포트만 → true, 둘 다 → false).
  - 보안: 포트는 127.0.0.1에서만 열리지만, 이 맥의 다른 프로그램도 열린 동안 그 크롬을 다룰 수 있다. 쓰지 않을 때는 로그인 창을 끝내 두는 편이 안전하다.
- **Playwright 설정**: 이 맥의 Google Chrome(`channel: 'chrome'`)을 쓴다. 맥에서는 `--use-mock-keychain`, `--password-store=basic`이 있으면 일반 크롬으로 저장한 쿠키를 못 읽어 로그아웃 상태로 보인다. 그래서 이 둘과 `--enable-automation`을 기본 인자에서 뺀다.
- **[댓글 달기]** (`POST /topics/:id/videos/:videoId/post`):
  - 시작은 한 번에 하나씩 한다: 차단 규칙 재확인 → 프로필 잠금 → `post_attempt`(running) 넣기. 하루 상한과 자동 배정이 겹치지 않게 하기 위해서다.
  - 같은 영상 동시 게시와 영상당 1개는 DB 부분 유일 인덱스가 마지막으로 막는다.
  - 5단계(프로필 열기 → 댓글 창 찾기 → 한 글자씩 입력 → 게시 → 내 댓글 확인)는 뒤에서 돈다. 화면은 `GET /posting/attempts/:id`로 단계·글자 수를, `/preview`로 1.5초마다 찍은 크롬 화면을 본다.
  - 실패하면 그 단계와 원인을 남기고, 캡처를 `SCREENSHOTS_DIR`에 저장한다(`/capture`). 로그인이 풀린 것이 원인이면 프로필을 "다시 로그인 필요"로 바꿔 자동 배정과 게시에서 뺀다.
  - 서버가 다시 뜨면 running으로 남은 행을 실패로 바꾸고, 유튜브에서 직접 확인하라고 남긴다.
- **설정 `posting.headless`**: 기본은 꺼짐이다. 시연할 때 크롬 창이 떠서 한 글자씩 입력하는 모습이 보인다.
- **화면 요소 규칙**: `browser/youtube-selectors.ts`에 모았다. 유튜브가 화면을 바꾸면 여기만 고친다.

실제 크롬 확인 (2026-11-13, Chrome 157, 로그인하지 않은 빈 프로필, 댓글은 달지 않음):
- [로그인 확인]은 2.2초 만에 "로그인 안 됨"과 화면 언어 `ko-KR`을 읽었다.
- 댓글 창 찾기는 댓글 영역까지 내려가 [댓글 추가…]를 누른 뒤, 로그인 창이 뜬 것을 보고 9.7초 만에 "로그인 필요"로 판정했다. 창 없는 크롬에서는 마우스 휠로 화면이 내려가지 않아 `scrollBy`로 바꿨다.
- [크롬 열기]로 연 크롬이 열려 있을 때 [연결 확인]은 그 크롬에 새 탭으로 붙어 읽고 그 탭만 닫았다. 게시 탭(영상 열기·캡처)도 같았다. 두 번 모두 크롬은 그대로 남았다.
- 원격 연결 없이 연 크롬이 열려 있으면 [연결 확인]은 막고, [크롬 열기]는 그 크롬을 닫고(0.3초) 원격 연결로 다시 열었다. 그 뒤 [연결 확인]이 새 크롬에 붙었고, [크롬 열기]를 한 번 더 누르면 다시 닫지 않았다.

**아직 확인하지 못한 것**: 로그인한 계정으로 하는 한 글자씩 입력, 게시, 내 댓글 확인. 실제 계정과 내 채널의 테스트 영상이 있어야 한다.

## 실시간 이벤트 (SSE)

화면은 `new EventSource('/api/events?topicId=1')` 연결 하나로 아래 이벤트를 받는다. 이벤트 이름이 SSE `event:`가 되므로 `addEventListener('draft.progress', …)`처럼 이름별로 받는다. 모양은 `server/src/events/app-events.ts`에 타입으로 있다.

| 이벤트 | 언제 | 화면 |
| --- | --- | --- |
| `draft.progress` | 자동 작성이 시작·한 편 끝·모두 끝날 때 | ① 버튼 "초안 자동 작성 중 (2/5)" |
| `draft.updated` | 초안이 작성 중·준비됨·실패로 바뀌거나 사람이 고칠 때 | ① 카드 배지, ② 칸 새로 읽기, 초안 목록 |
| `post.progress` | 게시 단계가 바뀔 때, 입력 글자 수(0.15초마다·마지막 글자) | ③ 진행 5단계, "한 글자씩 입력 중 (34/91자)" |
| `post.preview` | 크롬 화면을 새로 찍었을 때 (1.5초마다) | ③ 크롬 미리보기 (`/posting/attempts/:id/preview?seq=`로 다시 받기) |
| `post.finished` | 게시가 끝났을 때 (성공·실패, 원인, 캡처 여부, 댓글 주소) | ③ 게시 완료 띠·실패 원인, 게시 기록 |
| `quota.updated` | 게시에 성공했을 때 | 헤더 "오늘 게시 n/10" |
| `profile.updated` | [로그인 확인]이나 게시 중 로그인이 풀린 것을 알았을 때 | 헤더 "유튜브2 로그인 필요", 계정 관리 경고 띠 |

- `topicId`를 주면 그 주제의 이벤트와 주제가 없는 이벤트(`quota.updated`, `profile.updated`)만 보낸다.
- 25초마다 주석 줄(`: ping`)로 연결을 살려 둔다. 끊기면 EventSource가 스스로 다시 붙는다. 다시 붙은 사이에 놓친 이벤트는 다시 보내지 않으므로, 화면은 다시 붙을 때 조회 API로 상태를 새로 읽는다.
- 이벤트는 메모리에서만 흐른다(서버 하나). 다른 패키지(`@nestjs/event-emitter`)를 더하지 않고 rxjs `Subject`를 쓴다. SSE가 rxjs `Observable`을 그대로 받기 때문이다.

실제 서버 확인 (2026-11-13): `curl -N /api/events`로 연결을 열고 [로그인 확인]을 누르자 `event: profile.updated`가 왔다. 응답 헤더는 `text/event-stream`, `X-Accel-Buffering: no`였다.

## 테이블

모든 테이블·컬럼에 comment가 있다(e2e 테스트가 확인).

| 테이블 | 내용 |
| --- | --- |
| `topic` | 주제: 이름, 유도 대상, 브랜드 단어(등록 화면에서 받지 않음, 비면 브랜드 언급 검사·AI 지시 건너뜀), 키워드[], 기간(일, 0이면 무제한), 정렬, 불러올 수, 말투, 글자 수, 금지 표현[], 광고 표시, 하루 상한, 상태 |
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

초안의 게시 상태(게시 대기·실패·게시 완료)는 저장하지 않고 게시 기록으로 계산한다. 두 곳에 적으면 어긋나기 때문이다.

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
| `GET /drafts?status=&topicId=&q=` | 초안 목록 | 영상마다 최근 초안, 상태별 개수 (게시 대기·실패·검사 미통과·게시 완료·작성 중·작성 실패) |
| `POST /profiles/:id/login` | 계정 관리 | [크롬 열고 직접 로그인] (일반 크롬을 그 프로필로 연다) |
| `POST /profiles/:id/check` | 계정 관리 | [로그인 확인] (채널 ID·이름·화면 언어 저장, 결과 한 줄과 경고 여부) |
| `POST /topics/:id/videos/:videoId/post` `{ profileId? }` | ③ | [댓글 달기]. 막히면 409 `{ code, message }` |
| `GET /posting/attempts/:id` | ③ | 진행 5단계(done·running·failed·waiting), 입력 글자 수, 결과, 댓글 주소 |
| `GET /posting/attempts/:id/preview` | ③ | 크롬 화면 미리보기 (게시 중·끝난 뒤 10분) |
| `GET /posting/attempts/:id/capture` | 게시 기록 | 실패 캡처 ([캡처 보기]) |
| `GET /posting/today` | 헤더 | 오늘 게시 n/상한, 주제별 수 |
| `GET /events?topicId=` | 모든 화면 | 실시간 이벤트 (SSE, 위 '실시간 이벤트' 절) |
| `GET /posting/logs?topicId=&limit=` | 게시 기록 | 최근 순 기록 |

## 남은 것

- 영상을 볼 수 없는 AI(Claude·OpenAI·Ollama)는 자막을 쓰지 못한다. 공식 자막 API는 내 채널 영상만, OAuth로만 받을 수 있다. 그래서 지금은 영상 설명과 인기 댓글만 쓴다.
- 실제 Gemini·Claude·OpenAI 호출은 키가 없어 확인하지 못했다(테스트는 가짜 AI로 했다).

## 다음 작업

1. **실제 계정으로 게시 시험**: 테스트 계정으로 로그인하고, 내 채널의 테스트 영상에 한 번 달아 본다. 입력·게시·확인 단계의 화면 요소 규칙을 확인한다.
2. **대시보드 화면**: `design/inyeon-prototype`과 Inyeon 디자인 시스템 기준.
