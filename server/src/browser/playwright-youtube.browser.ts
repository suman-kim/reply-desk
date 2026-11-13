import { spawn } from 'node:child_process';
import { Injectable, Logger } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import {
  ProfileInUseError,
  type CommentBoxResult,
  type LoginCheckResult,
  type YoutubeBrowser,
  type YoutubePage,
} from './youtube-browser.js';
import { CHANNEL_ID_PATTERN, SEL } from './youtube-selectors.js';

/**
 * Playwright가 크롬에 기본으로 붙이는 인자 중 빼야 하는 것.
 * - --use-mock-keychain, --password-store=basic: 맥에서 이 둘이 있으면 일반 크롬으로 로그인해 저장한 쿠키를 못 읽어 로그아웃 상태로 보인다
 * - --enable-automation: "자동화 소프트웨어가 제어 중" 띠와 자동화 표시
 */
const IGNORED_DEFAULT_ARGS = [
  '--enable-automation',
  '--use-mock-keychain',
  '--password-store=basic',
];

/** 한 글자 칠 때 쉬는 시간 범위 (밀리초) */
const TYPE_DELAY_MS: [number, number] = [45, 120];

/** 크롬 창 크기 (녹화 화면에서 대시보드 옆에 놓기 좋게) */
const VIEWPORT = { width: 1100, height: 900 };

/**
 * 크롬을 Playwright로 다루는 실제 구현. 이 맥에 설치된 Google Chrome(channel: chrome)을 쓴다.
 */
@Injectable()
export class PlaywrightYoutubeBrowser implements YoutubeBrowser {
  private readonly logger = new Logger(PlaywrightYoutubeBrowser.name);

  async openPage(
    profileDir: string,
    opts: { headless: boolean },
  ): Promise<YoutubePage> {
    const context = await this.launch(profileDir, opts.headless);
    const page = context.pages()[0] ?? (await context.newPage());
    return new PlaywrightYoutubePage(context, page);
  }

