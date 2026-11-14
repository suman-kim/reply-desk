# 같은 영상에 댓글 더 달기 (RD-27) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시를 마친 영상에도 새 초안을 써서 같은 영상에 댓글을 더 달 수 있게 한다(게시 기록은 남긴다).

**Architecture:** '게시 완료'의 단위를 영상에서 초안으로 바꾼다. DB 유일 인덱스를 초안마다 성공 1개로 바꾸고, 상태 계산(영상 목록·작업 목록·게시 대기 수·차단 규칙)을 "이 주제의 가장 최근 초안에 성공 기록이 있는가"로 맞춘다. 새 초안에는 이미 단 댓글을 프롬프트로 넘기고, 같은 글은 자동 검사로 막는다.

**Tech Stack:** NestJS 11 + TypeORM 1 + PostgreSQL 17 (server, vitest·e2e), React 19 + react-query + react-router 8 (web, vitest).

**Spec:** `docs/superpowers/specs/2026-11-14-repost-same-video-design.md`

## Global Constraints
- 인덱스 이름: 새 `uq_post_attempt_draft_success` (`draft_id`, `WHERE status='success'`), 지울 `uq_post_attempt_video_success`, 그대로 둘 `uq_post_attempt_video_running`.
- 차단 규칙 코드: `draft_already_posted` (예전 `already_commented` 대신).
- 이미 단 댓글은 최근 5개, 주제·계정 상관없이 이 영상의 성공 기록에서.
- 주석·DB comment는 한국어로 쓰고, 화면 문구는 쉬운 우리말로 쓴다. "영상당 1개" 문구는 남기지 않는다.

## Review Focus
1. 게시한 뒤 [다시 생성] → 새 초안이 '게시 대기'로 보이고, 작업 상세의 댓글 달기 카드가 예전 '게시 완료'를 이어 보이지 않아야 한다 (PostControl이 지금 초안의 시도만 본다) → Task 5 테스트.
2. 예전 초안의 마지막 시도가 실패였어도 새 초안은 '실패'가 아니라 '게시 대기'다 → Task 2 e2e.
3. 다른 주제가 단 댓글은 이 주제의 상태를 '게시 완료'로 만들지 않지만, 댓글 수와 프롬프트·중복 검사에는 들어간다 → Task 2·4.
4. 게시한 초안을 PATCH로 고치면 409 → Task 3 e2e.
5. 이미 단 댓글과 공백만 다른 글은 중복으로 걸린다 → Task 4 단위 테스트.

---

### Task 1: DB 인덱스 — 초안마다 성공 1개
**Files:** Create `server/src/database/migrations/1794610000000-PostAttemptSuccessPerDraft.ts`; Modify `server/src/database/migrations.ts`, `server/src/posting/post-attempt.entity.ts:38-56`
- [ ] 마이그레이션 up: `DROP INDEX "public"."uq_post_attempt_video_success"` → `CREATE UNIQUE INDEX "uq_post_attempt_draft_success" ON "post_attempt" ("draft_id") WHERE "status" = 'success'` → 표 comment를 `'게시 시도 기록(게시 기록 표). 초안당 성공 1개·같은 영상 동시 게시 막기·하루 상한을 이 표로 판단'`으로. down은 반대(영상당 인덱스는 성공이 2개 이상인 영상이 있으면 실패한다고 주석).
- [ ] 엔티티 `@Index` 두 줄과 클래스 주석을 같게 바꾼다.
- [ ] e2e(`test/app.e2e-spec.ts`): 같은 영상에 다른 초안 두 개의 success 행을 넣어도 되고, 같은 초안 success 두 행은 `/uq_post_attempt_draft_success/`로 실패.
- [ ] 커밋은 Task 3까지 함께.

### Task 2: 상태 계산을 초안 단위로
**Files:** `server/src/drafts/draft-status.ts`, `server/src/videos/videos.service.ts:29-70,566-630`, `server/src/drafts/drafts.service.ts:205-250,320-370`, `server/src/topics/topics.service.ts:212-240`
**Produces:** `VideoItem.commented` = 이 주제 최근 초안 게시 여부(뜻만 바뀜), 새 `VideoItem.commentCount: number`; `DraftDetail.attempts[]`에 `draftId`, `commentText` 추가.
- [ ] `draftListStatus` 입력 이름 `commented` → `posted`(최근 초안에 성공 기록), `lastPostFailed`는 그 초안의 마지막 시도.
- [ ] `toItems`: 최근 초안 쿼리에 `id`를 더해, 그 초안 id들의 success 기록으로 `commented`; video_id별 success 수로 `commentCount`.
- [ ] `detail`: attempts select에 `draftId`, `commentText`; `lastPostFailed`는 `attempts.find(a => a.draftId === draft.id)`.
- [ ] `list` SQL: 영상 기준이 아닌 최근 초안 id 기준으로 posted·마지막 상태·comment_url.
- [ ] `pendingDraftCounts`: `NOT EXISTS (… a.draft_id = d.id AND a.status='success')` (서브쿼리에 id 추가).
- [ ] e2e: 성공 뒤 새 초안 → 영상 카드 `commented=false, commentCount=1`, 작업 목록 `pending`, 주제 `pendingDrafts` 다시 1.

