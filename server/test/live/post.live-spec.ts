import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlaywrightYoutubeBrowser } from '../../src/browser/playwright-youtube.browser.js';
import {
  DEFAULT_POST_STEPS,
  POST_STEP_LABELS,
  runPostSteps,
  type PostContext,
} from '../../src/publish/post-steps.js';

/**
 * 실제 YouTube에 게시하는 시험 (사람이 손으로만 돌린다. npm test·test:e2e에는 들어가지 않는다).
 * 게시 5단계를 실제 로그인 크롬과 실제 영상으로 돌려, 화면 요소 규칙(youtube-selectors.ts)이
 * 지금 YouTube 화면과 맞는지 확인한다. YouTube 화면이 바뀌어 게시가 실패하기 시작하면 먼저 이것을 돌린다.
 *
 * 돌리는 법 (server 폴더에서):
 *   입력까지만 (게시 안 함, 기본):
 *     LIVE_PROFILE_DIR=<프로필 폴더> LIVE_VIDEO_ID=<영상 ID> npm run test:live
 *   실제로 게시하고 내 댓글까지 찾기 (댓글이 실제로 달린다. 내 채널 영상에만 쓴다):
 *     LIVE_PROFILE_DIR=... LIVE_VIDEO_ID=... LIVE_SUBMIT=1 LIVE_TEXT='시험 댓글' npm run test:live
 *   이미 단 댓글을 찾기만 (게시 안 함): 내 댓글 찾기·가운데로 내리기·게시 결과 캡처를 확인한다
 *     LIVE_PROFILE_DIR=... LIVE_VIDEO_ID=... LIVE_FIND_TEXT='이미 단 댓글 전문' npm run test:live
 *
 * 환경 변수
 * - LIVE_PROFILE_DIR: 로그인된 크롬 프로필 폴더 (계정 관리의 폴더 경로)
 * - LIVE_VIDEO_ID: 유튜브 영상 ID (watch?v= 뒤의 11자)
 * - LIVE_SUBMIT: 1이면 [댓글]을 눌러 실제로 게시하고 내 댓글을 찾는다. 없으면 입력까지만 하고 탭을 닫는다
 * - LIVE_TEXT: 달 댓글. 없으면 시각을 붙인 시험 문구 (내 댓글을 정확히 찾도록 매번 다르게)
 * - LIVE_FIND_TEXT: 이미 단 댓글 전문. 있으면 입력·게시 없이 댓글 창까지 내려가 이 댓글을 찾고 캡처만 한다
 * - LIVE_HEADLESS: 1이면 크롬을 새로 띄울 때 창 없이 (열린 크롬에 붙을 때는 그 창에서 한다)
 * - LIVE_OUT_DIR: 마지막 화면 캡처를 둘 폴더 (기본: 임시 폴더/reply-desk-live)
 */

/** 로그인된 크롬 프로필 폴더 */
const profileDir = process.env.LIVE_PROFILE_DIR ?? '';
/** 유튜브 영상 ID */
const youtubeId = process.env.LIVE_VIDEO_ID ?? '';
/** 실제로 게시할지 */
const submit = process.env.LIVE_SUBMIT === '1';
/** 이미 단 댓글을 찾기만 할 때 그 전문 */
const findText = process.env.LIVE_FIND_TEXT ?? '';
/** 시험 방식: 찾기만 · 실제 게시 · 입력까지만 */
const mode = findText ? 'find' : submit ? 'submit' : 'dry';
/** 달 댓글 (찾기만이면 찾을 댓글) */
const text =
  findText ||
  process.env.LIVE_TEXT ||
  `reply-desk 게시 시험 ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
/** 크롬을 새로 띄울 때 창 없이 */
const headless = process.env.LIVE_HEADLESS === '1';
/** 캡처 폴더 */
const outDir = process.env.LIVE_OUT_DIR || join(tmpdir(), 'reply-desk-live');

describe.skipIf(!profileDir || !youtubeId)('실제 게시 시험', () => {
  it(
    {
      find: '이미 단 댓글을 찾아 가운데로 내리고 캡처한다 (게시 안 함)',
      submit: '게시 5단계를 끝까지 돌리고 내 댓글 주소를 찾는다',
      dry: '입력까지(1~3단계)만 돌리고 게시하지 않는다',
    }[mode],
    async () => {
      const ctx: PostContext = {
        browser: new PlaywrightYoutubeBrowser(),
        profileDir,
        headless,
        youtubeId,
        text,
        page: null,
        commentUrl: null,
        onTyped: () => undefined,
      };
      // 입력까지만이면 [댓글]·내 댓글 찾기 단계를 빼고, 찾기만이면 입력·[댓글]을 빼고 돌린다
      const [openProfile, findBox, , , verify] = DEFAULT_POST_STEPS;
      const steps = {
        find: [openProfile, findBox, verify],
        submit: DEFAULT_POST_STEPS,
        dry: DEFAULT_POST_STEPS.slice(0, 3),
      }[mode];

      const startedAt = Date.now();
      let outcome: Awaited<ReturnType<typeof runPostSteps>>;
      try {
        outcome = await runPostSteps(
          ctx,
          (step) =>
            console.log(
              `[${((Date.now() - startedAt) / 1000).toFixed(1)}초] ${POST_STEP_LABELS[step]}`,
            ),
          steps,
        );
        // 마지막 화면을 남긴다 (성공·실패 모두 사람이 눈으로 확인)
        const image = await ctx.page?.screenshot('png').catch(() => null);
        if (image) {
          await mkdir(outDir, { recursive: true });
          const file = join(outDir, `${youtubeId}-${mode}-${Date.now()}.png`);
          await writeFile(file, image);
          console.log(`마지막 화면: ${file}`);
        }
      } finally {
        // 띄운 크롬은 닫고, 붙은 크롬은 이 탭만 닫는다 (입력만 한 댓글은 버려진다)
        await ctx.page?.close();
      }

      console.log('결과:', JSON.stringify(outcome));
      expect(outcome).toMatchObject({ ok: true });
      if (mode !== 'dry') {
        // 내 댓글을 찾았고, 댓글 주소(lc=)까지 읽었는지
        expect(ctx.commentUrl).toMatch(/[?&]lc=/);
      }
    },
  );
});
