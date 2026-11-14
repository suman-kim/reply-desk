import type { DraftListStatus, PostStatus, PostStep, TopicMatch, VideoItem } from '../api/types';
import type { Tone, VideoBadge } from '../ds';

/**
 * ① 영상 카드 배지 (계획서: 초안 작성 중, 초안 준비됨, 내 채널, 댓글 완료)
 * 검사 미통과·작성 실패도 카드에서 바로 보이게 더했다.
 * @param v 영상
 */
export function videoBadges(v: VideoItem): VideoBadge[] {
  const out: VideoBadge[] = [];
  if (v.commented) out.push({ tone: 'success', label: '댓글 완료' });
  else if (v.draftState === 'writing') out.push({ tone: 'info', label: '초안 작성 중', loading: true });
  else if (v.draftState === 'error') out.push({ tone: 'danger', label: '작성 실패' });
  else if (v.draftState === 'ready') {
    out.push(v.checkPassed ? { tone: 'neutral', label: '초안 준비됨', dot: true } : { tone: 'warning', label: '검사 미통과' });
  }
  if (v.isMine) out.push({ tone: 'accent', label: '내 채널' });
  return out;
}

/** 작업 목록 상태 → 배지 색 (색 규칙: 성공 · 주의 · 실패 · 진행 · 중립). 게시 대기는 문제가 아니라 할 일이라 중립 */
export const STATUS_TONE: Record<DraftListStatus, Tone> = {
  pending: 'neutral',
  failed: 'danger',
  check_failed: 'warning',
  posted: 'success',
  writing: 'info',
  error: 'danger',
};

/** 작업 목록 상태 이름 (필터 순서) */
export const STATUS_LABELS: [DraftListStatus, string][] = [
  ['pending', '게시 대기'],
  ['failed', '실패'],
  ['check_failed', '검사 미통과'],
  ['posted', '게시 완료'],
  ['writing', '작성 중'],
  ['error', '작성 실패'],
];

/** 게시 단계 이름 (서버 POST_STEP_LABELS와 같다). 댓글 게시 목록의 '멈춘 단계'에 쓴다 */
export const POST_STEP_LABELS: Record<PostStep, string> = {
  open_profile: '프로필 여는 중',
  find_comment_box: '댓글 창 찾는 중',
  type: '한 글자씩 입력 중',
  submit: '게시',
  verify: '내 댓글 확인',
};

/** 게시 결과 → 배지 색·이름 (댓글 게시 목록, 작업 상세의 이 영상 댓글 게시) */
export const POST_RESULT: Record<PostStatus, { tone: Tone; label: string }> = {
  success: { tone: 'success', label: '성공' },
  failed: { tone: 'danger', label: '실패' },
  running: { tone: 'info', label: '게시 중' },
};

/**
 * 작업 목록 행의 주제 매칭 배지 (기준 이상: 초록 '매칭 82%', 미만: 노랑 '매칭 낮음 32%')
 * @param match 주제와 매칭 (판단 전이면 null → 배지 없음)
 */
export function topicMatchBadge(match: Omit<TopicMatch, 'reason'> | null): { tone: Tone; label: string } | null {
  if (!match) return null;
  return match.matched ? { tone: 'success', label: `매칭 ${match.percent}%` } : { tone: 'warning', label: `매칭 낮음 ${match.percent}%` };
}
