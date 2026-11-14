import type { DraftListStatus, PostStatus, PostStep, TopicMatch, VideoItem } from '../api/types';
import type { Tone, VideoBadge } from '../ds';

/**
 * 영상의 상태 배지 하나 (영상 목록 행 · 카드). 작업 목록과 같은 이름을 쓴다:
 * 게시 완료(성공) · 초안 작성 중(진행) · 작성 실패(실패) · 검사 미통과(주의) · 게시 대기(중립 점). 초안이 없으면 null
 * @param v 영상
 */
export function videoStatus(v: Pick<VideoItem, 'commented' | 'draftState' | 'checkPassed'>): VideoBadge | null {
  if (v.commented) return { tone: 'success', label: '게시 완료' };
  if (v.draftState === 'writing') return { tone: 'info', label: '초안 작성 중', loading: true };
  if (v.draftState === 'error') return { tone: 'danger', label: '작성 실패' };
  if (v.draftState === 'ready') return v.checkPassed ? { tone: 'neutral', label: '게시 대기', dot: true } : { tone: 'warning', label: '검사 미통과' };
  return null;
}

/**
 * 영상 카드 배지: 상태 하나 + 내 채널
 * @param v 영상
 */
export function videoBadges(v: VideoItem): VideoBadge[] {
  const out: VideoBadge[] = [];
  const status = videoStatus(v);
  if (status) out.push(status);
  if (v.isMine) out.push({ tone: 'accent', label: '내 채널' });
  return out;
}

/** 영상 목록 거르기 (계획안: 초안 없음 · 초안 있음 · 게시 완료 · 매칭 낮음) */
export type VideoFilter = 'all' | 'none' | 'has' | 'done' | 'low';

/**
 * 영상이 거르기에 드는지
 * - 게시 완료: 댓글을 단 영상
 * - 초안 있음: 아직 달지 않았고 초안이 있거나 쓰는 중
 * - 초안 없음: 아직 달지 않았고 초안이 없거나 작성에 실패
 * - 매칭 낮음: 분석한 매칭 %가 기준보다 낮음
 * @param v 영상
 * @param f 거르기
 */
export function inVideoFilter(v: Pick<VideoItem, 'commented' | 'draftState' | 'topicMatch'>, f: VideoFilter): boolean {
  if (f === 'all') return true;
  if (f === 'done') return v.commented;
  if (f === 'has') return !v.commented && (v.draftState === 'ready' || v.draftState === 'writing');
  if (f === 'none') return !v.commented && (v.draftState === 'none' || v.draftState === 'error');
  return !!v.topicMatch && !v.topicMatch.matched;
}

/**
 * 게시 대기인지 (초안이 검사를 통과했고 아직 달지 않음): 작업 상세의 '다음 영상' 차례
 * @param v 영상
 */
export function isReadyToPost(v: Pick<VideoItem, 'commented' | 'draftState' | 'checkPassed'>): boolean {
  return !v.commented && v.draftState === 'ready' && v.checkPassed;
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
