import { DraftState } from './draft.entity.js';
import { DraftListStatus, draftListStatus, isPosted } from './draft-status.js';

/** 게시 대기인 기본 상황 */
const base = {
  state: DraftState.Ready,
  checkPassed: true,
  posted: false,
  lastPostFailed: false,
};

describe('draftListStatus', () => {
  it.each<[DraftListStatus, Partial<typeof base>]>([
    [DraftListStatus.Pending, {}],
    [DraftListStatus.Posted, { posted: true, checkPassed: false }],
    [DraftListStatus.Writing, { state: DraftState.Writing }],
    [DraftListStatus.Error, { state: DraftState.Error }],
    [DraftListStatus.CheckFailed, { checkPassed: false }],
    [DraftListStatus.Failed, { lastPostFailed: true }],
  ])('%s', (status, over) => {
    expect(draftListStatus({ ...base, ...over })).toBe(status);
  });
});

describe('isPosted (RD-27)', () => {
  it('기본(설정 꺼짐)은 영상 단위: 이 영상에 댓글을 달았으면 새 초안도 게시 완료', () => {
    expect(
      isPosted({
        morePerVideo: false,
        videoCommented: true,
        draftPosted: false,
      }),
    ).toBe(true);
    expect(
      isPosted({
        morePerVideo: false,
        videoCommented: false,
        draftPosted: false,
      }),
    ).toBe(false);
  });

  it('설정을 켜면 초안 단위: 예전 초안으로 단 댓글이 있어도 새 초안은 게시 전', () => {
    expect(
      isPosted({
        morePerVideo: true,
        videoCommented: true,
        draftPosted: false,
      }),
    ).toBe(false);
    expect(
      isPosted({ morePerVideo: true, videoCommented: true, draftPosted: true }),
    ).toBe(true);
  });
});