### Task 3: 차단 규칙·게시·고치기
**Files:** `server/src/rules/block-rules.ts`, `server/src/rules/post-guard.service.ts`, `server/src/publish/publish.service.ts:270-285`, `server/src/drafts/drafts.service.ts` `edit`, specs
- [ ] `PostGuardContext.alreadyCommented` → `draftPosted: boolean`; 규칙 `draft_already_posted`: `'이 초안은 이미 게시했어요 · [새 초안 쓰고 한 번 더 달기]로 새 댓글을 써 주세요'`.
- [ ] post-guard: 최근 초안 id로 success 존재 여부.
- [ ] publish 유일 위반 메시지: `'이 영상은 지금 게시하는 중이거나 이 초안은 이미 게시했어요 · 잠시 뒤 다시 불러와 주세요'`.
- [ ] `edit`: 그 초안에 success 기록이 있으면 `ConflictException('게시한 초안은 고칠 수 없어요 · [새 초안 쓰고 한 번 더 달기]로 새로 써 주세요')`.
- [ ] 단위(block-rules.spec)·e2e(app, publish) 기대값 갱신. 커밋 "RD-27: 게시 완료를 초안 단위로 (DB 인덱스·상태·차단 규칙)".

### Task 4: 이미 단 댓글 — 프롬프트와 중복 검사
**Files:** `server/src/drafts/draft-prompt.ts`, `server/src/drafts/drafting.service.ts`, `server/src/drafts/draft-queue.service.ts`, `server/src/checks/check.types.ts`, `server/src/checks/draft-checks.ts`, `server/src/drafts/drafts.service.ts` `edit`, `server/src/posting/post-log.service.ts`(또는 새 조회 함수)
**Produces:** `postedCommentsOf(videoId: number, limit = 5): Promise<string[]>`(최근 순); `CheckContext.postedTexts: string[]`; `checkContextOf(text, topic, analysis, disclosure, postedTexts = [])`; `buildDraftPrompt(topic, video, analysis, retry?, templates?, posted: string[] = [])`; `DraftingService.write(topic, video, analysis, disclosure, posted: string[] = [])`.
- [ ] 프롬프트 끝(다시 쓸 때 글 앞)에 붙는 글:
  ```
  [이미 이 영상에 단 댓글]
  - …
  위 댓글과 겹치지 않게 다른 장면이나 다른 말로 써 줘.
  ```
- [ ] `NotDuplicateCheck`(code `not_duplicate`, 이름 '이미 단 댓글과 다름'): `postedTexts`가 비면 건너뛰고, 공백을 하나로 모은 글이 같으면 실패 `'이 영상에 이미 단 댓글과 같아요 · 다르게 고쳐 주세요'`, 통과 detail `'달라요'`. `DEFAULT_CHECKS` 맨 끝.
- [ ] 단위: 공백만 다른 글 → 실패, 단 댓글 없음 → 결과에 없음, 프롬프트에 블록이 들어가고 없으면 안 들어감.
- [ ] 커밋 "RD-27: 새 초안에 이미 단 댓글을 넘기고 같은 글은 검사에서 막기".

### Task 5: 화면
**Files:** `web/src/api/types.ts`, `web/src/components/DraftCard.tsx`, `web/src/components/PostControl.tsx`, `web/src/pages/TaskDetailPage.tsx`, tests
- [ ] 타입: `VideoItem.commentCount`, attempts `draftId`, `commentText`.
- [ ] DraftCard: `posted = detail.status?.code === 'posted'`; 게시한 초안이면 글은 읽기만, 안내 `'게시한 초안이에요 · 같은 영상에 댓글을 더 달려면 [새 초안 쓰기]'`, [새 초안 쓰기](primary)·[분석부터 다시]는 늘 누를 수 있음.
- [ ] PostControl: `draftId` prop; 처음 시도는 그 초안의 것만; 완료 화면 문구에서 '영상당 1개' 빼고 [새 초안 쓰고 한 번 더 달기](regenerate) 추가.
- [ ] TaskDetailPage: PostControl key `${video.id}:${draft.id}:${그 초안의 마지막 시도 id}`; 머리에 `commentCount > 0`이면 '이 영상에 단 댓글 N개'; 게시 기록 행에 단 댓글 글(성공이면).
- [ ] 테스트: DraftCard 게시한 초안 → 읽기만 + [새 초안 쓰기] 켜짐; PostControl 예전 초안의 성공 시도만 있으면 완료 화면이 아니다.
- [ ] 커밋 "RD-27: 화면 — 게시한 초안 잠금, 새 초안 쓰고 한 번 더 달기, 게시 기록에 단 댓글".

### Task 6: 흐름 시험·문서
- [ ] e2e(publish): 가짜 브라우저로 게시 성공 → [다시 생성] → 새 초안 게시 → 같은 영상 success 2행, 두 번째 프롬프트에 첫 댓글이 들어감.
- [ ] `docs/server.md`의 '영상당 1개' 줄들을 초안당 1개로 고친다.
- [ ] 실제 계정으로 내 영상에 두 번째 댓글을 다는 시험은 사용자 허락을 받은 뒤에만.
