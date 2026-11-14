import { startsWithDisclosure } from '../checks/ad-disclosure.js';
import { DraftState } from '../drafts/draft.entity.js';
import { ProfileLoginStatus } from '../profiles/profile.entity.js';

/**
 * [댓글 달기] 버튼을 열지 판단하는 데 필요한 값.
 * DB에서 모으는 일은 PostGuardService가 하고, 판단은 여기 규칙들이 한다(판단만 따로 두어 테스트하기 쉽게).
 */
export interface PostGuardContext {
  /** 고른 영상. 고르지 않았으면 null */
  video: { id: number; isMine: boolean } | null;
  /** 그 영상의 최근 초안. 없으면 null (text: 게시될 댓글) */
  draft: { state: DraftState; checkPassed: boolean; text: string } | null;
  /** 이미 댓글을 단 영상인지 (주제와 상관없이 전체) */
  alreadyCommented: boolean;
  /** 이 영상을 지금 게시하는 중인지 */
  postingNow: boolean;
  /** 오늘 전체 게시 수와 상한 */
  total: { posted: number; cap: number };
  /** 오늘 이 주제 게시 수와 상한, 다른 채널 영상에 붙이는 광고 표시 */
  topic: {
    name: string;
    active: boolean;
    posted: number;
    cap: number;
    adDisclosure: string;
  };
  /** 게시할 프로필. 자동 배정할 프로필이 없으면 null */
  profile: { name: string; loginStatus: ProfileLoginStatus } | null;
}

/** 차단 사유 */
export interface BlockReason {
  /** 사유 코드 (화면에서 강조 위치를 정할 때 쓴다) */
  code: string;
  /** 버튼 아래에 보일 한 줄. 원인 다음에 할 일을 쓴다 */
  message: string;
}

/** 차단 규칙 하나 (책임 연쇄의 한 고리) */
export interface BlockRule {
  /** 사유 코드 */
  readonly code: string;
  /**
   * 막아야 하면 문구를, 통과면 null을 돌려준다.
   * @param ctx 판단에 필요한 값
   */
  evaluate(ctx: PostGuardContext): string | null;
}

/** 규칙을 짧게 만드는 도우미 */
const rule = (code: string, evaluate: BlockRule['evaluate']): BlockRule => ({
  code,
  evaluate,
});

/**
 * 차단 규칙 순서. 계획서의 1~6번 순서를 지키고, 그 뒤에 서버가 추가로 보는 것을 둔다.
 * 화면에는 먼저 걸린 사유 하나만 보인다.
 */
export const BLOCK_RULES: BlockRule[] = [
  // 1. 영상을 고르지 않음
  rule('no_video', (c) => (c.video ? null : '영상을 먼저 골라 주세요')),
  // 2. 초안이 아직 준비되지 않음
  rule('draft_not_ready', (c) => {
    if (!c.draft)
      return '초안이 아직 없어요 · [다시 생성]으로 초안을 만들어 주세요';
    if (c.draft.state === DraftState.Writing)
      return '초안을 쓰는 중이에요 · 잠시만 기다려 주세요';
    if (c.draft.state === DraftState.Error)
      return '초안 작성에 실패했어요 · [다시 생성]을 눌러 주세요';
    return null;
  }),
  // 3. 이미 댓글을 단 영상 (영상당 1개)
  rule('already_commented', (c) =>
    c.alreadyCommented
      ? '이미 댓글을 단 영상이에요 · 영상당 1개만 달 수 있어요'
      : null,
  ),
  // 4. 다른 채널 영상인데 맨 앞에 광고 표시가 없음.
  //    자동 검사도 보지만, 검사 뒤에 프로필이 지워져 '내 채널'이 바뀐 경우까지 게시 직전에 다시 본다
  rule('ad_disclosure_missing', (c) =>
    c.video &&
    !c.video.isMine &&
    c.draft &&
    !startsWithDisclosure(c.draft.text, c.topic.adDisclosure.trim())
      ? `다른 채널 영상에는 맨 앞에 광고 표시("${c.topic.adDisclosure.trim()}")가 있어야 게시돼요 · 초안 맨 앞에 넣어 주세요`
      : null,
  ),
  // 5. 자동 검사 미통과
  rule('check_failed', (c) =>
    c.draft && !c.draft.checkPassed
      ? '자동 검사를 통과하지 못했어요 · 초안을 고치면 바로 다시 검사해요'
      : null,
  ),
  // 6. 하루 게시 상한 도달 (전체 → 주제 순)
  rule('daily_cap', (c) => {
    if (c.total.posted >= c.total.cap) {
      return `오늘 게시 상한(${c.total.posted}/${c.total.cap})에 닿았어요 · 내일 다시 할 수 있어요`;
    }
    if (c.topic.posted >= c.topic.cap) {
      return `이 주제의 오늘 상한(${c.topic.posted}/${c.topic.cap})에 닿았어요 · 내일 다시 할 수 있어요`;
    }
    return null;
  }),
  // 7. 주제 일시정지
  rule('topic_paused', (c) =>
    c.topic.active
      ? null
      : '일시정지한 주제예요 · 주제를 다시 진행하면 게시할 수 있어요',
  ),
  // 8. 같은 영상을 지금 게시 중
  rule('posting_now', (c) =>
    c.postingNow ? '이 영상은 지금 게시하는 중이에요' : null,
  ),
  // 9. 게시할 프로필이 없거나 로그인이 풀림
  rule('profile_unavailable', (c) => {
    if (!c.profile)
      return '게시할 프로필이 없어요 · 주제 설정에서 로그인된 프로필을 골라 주세요';
    if (c.profile.loginStatus === ProfileLoginStatus.NeedsLogin) {
      return `${c.profile.name} 로그인이 필요해요 · [계정 관리]에서 다시 로그인해 주세요`;
    }
    if (c.profile.loginStatus === ProfileLoginStatus.Unknown) {
      return `${c.profile.name}은(는) 아직 로그인 확인 전이에요 · [계정 관리]에서 확인해 주세요`;
    }
    return null;
  }),
];

/**
 * 규칙을 차례로 보고 처음 걸린 사유 하나를 돌려준다. 모두 통과하면 null.
 * @param ctx 판단에 필요한 값
 * @param rules 규칙 목록 (기본: BLOCK_RULES)
 */
export function findBlockReason(
  ctx: PostGuardContext,
  rules: BlockRule[] = BLOCK_RULES,
): BlockReason | null {
  for (const r of rules) {
    const message = r.evaluate(ctx);
    if (message) return { code: r.code, message };
  }
  return null;
}
