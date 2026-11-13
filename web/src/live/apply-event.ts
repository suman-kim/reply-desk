import type { QueryClient } from '@tanstack/react-query';
import { keys } from '../api/queries';
import type { AttemptView, DraftProgress, LoginStatus, PostStatus, PostStep, StepView, TodayQuota } from '../api/types';

/** 서버가 보내는 실시간 이벤트 (server/src/events/app-events.ts 와 같은 모양) */
export type LiveEvent =
  | ({ type: 'draft.progress'; topicId: number } & DraftProgress)
  | {
      type: 'draft.updated';
      topicId: number;
      videoId: number;
      draftId: number;
      state: 'writing' | 'ready' | 'error';
      checkPassed: boolean;
      errorMessage: string | null;
    }
  | {
      type: 'post.progress';
      attemptId: number;
      topicId: number;
      videoId: number;
      steps: StepView[];
      typing: { typed: number; total: number };
    }
  | { type: 'post.preview'; attemptId: number; topicId: number; seq: number }
  | {
      type: 'post.finished';
      attemptId: number;
      topicId: number;
      videoId: number;
      status: PostStatus;
      steps: StepView[];
      failureReason: string | null;
      hasCapture: boolean;
      commentUrl: string | null;
    }
  | ({ type: 'quota.updated' } & TodayQuota)
  | { type: 'profile.updated'; profileId: number; name: string; loginStatus: LoginStatus };

/** 받는 이벤트 이름 */
export const LIVE_EVENT_TYPES: LiveEvent['type'][] = [
  'draft.progress',
  'draft.updated',
  'post.progress',
  'post.preview',
  'post.finished',
  'quota.updated',
  'profile.updated',
];

/** 키 앞부분으로 다시 읽기 */
function refresh(qc: QueryClient, ...prefixes: string[]): void {
  for (const p of prefixes) void qc.invalidateQueries({ queryKey: [p] });
}

/**
 * 이벤트 하나를 화면 데이터에 반영한다.
 * 숫자처럼 이벤트에 다 들어 있는 것은 캐시를 바로 고치고, 나머지는 다시 읽는다.
 * @param qc 데이터 캐시
 * @param e 이벤트
 */
export function applyLiveEvent(qc: QueryClient, e: LiveEvent): void {
  switch (e.type) {
    case 'draft.progress': {
      const { type: _type, topicId, ...progress } = e;
      qc.setQueryData(keys.progress(topicId), progress);
      if (!progress.running) refresh(qc, 'topics', 'drafts');
      return;
    }
    case 'draft.updated':
      void qc.invalidateQueries({ queryKey: keys.videos(e.topicId) });
      void qc.invalidateQueries({ queryKey: keys.draft(e.topicId, e.videoId) });
      refresh(qc, 'drafts', 'postCheck', 'topics');
      return;
    case 'post.progress':
      qc.setQueryData<AttemptView>(keys.attempt(e.attemptId), (old) =>
        old ? { ...old, status: 'running', steps: e.steps, typing: e.typing } : old,
      );
      return;
    case 'post.preview':
      qc.setQueryData(keys.preview(e.attemptId), e.seq);
      qc.setQueryData<AttemptView>(keys.attempt(e.attemptId), (old) => (old ? { ...old, hasPreview: true } : old));
      return;
    case 'post.finished':
      qc.setQueryData<AttemptView>(keys.attempt(e.attemptId), (old) =>
        old
          ? {
              ...old,
              status: e.status,
              steps: e.steps,
              failureReason: e.failureReason,
              hasCapture: e.hasCapture,
              commentUrl: e.commentUrl,
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: keys.attempt(e.attemptId) });
      void qc.invalidateQueries({ queryKey: keys.videos(e.topicId) });
      void qc.invalidateQueries({ queryKey: keys.draft(e.topicId, e.videoId) });
      refresh(qc, 'logs', 'postCheck', 'topics', 'drafts', 'profiles');
      return;
    case 'quota.updated': {
      const { type: _type, ...today } = e;
      qc.setQueryData(keys.today, today);
      refresh(qc, 'topics', 'postCheck', 'profiles');
      return;
    }
    case 'profile.updated':
      refresh(qc, 'profiles', 'topics', 'postCheck');
      return;
  }
}

/** 이 단계 이름 (테스트·표시용) */
export type { PostStep };
