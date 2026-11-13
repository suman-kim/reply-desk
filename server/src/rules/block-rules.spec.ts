import { DraftState } from '../drafts/draft.entity.js';
import { ProfileLoginStatus } from '../profiles/profile.entity.js';
import { findBlockReason, type PostGuardContext } from './block-rules.js';

/** 모든 규칙을 통과하는 기본 상황 */
function ok(): PostGuardContext {
  return {
    video: { id: 1, isMine: true },
    draft: { state: DraftState.Ready, checkPassed: true },
    alreadyCommented: false,
    postingNow: false,
    total: { posted: 0, cap: 10 },
    topic: { name: '운명원 연애 사주', active: true, posted: 0, cap: 5 },
    profile: { name: '유튜브1', loginStatus: ProfileLoginStatus.Ok },
  };
}

describe('게시 차단 규칙', () => {
  it('모두 지키면 열린다', () => {
    expect(findBlockReason(ok())).toBeNull();
  });

  it('여러 개에 걸리면 계획서 순서대로 먼저 걸린 하나만 보여 준다', () => {
    // 3(이미 댓글), 4(다른 채널), 5(검사 미통과), 6(상한)에 모두 걸린 상황
    const ctx: PostGuardContext = {
      ...ok(),
      alreadyCommented: true,
      video: { id: 1, isMine: false },
      draft: { state: DraftState.Ready, checkPassed: false },
      total: { posted: 10, cap: 10 },
    };
    expect(findBlockReason(ctx)?.code).toBe('already_commented');
  });

  it.each<[string, Partial<PostGuardContext>]>([
    ['no_video', { video: null }],
    ['draft_not_ready', { draft: null }],
    [
      'draft_not_ready',
      { draft: { state: DraftState.Writing, checkPassed: false } },
    ],
    ['already_commented', { alreadyCommented: true }],
    ['not_my_channel', { video: { id: 1, isMine: false } }],
    [
      'check_failed',
      { draft: { state: DraftState.Ready, checkPassed: false } },
    ],
    ['daily_cap', { total: { posted: 10, cap: 10 } }],
    ['daily_cap', { topic: { name: 't', active: true, posted: 5, cap: 5 } }],
    [
      'topic_paused',
      { topic: { name: 't', active: false, posted: 0, cap: 5 } },
    ],
    ['posting_now', { postingNow: true }],
    ['profile_unavailable', { profile: null }],
    [
      'profile_unavailable',
      {
        profile: {
          name: '유튜브2',
          loginStatus: ProfileLoginStatus.NeedsLogin,
        },
      },
    ],
  ])('%s 사유로 막는다', (code, over) => {
    expect(findBlockReason({ ...ok(), ...over })?.code).toBe(code);
  });

  it('상한 문구에 숫자를 넣는다', () => {
    const r = findBlockReason({ ...ok(), total: { posted: 10, cap: 10 } });
    expect(r?.message).toContain('10/10');
  });

  it('로그인이 풀린 프로필은 이름과 할 일을 알려 준다', () => {
    const r = findBlockReason({
      ...ok(),
      profile: { name: '유튜브2', loginStatus: ProfileLoginStatus.NeedsLogin },
    });
    expect(r?.message).toBe(
      '유튜브2 로그인이 필요해요 · [계정 관리]에서 다시 로그인해 주세요',
    );
  });
});
