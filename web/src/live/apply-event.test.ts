import { QueryClient } from '@tanstack/react-query';
import { keys } from '../api/queries';
import type { AttemptView } from '../api/types';
import { applyLiveEvent } from './apply-event';

const steps = (state: 'done' | 'running' | 'failed' | 'waiting') =>
  [{ step: 'type' as const, label: '한 글자씩 입력 중', state }];

describe('실시간 이벤트 반영', () => {
  it('진행률은 캐시를 바로 고친다', () => {
    const qc = new QueryClient();
    applyLiveEvent(qc, { type: 'draft.progress', topicId: 1, total: 5, done: 2, failed: 0, running: true, currentVideoId: 9, lastError: null });
    expect(qc.getQueryData(keys.progress(1))).toEqual({ total: 5, done: 2, failed: 0, running: true, currentVideoId: 9, lastError: null });
  });

  it('게시 진행·끝을 게시 상태에 합친다', () => {
    const qc = new QueryClient();
    const base = { id: 7, status: 'running', steps: [], typing: null, hasPreview: false } as unknown as AttemptView;
    qc.setQueryData(keys.attempt(7), base);
    applyLiveEvent(qc, { type: 'post.progress', attemptId: 7, topicId: 1, videoId: 2, steps: steps('running'), typing: { typed: 34, total: 91 } });
    expect(qc.getQueryData<AttemptView>(keys.attempt(7))?.typing).toEqual({ typed: 34, total: 91 });

    applyLiveEvent(qc, { type: 'post.preview', attemptId: 7, topicId: 1, seq: 3 });
    expect(qc.getQueryData(keys.preview(7))).toBe(3);
    expect(qc.getQueryData<AttemptView>(keys.attempt(7))?.hasPreview).toBe(true);

    applyLiveEvent(qc, {
      type: 'post.finished', attemptId: 7, topicId: 1, videoId: 2, status: 'failed', steps: steps('failed'),
      failureReason: '로그인이 풀렸어요', hasCapture: true, commentUrl: null,
    });
    expect(qc.getQueryData<AttemptView>(keys.attempt(7))).toMatchObject({ status: 'failed', failureReason: '로그인이 풀렸어요', hasCapture: true });
  });

  it('오늘 게시 수를 바로 고친다', () => {
    const qc = new QueryClient();
    applyLiveEvent(qc, { type: 'quota.updated', posted: 3, cap: 10, byTopic: { '1': 3 } });
    expect(qc.getQueryData(keys.today)).toEqual({ posted: 3, cap: 10, byTopic: { '1': 3 } });
  });

  it('초안이 바뀌면 그 영상의 목록·상세를 다시 읽게 한다', () => {
    const qc = new QueryClient();
    qc.setQueryData(keys.videos(1), []);
    qc.setQueryData(keys.draft(1, 2), {});
    applyLiveEvent(qc, { type: 'draft.updated', topicId: 1, videoId: 2, draftId: 3, state: 'ready', checkPassed: true, errorMessage: null });
    expect(qc.getQueryState(keys.videos(1))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(keys.draft(1, 2))?.isInvalidated).toBe(true);
  });
});
