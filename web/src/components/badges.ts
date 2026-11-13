import type { DraftListStatus, VideoItem } from '../api/types';
import type { Tone, VideoBadge } from '../ds/inyeon';

/**
 * ① 영상 카드 배지 (계획서: 초안 작성 중, 초안 준비됨, 내 채널, 댓글 완료)
 * 검사 미통과·작성 실패도 카드에서 바로 보이게 더했다.
 * @param v 영상
 */
export function videoBadges(v: VideoItem): VideoBadge[] {
  const out: VideoBadge[] = [];
  if (v.commented) out.push({ tone: 'success', label: '댓글 완료' });
  else if (v.draftState === 'writing') out.push({ label: '초안 작성 중', loading: true });
  else if (v.draftState === 'error') out.push({ tone: 'danger', label: '작성 실패' });
  else if (v.draftState === 'ready') {
    out.push(v.checkPassed ? { tone: 'accent', label: '초안 준비됨' } : { tone: 'warning', label: '검사 미통과' });
  }
  if (v.isMine) out.push({ tone: 'rose', label: '내 채널' });
  return out;
}

/** 초안 목록 상태 → 배지 색 (프로토타입 Drafts와 같다) */
export const STATUS_TONE: Record<DraftListStatus, Tone> = {
  pending: 'accent',
  failed: 'danger',
  check_failed: 'warning',
  posted: 'success',
  draft_only: 'neutral',
  writing: 'neutral',
  error: 'danger',
};

/** 초안 목록 상태 이름 (필터 순서) */
export const STATUS_LABELS: [DraftListStatus, string][] = [
  ['pending', '게시 대기'],
  ['failed', '실패'],
  ['check_failed', '검사 미통과'],
  ['posted', '게시 완료'],
  ['draft_only', '초안만'],
  ['writing', '작성 중'],
  ['error', '작성 실패'],
];
