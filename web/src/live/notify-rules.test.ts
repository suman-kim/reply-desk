import type { LiveEvent } from './apply-event';
import { NoticeRules } from './notify-rules';

const draft = (state: 'writing' | 'ready' | 'error', over: Partial<Extract<LiveEvent, { type: 'draft.updated' }>> = {}): LiveEvent => ({
  type: 'draft.updated', topicId: 4, videoId: 60, draftId: 9, state, checkPassed: true, errorMessage: null, ...over,
});

describe('실시간 이벤트 → 알림', () => {
  it('작성 중을 본 초안이 준비되면 알리고, 사람이 고친 것(작성 중 없이 바뀜)은 알리지 않는다', () => {
    const rules = new NoticeRules();
    expect(rules.toNotice(draft('ready'))).toBeNull();
    expect(rules.toNotice(draft('writing'))).toBeNull();
    expect(rules.toNotice(draft('ready'))).toMatchObject({ tone: 'success', title: '초안 준비됨', target: { topicId: 4, videoId: 60 } });
    // 한 번 알린 초안을 다시 고쳐도 알리지 않는다
    expect(rules.toNotice(draft('ready'))).toBeNull();
  });

  it('검사 미통과·작성 실패는 원인과 함께', () => {
    const rules = new NoticeRules();
    rules.toNotice(draft('writing'));
    expect(rules.toNotice(draft('ready', { checkPassed: false }))).toMatchObject({ tone: 'warning', title: '초안 검사 미통과' });
    rules.toNotice(draft('writing', { draftId: 10 }));
    expect(rules.toNotice(draft('error', { draftId: 10, errorMessage: 'Gemini가 붐벼요' }))).toMatchObject({
      tone: 'danger', title: '초안 작성 실패', body: 'Gemini가 붐벼요',
    });
  });

  it('게시 성공·실패, 로그인 풀림', () => {
    const rules = new NoticeRules();
    const finished = { type: 'post.finished' as const, attemptId: 1, topicId: 4, videoId: 60, steps: [], hasCapture: true, commentUrl: null };
    expect(rules.toNotice({ ...finished, status: 'success', failureReason: null })).toMatchObject({ tone: 'success', title: '댓글 게시 완료' });
    expect(rules.toNotice({ ...finished, status: 'failed', failureReason: '로그인이 풀렸어요' })).toMatchObject({
      tone: 'danger', title: '댓글 게시 실패', body: '로그인이 풀렸어요',
    });
    expect(rules.toNotice({ type: 'profile.updated', profileId: 6, name: '개인계정', loginStatus: 'needs_login' })).toMatchObject({
      tone: 'warning', title: '로그인이 풀렸어요', href: '/accounts',
    });
    expect(rules.toNotice({ type: 'profile.updated', profileId: 6, name: '개인계정', loginStatus: 'ok' })).toBeNull();
    expect(rules.toNotice({ type: 'quota.updated', posted: 1, cap: 30, byTopic: {} })).toBeNull();
  });
});
