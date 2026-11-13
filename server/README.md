# reply-desk 서버

유튜브 댓글 에이전트 대시보드의 API 서버입니다. NestJS 12 + TypeORM 1 + PostgreSQL 17을 씁니다.
크롬 프로필과 사람이 직접 하는 로그인이 필요해서 **이 맥에서 돌립니다.**

설계와 API 목록은 [`../docs/server.md`](../docs/server.md)에 있습니다.

## 처음 실행

```sh
cd server
npm install
cp env.example .env.development   # YOUTUBE_API_KEY, AI 키를 채운다 (비워도 서버는 뜬다)
npm run db:up            # PostgreSQL 컨테이너 (127.0.0.1:5441)
npm run start:dev        # http://127.0.0.1:4100/api
```

서버가 뜰 때 밀린 마이그레이션을 자동으로 적용합니다. 상태 확인: `curl 127.0.0.1:4100/api/health`

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run start:dev` | 개발 서버 (고치면 다시 뜸) |
| `npm test` | 단위 테스트 (DB 없이) |
| `npm run test:e2e` | e2e 테스트. `reply_desk_test` DB를 비우고 다시 만든다. `npm run db:up` 먼저 |
| `npm run test:live` | 실제 YouTube 게시 시험 (손으로만). `LIVE_PROFILE_DIR`·`LIVE_VIDEO_ID`가 없으면 건너뛴다. 기본은 입력까지만, `LIVE_SUBMIT=1`이면 실제로 게시, `LIVE_FIND_TEXT`면 이미 단 댓글을 찾아 캡처만. 자세한 것은 `docs/server.md`의 '실제 게시 시험' |
| `npm run lint` | oxlint |
| `npm run migration:generate -- src/database/migrations/<이름>` | 엔티티 변경으로 마이그레이션 만들기. 만든 뒤 `src/database/migrations.ts`에 추가 |
| `npm run migration:revert` | 마지막 마이그레이션 되돌리기 |

## 포트

| 무엇 | 주소 |
| --- | --- |
| API | `127.0.0.1:4100` |
| PostgreSQL | `127.0.0.1:5441` (사용자·비밀번호·DB: `reply_desk`, 테스트 DB: `reply_desk_test`) |

다른 프로젝트 DB(5432, 5434, 55432)와 겹치지 않게 골랐습니다.