  async checkLogin(profileDir: string): Promise<LoginCheckResult> {
    const context = await this.launch(profileDir, true);
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto('https://www.youtube.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const uiLanguage = await page.evaluate(
        () => document.documentElement.lang || null,
      );

      const state = await Promise.race([
        page
          .waitForSelector(SEL.avatar, { timeout: 20_000 })
          .then(() => 'in' as const),
        page
          .waitForSelector(SEL.signIn, { timeout: 20_000 })
          .then(() => 'out' as const),
      ]).catch(() => 'out' as const);
      if (state === 'out')
        return {
          loggedIn: false,
          channelId: null,
          channelTitle: null,
          uiLanguage,
        };

      // 채널 ID는 고급 계정 설정 화면에 나온다
      await page.goto('https://www.youtube.com/account_advanced', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const body = await page
        .locator('body')
        .innerText({ timeout: 15_000 })
        .catch(() => '');
      const channelId = CHANNEL_ID_PATTERN.exec(body)?.[0] ?? null;

      let channelTitle: string | null = null;
      if (channelId) {
        await page.goto(`https://www.youtube.com/channel/${channelId}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        channelTitle =
          (await page
            .locator('meta[property="og:title"]')
            .getAttribute('content', { timeout: 10_000 })
            .catch(() => null)) ??
          (await page.title()).replace(/\s*-\s*YouTube$/, '') ??
          null;
      }
      return { loggedIn: true, channelId, channelTitle, uiLanguage };
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  async openForManualLogin(profileDir: string): Promise<void> {
    const url =
      'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.youtube.com%2F&hl=ko';
    // 자동화 크롬은 구글이 로그인을 막으므로 일반 크롬을 그 프로필 폴더로 연다 (macOS)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'open',
        [
          '-na',
          'Google Chrome',
          '--args',
          `--user-data-dir=${profileDir}`,
          '--no-first-run',
          url,
        ],
        {
          stdio: 'ignore',
        },
      );
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`open 종료 코드 ${code}`)),
      );
    });
  }

  /**
   * 프로필 폴더로 크롬을 띄운다.
   * @param profileDir 크롬 프로필 폴더
   * @param headless 창 없이
   */
  private async launch(
    profileDir: string,
    headless: boolean,
  ): Promise<BrowserContext> {
    try {
      return await chromium.launchPersistentContext(profileDir, {
        channel: 'chrome',
        headless,
        viewport: VIEWPORT,
        locale: 'ko-KR',
        ignoreDefaultArgs: IGNORED_DEFAULT_ARGS,
        args: [
          '--disable-blink-features=AutomationControlled',
          `--window-size=${VIEWPORT.width},${VIEWPORT.height + 120}`,
        ],
        timeout: 30_000,
      });
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      this.logger.warn(`크롬 띄우기 실패: ${message.split('\n')[0]}`);
      if (
        /ProcessSingleton|SingletonLock|already in use|profile.*in use|exited|closed/i.test(
          message,
        )
      ) {
        throw new ProfileInUseError();
      }
      throw err;
    }
  }
}

/** Playwright로 연 YouTube 탭 */
class PlaywrightYoutubePage implements YoutubePage {
  /**
   * @param context 크롬 (닫을 때 함께 닫는다)
   * @param page 탭
   */
  constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  async openVideo(youtubeId: string): Promise<void> {
    await this.page.goto(`https://www.youtube.com/watch?v=${youtubeId}&hl=ko`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await this.muteVideos();
  }

  async findCommentBox(timeoutMs: number): Promise<CommentBoxResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      // 댓글은 아래로 내려야 불러온다. 창 없는 크롬에서는 마우스 휠이 화면을 움직이지 않아 scrollBy를 쓴다
      await this.page
        .evaluate(() => window.scrollBy(0, 700))
        .catch(() => undefined);
      await this.page.waitForTimeout(700);
      // 광고·영상이 늦게 시작될 수 있어 찾는 동안 계속 멈춘다
      await this.muteVideos();

      if (await this.visible(SEL.commentsDisabled)) return 'comments_disabled';
      if (await this.visible(SEL.simplePlaceholder)) {
        await this.page.locator(SEL.simplePlaceholder).first().click();
        const editor = this.page.locator(SEL.editor).first();
        const opened = await editor
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(
            () => true,
            () => false,
          );
        if (opened) {
          await editor.click();
          return 'ok';
        }
        // 눌렀는데 편집 칸 대신 로그인 창이 뜨면 로그인이 풀린 것 (실제 크롬으로 확인함)
        if (
          (await this.visible(SEL.signIn)) &&
          !(await this.visible(SEL.avatar))
        )
          return 'login_required';
      }
    }
    // 댓글 창까지 못 갔더라도 로그아웃 상태면 원인은 로그인이다
    if ((await this.visible(SEL.signIn)) && !(await this.visible(SEL.avatar)))
      return 'login_required';
    return 'timeout';
  }

  /** 영상(광고 포함)을 멈추고 소리를 끈다 */
  private async muteVideos(): Promise<void> {
    await this.page
      .evaluate(() =>
        document.querySelectorAll('video').forEach((v) => {
          v.muted = true;
          v.pause();
        }),
      )
      .catch(() => undefined);
  }

  async typeComment(
    text: string,
    onProgress: (typed: number, total: number) => void,
  ): Promise<void> {
    const chars = [...text];
    for (const [i, ch] of chars.entries()) {
      await this.page.keyboard.type(ch);
      onProgress(i + 1, chars.length);
      const [min, max] = TYPE_DELAY_MS;
      await this.page.waitForTimeout(min + Math.random() * (max - min));
    }
  }

  async submit(): Promise<boolean> {
    const button = this.page.locator(SEL.submit).first();
    if (!(await button.isEnabled({ timeout: 5_000 }).catch(() => false)))
      return false;
    await button.click();
    // 게시되면 입력 칸이 비워지거나 닫힌다
    return this.page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          return !el || !el.textContent || el.textContent.trim() === '';
        },
        SEL.editor,
        { timeout: 10_000 },
      )
      .then(
        () => true,
        () => false,
      );
  }

  async findOwnComment(
    text: string,
    timeoutMs: number,
  ): Promise<{ url: string | null } | null> {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const handle = await this.page
      .waitForFunction(
        ({ textSel, threadSel, linkSel, target }) => {
          for (const el of Array.from(document.querySelectorAll(textSel))) {
            const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (t !== target) continue;
            const thread = el.closest(threadSel);
            const a = thread?.querySelector(
              linkSel,
            ) as HTMLAnchorElement | null;
            return { url: a?.href ?? null };
          }
          return null;
        },
        {
          textSel: SEL.commentText,
          threadSel: SEL.commentThread,
          linkSel: SEL.commentLink,
          target: normalized,
        },
        { timeout: timeoutMs, polling: 500 },
      )
      .catch(() => null);
    return handle
      ? ((await handle.jsonValue()) as { url: string | null })
      : null;
  }

  async screenshot(type: 'jpeg' | 'png'): Promise<Buffer> {
    return this.page.screenshot(
      type === 'jpeg' ? { type, quality: 55 } : { type },
    );
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
  }

  /** 요소가 화면에 보이는지 */
  private visible(selector: string): Promise<boolean> {
    return this.page
      .locator(selector)
      .first()
      .isVisible()
      .catch(() => false);
  }
}
