import { DraftState } from './draft.entity.js';

/**
 * 초안 목록의 상태 (계획서 '초안 목록' 표 + 작성 중·작성 실패).
 * DB에 저장하지 않고 게시 기록으로 그때그때 계산한다.
 */
export enum DraftListStatus {
  /** 게시 대기: 검사 통과 → [댓글 게시] */
  Pending = 'pending',
  /** 실패: 게시를 시도했지만 실패 → [다시 게시] */
  Failed = 'failed',
  /** 검사 미통과: 고치면 바로 다시 검사 */
  CheckFailed = 'check_failed',
  /** 게시 완료: 이미 댓글을 단 영상 */
  Posted = 'posted',
  /** AI가 쓰는 중 */
  Writing = 'writing',
  /** AI 작성 실패 */
  Error = 'error',
}

/** 상태 이름 (화면용) */
export const DRAFT_STATUS_LABELS: Record<DraftListStatus, string> = {
  [DraftListStatus.Pending]: '게시 대기',
  [DraftListStatus.Failed]: '실패',
  [DraftListStatus.CheckFailed]: '검사 미통과',
  [DraftListStatus.Posted]: '게시 완료',
  [DraftListStatus.Writing]: '작성 중',
  [DraftListStatus.Error]: '작성 실패',
};

/**
 * 초안 하나의 목록 상태를 정한다. 위에서부터 먼저 맞는 것.
 * @param input.state 작성 상태
 * @param input.checkPassed 자동 검사 통과
 * @param input.commented 이 영상에 게시 성공 기록이 있음 (주제와 상관없이)
 * @param input.lastPostFailed 이 영상의 마지막 게시 시도가 실패
 */
export function draftListStatus(input: {
  state: DraftState;
  checkPassed: boolean;
  commented: boolean;
  lastPostFailed: boolean;
}): DraftListStatus {
  if (input.commented) return DraftListStatus.Posted;
  if (input.state === DraftState.Writing) return DraftListStatus.Writing;
  if (input.state === DraftState.Error) return DraftListStatus.Error;
  if (!input.checkPassed) return DraftListStatus.CheckFailed;
  if (input.lastPostFailed) return DraftListStatus.Failed;
  return DraftListStatus.Pending;
}
