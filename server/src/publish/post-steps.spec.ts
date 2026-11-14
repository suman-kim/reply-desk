import {
  ProfileInUseError,
  type CommentBoxResult,
  type YoutubeBrowser,
  type YoutubePage,
} from '../browser/youtube-browser.js';
import { PostStep } from '../posting/post-attempt.entity.js';
import { runPostSteps, type PostContext } from './post-steps.js';

/** 가짜 탭: 단계별 결과를 정해 둔다 */
function fakePage(
  opts: {
    box?: CommentBoxResult;
    submit?: boolean;
    found?: boolean;
    typeError?: boolean;
  } = {},
) {
  const typed: number[] = [];
  const page: YoutubePage = {
    openVideo: vi.fn(async () => undefined),
    findCommentBox: vi.fn(async () => opts.box ?? 'ok'),
    typeComment: vi.fn(
      async (text: string, onProgress: (t: number, total: number) => void) => {
        if (opts.typeError) throw new Error('키보드가 멈춤\n자세한 내용');
        const n = [...text].length;
        for (let i = 1; i <= n; i++) {
          typed.push(i);
          onProgress(i, n);
        }
      },
    ),
    submit: vi.fn(async () => opts.submit ?? true),
    findOwnComment: vi.fn(async () =>
      opts.found === false
        ? null
        : { url: 'https://www.youtube.com/watch?v=x&lc=abc' },
    ),
    screenshot: vi.fn(async () => Buffer.from('')),
    close: vi.fn(async () => undefined),
  };
  return { page, typed };
}

/** 단계 값 */
function ctx(browser: Partial<YoutubeBrowser>): PostContext {
  return {
    browser: browser as YoutubeBrowser,
    profileDir: '/tmp/p',
    headless: true,
    youtubeId: 'demo00000v2',
    text: '댓글입니다',
    page: null,
    commentUrl: null,
    onTyped: () => undefined,
  };
}

describe('게시 5단계', () => {
  it('모두 통과하면 댓글 주소를 돌려주고, 단계를 차례로 알린다', async () => {
    const { page, typed } = fakePage();
    const steps: PostStep[] = [];
    const out = await runPostSteps(ctx({ openPage: async () => page }), (s) =>
      steps.push(s),
    );
    expect(out).toEqual({
      ok: true,
      commentUrl: 'https://www.youtube.com/watch?v=x&lc=abc',
    });
    expect(steps).toEqual([
      'open_profile',
      'find_comment_box',
      'type',
      'submit',
      'verify',
    ]);
    expect(typed).toEqual([1, 2, 3, 4, 5]);
  });

  it('같은 프로필의 크롬이 열려 있으면 1단계에서 멈춘다', async () => {
    const out = await runPostSteps(
      ctx({
        openPage: async () => {
          throw new ProfileInUseError();
        },
      }),
      () => undefined,
    );
    expect(out).toMatchObject({
      ok: false,
      step: 'open_profile',
      reason: expect.stringContaining('[크롬 열기]'),
    });
  });

  it.each<[CommentBoxResult, string, boolean]>([
    ['login_required', '로그인이 풀렸어요', true],
    ['comments_disabled', '댓글이 막힌 영상', false],
    ['timeout', '20초 안에 뜨지 않았어요', false],
  ])('댓글 창 찾기 실패: %s', async (box, reason, loginLost) => {
    const { page } = fakePage({ box });
    const out = await runPostSteps(
      ctx({ openPage: async () => page }),
      () => undefined,
    );
    expect(out).toMatchObject({
      ok: false,
      step: 'find_comment_box',
      loginLost,
    });
    expect(out.ok === false && out.reason).toContain(reason);
  });

  it('게시 버튼이 안 눌리거나 내 댓글이 안 보이면 그 단계에서 멈춘다', async () => {
    const a = await runPostSteps(
      ctx({ openPage: async () => fakePage({ submit: false }).page }),
      () => undefined,
    );
    expect(a).toMatchObject({ ok: false, step: 'submit' });
    const b = await runPostSteps(
      ctx({ openPage: async () => fakePage({ found: false }).page }),
      () => undefined,
    );
    expect(b).toMatchObject({
      ok: false,
      step: 'verify',
      reason: expect.stringContaining('보이지 않아요'),
    });
  });

  it('예상하지 못한 오류는 단계 이름과 첫 줄만 남긴다', async () => {
    const out = await runPostSteps(
      ctx({ openPage: async () => fakePage({ typeError: true }).page }),
      () => undefined,
    );
    expect(out).toMatchObject({
      ok: false,
      step: 'type',
      reason:
        '한 글자씩 입력 중 단계에서 멈췄어요 (키보드가 멈춤) · 캡처를 확인하세요',
    });
  });
});
