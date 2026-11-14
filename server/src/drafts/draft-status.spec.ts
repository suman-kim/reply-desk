import { DraftState } from './draft.entity.js';
import { DraftListStatus, draftListStatus } from './draft-status.js';

/** 게시 대기인 기본 상황 */
const base = {
  state: DraftState.Ready,
  checkPassed: true,
  commented: false,
  lastPostFailed: false,
};

describe('draftListStatus', () => {
  it.each<[DraftListStatus, Partial<typeof base>]>([
    [DraftListStatus.Pending, {}],
    [DraftListStatus.Posted, { commented: true, checkPassed: false }],
    [DraftListStatus.Writing, { state: DraftState.Writing }],
    [DraftListStatus.Error, { state: DraftState.Error }],
    [DraftListStatus.CheckFailed, { checkPassed: false }],
    [DraftListStatus.Failed, { lastPostFailed: true }],
  ])('%s', (status, over) => {
    expect(draftListStatus({ ...base, ...over })).toBe(status);
  });
});
