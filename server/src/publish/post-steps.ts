import {
  ProfileInUseError,
  type YoutubeBrowser,
  type YoutubePage,
} from '../browser/youtube-browser.js';
import { PostStep } from '../posting/post-attempt.entity.js';

/** 단계 이름 (③ 칸의 진행 5단계) */
export const POST_STEP_LABELS: Record<PostStep, string> = {
  [PostStep.OpenProfile]: '프로필 여는 중',
  [PostStep.FindCommentBox]: '댓글 창 찾는 중',
  [PostStep.Type]: '한 글자씩 입력 중',
  [PostStep.Submit]: '게시',
  [PostStep.Verify]: '내 댓글 확인',
};

/** 단계 순서 */
export const POST_STEP_ORDER: PostStep[] = [
  PostStep.OpenProfile,
  PostStep.FindCommentBox,
  PostStep.Type,
  PostStep.Submit,
  PostStep.Verify,
];

/** 댓글 창을 기다리는 시간 */
export const COMMENT_BOX_TIMEOUT_MS = 20_000;
/** 게시 뒤 내 댓글을 기다리는 시간 */
export const VERIFY_TIMEOUT_MS = 20_000;

/** 단계 실패. reason은 게시 기록에 남길 한 줄(원인 · 할 일) */
export class StepFailure extends Error {
  /**
   * @param reason 원인 한 줄
   * @param loginLost 로그인이 풀린 것이 원인인지 (프로필을 '다시 로그인 필요'로 바꾼다)
   */
  constructor(
    readonly reason: string,
    readonly loginLost = false,
  ) {
    super(reason);
  }
}

/** 단계들이 함께 쓰는 값 */
export interface PostContext {
  /** 크롬 조작 */
  browser: YoutubeBrowser;
  /** 크롬 프로필 폴더 */
  profileDir: string;
  /** 창 없이 띄울지 */
  headless: boolean;
  /** 유튜브 영상 ID */
  youtubeId: string;
  /** 달 댓글 */
  text: string;
  /** 열린 탭 (1단계에서 채운다) */
  page: YoutubePage | null;
  /** 입력 진행 (친 글자 수, 전체) */
  onTyped: (typed: number, total: number) => void;
  /** 찾은 내 댓글 주소 (5단계에서 채운다) */
  commentUrl: string | null;
}

/** 단계 하나 (템플릿: 순서대로 run을 부르고, 실패하면 StepFailure를 던진다) */
export interface PostStepHandler {
  /** 단계 */
  readonly step: PostStep;
  /**
   * 단계를 실행한다
   * @param ctx 함께 쓰는 값
   */
  run(ctx: PostContext): Promise<void>;
}

/** 열린 탭 (1단계 뒤에는 늘 있다) */
function pageOf(ctx: PostContext): YoutubePage {
  if (!ctx.page) throw new StepFailure('크롬 탭이 없어요 · 다시 시도해 주세요');
  return ctx.page;
}

/** 1. 프로필 여는 중 */
const openProfile: PostStepHandler = {
  step: PostStep.OpenProfile,
  async run(ctx) {
    try {
      ctx.page = await ctx.browser.openPage(ctx.profileDir, {
        headless: ctx.headless,
      });
    } catch (err) {
      if (err instanceof ProfileInUseError) throw new StepFailure(err.message);
      throw new StepFailure(
        '크롬을 열지 못했어요 · Google Chrome이 설치되어 있는지 확인해 주세요',
      );
    }
  },
};

/** 2. 댓글 창 찾는 중 */
const findCommentBox: PostStepHandler = {
  step: PostStep.FindCommentBox,
  async run(ctx) {
    const page = pageOf(ctx);
    await page.openVideo(ctx.youtubeId);
    const found = await page.findCommentBox(COMMENT_BOX_TIMEOUT_MS);
    if (found === 'login_required') {
      throw new StepFailure(
        '로그인이 풀렸어요 · [계정 관리]에서 다시 로그인해 주세요',
        true,
      );
    }
    if (found === 'comments_disabled')
      throw new StepFailure('댓글이 막힌 영상이에요 · 다른 영상을 골라 주세요');
    if (found === 'timeout') {
      throw new StepFailure(
        `댓글 창이 ${COMMENT_BOX_TIMEOUT_MS / 1000}초 안에 뜨지 않았어요 · 캡처를 확인하세요`,
      );
    }
  },
};

/** 3. 한 글자씩 입력 중 */
const typeComment: PostStepHandler = {
  step: PostStep.Type,
  async run(ctx) {
    await pageOf(ctx).typeComment(ctx.text, ctx.onTyped);
  },
};

/** 4. 게시 */
const submit: PostStepHandler = {
  step: PostStep.Submit,
  async run(ctx) {
    if (!(await pageOf(ctx).submit())) {
      throw new StepFailure('게시 버튼이 눌리지 않았어요 · 캡처를 확인하세요');
    }
  },
};

/** 5. 내 댓글 확인 */
const verify: PostStepHandler = {
  step: PostStep.Verify,
  async run(ctx) {
    const found = await pageOf(ctx).findOwnComment(ctx.text, VERIFY_TIMEOUT_MS);
    if (!found) {
      throw new StepFailure(
        '게시 후 내 댓글이 보이지 않아요 · 유튜브가 숨겼을 수 있어요(캡처를 확인하세요)',
      );
    }
    ctx.commentUrl = found.url;
  },
};

/** 기본 단계 목록 (화면의 5단계 순서) */
export const DEFAULT_POST_STEPS: PostStepHandler[] = [
  openProfile,
  findCommentBox,
  typeComment,
  submit,
  verify,
];

/** 게시 결과 */
export type PostOutcome =
  | { ok: true; commentUrl: string | null }
  | { ok: false; step: PostStep; reason: string; loginLost: boolean };

/**
 * 단계를 차례로 돌린다. 크롬은 닫지 않는다(실패 캡처를 찍은 뒤 부르는 쪽이 닫는다).
 * @param ctx 함께 쓰는 값
 * @param onStep 단계가 시작될 때
 * @param steps 단계 목록 (테스트에서 바꿔 넣는다)
 */
export async function runPostSteps(
  ctx: PostContext,
  onStep: (step: PostStep) => void,
  steps: PostStepHandler[] = DEFAULT_POST_STEPS,
): Promise<PostOutcome> {
  for (const handler of steps) {
    onStep(handler.step);
    try {
      await handler.run(ctx);
    } catch (err) {
      if (err instanceof StepFailure) {
        return {
          ok: false,
          step: handler.step,
          reason: err.reason,
          loginLost: err.loginLost,
        };
      }
      const detail = String((err as Error)?.message ?? err)
        .split('\n')[0]
        .slice(0, 80);
      return {
        ok: false,
        step: handler.step,
        reason: `${POST_STEP_LABELS[handler.step]} 단계에서 멈췄어요 (${detail}) · 캡처를 확인하세요`,
        loginLost: false,
      };
    }
  }
  return { ok: true, commentUrl: ctx.commentUrl };
}
