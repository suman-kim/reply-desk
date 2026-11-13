import type { DraftState } from '../drafts/draft.entity.js';
import type { PostStatus, PostStep } from '../posting/post-attempt.entity.js';
import type { ProfileLoginStatus } from '../profiles/profile.entity.js';

/**
 * 화면에 실시간으로 보내는 이벤트 종류.
 * type이 SSE의 event 이름이 되어, 화면은 EventSource.addEventListener(type)로 받는다.
 * topicId가 있는 이벤트는 그 주제를 보는 화면에만 간다(없는 이벤트는 모든 화면에).
 */

/** 진행 단계 한 줄 (③ 칸의 체크리스트) */
export interface StepView {
  /** 단계 */
  step: PostStep;
  /** 이름 */
  label: string;
  /** 상태 (done: 끝남, running: 하는 중, failed: 실패, waiting: 기다림) */
  state: 'done' | 'running' | 'failed' | 'waiting';
}

/** 초안 자동 작성 진행률이 바뀜 (① 버튼의 "초안 자동 작성 중 (2/5)") */
export interface DraftProgressEvent {
  type: 'draft.progress';
  /** 주제 ID */
  topicId: number;
  /** 이번 묶음 영상 수 */
  total: number;
  /** 끝난 수 */
  done: number;
  /** 실패한 수 */
  failed: number;
  /** 아직 도는 중인지 */
  running: boolean;
  /** 지금 쓰는 영상 ID */
  currentVideoId: number | null;
  /** 마지막 실패 원인 */
  lastError: string | null;
}

/** 초안 하나의 상태가 바뀜 (① 카드 배지, ② 칸 새로 읽기) */
export interface DraftUpdatedEvent {
  type: 'draft.updated';
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 초안 ID */
  draftId: number;
  /** 작성 상태 */
  state: DraftState;
  /** 자동 검사 통과 */
  checkPassed: boolean;
  /** 작성 실패 원인 */
  errorMessage: string | null;
}

/** 게시 진행이 바뀜 (③ 칸 5단계, "한 글자씩 입력 중 (34/91자)") */
export interface PostProgressEvent {
  type: 'post.progress';
  /** 게시 시도 ID */
  attemptId: number;
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 진행 5단계 */
  steps: StepView[];
  /** 입력 진행 */
  typing: { typed: number; total: number };
}

/** 크롬 미리보기가 새로 찍힘 (화면은 /preview?seq=로 다시 받는다) */
export interface PostPreviewEvent {
  type: 'post.preview';
  /** 게시 시도 ID */
  attemptId: number;
  /** 주제 ID */
  topicId: number;
  /** 몇 번째 미리보기인지 (캐시를 피하는 데 쓴다) */
  seq: number;
}

/** 게시가 끝남 (③ 칸 게시 완료 띠·실패 원인, 게시 기록 새로 읽기) */
export interface PostFinishedEvent {
  type: 'post.finished';
  /** 게시 시도 ID */
  attemptId: number;
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 결과 */
  status: PostStatus;
  /** 진행 5단계 (마지막 상태) */
  steps: StepView[];
  /** 실패 원인 */
  failureReason: string | null;
  /** 실패 캡처가 있는지 */
  hasCapture: boolean;
  /** 댓글 주소 */
  commentUrl: string | null;
}

/** 오늘 게시 수가 바뀜 (헤더 "오늘 게시 n/10") */
export interface QuotaUpdatedEvent {
  type: 'quota.updated';
  /** 오늘 전체 게시 수 */
  posted: number;
  /** 전체 하루 상한 */
  cap: number;
  /** 주제별 오늘 게시 수 */
  byTopic: Record<number, number>;
}

/** 프로필 로그인 상태가 바뀜 (헤더 "유튜브2 로그인 필요", 계정 관리 경고 띠) */
export interface ProfileUpdatedEvent {
  type: 'profile.updated';
  /** 프로필 ID */
  profileId: number;
  /** 프로필 이름 */
  name: string;
  /** 로그인 상태 */
  loginStatus: ProfileLoginStatus;
}

/** 모든 이벤트 */
export type AppEvent =
  | DraftProgressEvent
  | DraftUpdatedEvent
  | PostProgressEvent
  | PostPreviewEvent
  | PostFinishedEvent
  | QuotaUpdatedEvent
  | ProfileUpdatedEvent;

/** 이벤트 이름 목록 (화면이 구독할 이름) */
export const APP_EVENT_TYPES: AppEvent['type'][] = [
  'draft.progress',
  'draft.updated',
  'post.progress',
  'post.preview',
  'post.finished',
  'quota.updated',
  'profile.updated',
];
