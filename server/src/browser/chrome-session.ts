import { execFile } from 'node:child_process';
import { readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright-core';
import { ProfileInUseError } from './youtube-browser.js';

const execFileAsync = promisify(execFile);

/**
 * 크롬 한 번 쓰기. 프로필 폴더로 크롬을 새로 띄웠는지, 이미 열려 있는 크롬에 붙었는지에 따라
 * 끝낼 때 할 일이 다르다 (전략 패턴: LaunchedSession / AttachedSession).
 */
export interface ChromeSession {
  /** 일할 탭 */
  readonly page: Page;
  /** 이미 열려 있던 크롬에 붙었는지 (사람이 보고 있는 창이다) */
  readonly attached: boolean;
  /** 끝낸다. 새로 띄운 크롬은 닫고, 붙은 크롬은 내가 연 탭만 닫고 연결을 끊는다 */
  close(): Promise<void>;
}

/** 크롬 띄우기 설정 */
export interface LaunchOptions {
  /** 창 없이 띄울지 (이미 열린 크롬에 붙을 때는 쓰지 않는다) */
  headless: boolean;
  /** 크롬 창 크기 */
  viewport: { width: number; height: number };
  /** Playwright 기본 인자 중 뺄 것 */
  ignoreDefaultArgs: string[];
  /** 더 붙일 인자 */
  args: string[];
}

/**
 * 사람이 로그인하는 일반 크롬에 붙이는 인자 (나중에 이 크롬에 붙을 수 있게).
 * - --remote-debugging-port=0: 크롬이 빈 포트를 골라 프로필 폴더의 DevToolsActivePort 파일에 적는다.
 *   127.0.0.1에서만 열리고, 기본 프로필이 아닌 전용 폴더라 크롬 136+에서도 허용된다.
 * - --disable-blink-features=AutomationControlled: 원격 연결 포트만 켜면 navigator.webdriver가 true가 되어
 *   구글이 로그인을 막을 수 있다. 이 인자로 일반 크롬처럼 false로 둔다 (크롬 157에서 확인함).
 */
export const ATTACHABLE_CHROME_ARGS = [
  '--remote-debugging-port=0',
  '--disable-blink-features=AutomationControlled',
];

/**
 * 프로필 폴더로 크롬을 쓴다.
 * 같은 폴더의 크롬이 이미 열려 있으면 그 크롬에 새 탭으로 붙고, 없으면 새로 띄운다.
 * @param profileDir 크롬 프로필 폴더
 * @param opts 새로 띄울 때 설정
 * @throws ProfileInUseError 열려 있는 크롬에 붙을 수 없을 때 (원격 연결 없이 연 크롬)
 */
export async function openChromeSession(
  profileDir: string,
  opts: LaunchOptions,
): Promise<ChromeSession> {
  const ownerPid = await profileOwnerPid(profileDir);
  if (ownerPid !== null) return attach(profileDir, ownerPid);
  return launch(profileDir, opts);
}

/**
 * 프로필 폴더를 쓰고 있는 크롬의 프로세스 번호.
 * 크롬은 폴더에 SingletonLock 링크(`컴퓨터이름-프로세스번호`)를 두고, 끝나면 지운다.
 * 크롬이 비정상 종료해 링크만 남았으면 그 프로세스가 없으므로 null.
 * @param profileDir 크롬 프로필 폴더
 */
export async function profileOwnerPid(
  profileDir: string,
): Promise<number | null> {
  const target = await readlink(join(profileDir, 'SingletonLock')).catch(
    () => null,
  );
  const pid = Number(target?.split('-').pop());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch (err) {
    // 다른 사용자의 프로세스면 EPERM: 살아 있다
    return (err as NodeJS.ErrnoException).code === 'EPERM' ? pid : null;
  }
}

/**
 * 그 크롬에 붙을 수 있는지 (원격 연결 포트를 켜고 떴는지).
 * 원격 연결 없이 연 크롬(직접 연 크롬, 이 기능 전에 연 창)은 붙을 수 없다.
 * 지난번 실행이 남긴 DevToolsActivePort를 믿지 않도록, 지금 크롬의 실행 인자를 본다.
 * @param pid 크롬 프로세스 번호
 */
export async function isAttachable(pid: number): Promise<boolean> {
  const { stdout: command } = await execFileAsync('ps', [
    '-ww',
    '-o',
    'command=',
    '-p',
    String(pid),
  ]).catch(() => ({ stdout: '' }));
  return command.includes('--remote-debugging-port');
}

/**
 * 크롬을 정상 종료하고 끝날 때까지 기다린다.
 * SIGTERM을 받은 크롬은 ⌘Q처럼 쿠키·설정을 저장하고 끝난다 (로그인은 프로필 폴더에 남는다).
 * 강제 종료(SIGKILL)는 하지 않는다: 프로필 파일이 깨질 수 있다.
 * @param pid 크롬 프로세스 번호
 * @param timeoutMs 기다릴 시간
 * @returns 제한 시간 안에 끝났으면 true
 */
export async function quitChrome(
  pid: number,
  timeoutMs = 15_000,
): Promise<boolean> {
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return !alive();
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!alive()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return !alive();
}

/** 원격 연결은 됐는데 붙지 못했을 때 안내 (원격 연결로 떴지만 응답이 이상한 크롬) */
const ATTACH_FAILED =
  '열려 있는 이 프로필의 크롬에 연결하지 못했어요 · 그 크롬을 ⌘Q로 종료한 뒤 [크롬 열기]를 다시 눌러 주세요';

/**
 * 이미 열려 있는 크롬에 원격 연결로 붙어 일할 탭을 연다.
 * 맥은 창을 모두 닫아도 크롬이 남는데, 창이 하나도 없으면 크롬이 프로필을 내려놓아
 * 원격 연결이 "Browser context management is not supported"로 실패한다.
 * 그래서 탭이 없으면 빈 탭을 먼저 하나 열어(프로필을 다시 올림) 그 탭에서 일한다. 끝나면 그 탭을 닫아 창 없는 상태로 되돌린다.
 * @param profileDir 크롬 프로필 폴더
 * @param pid 그 크롬의 프로세스 번호
 */
async function attach(profileDir: string, pid: number): Promise<ChromeSession> {
  if (!(await isAttachable(pid))) throw new ProfileInUseError();

  const active = await readFile(join(profileDir, 'DevToolsActivePort'), 'utf8')
    .then((text) => {
      const [port, path] = text.split('\n').map((l) => l.trim());
      return port && path ? { port, path } : null;
    })
    .catch(() => null);
  if (!active) throw new ProfileInUseError(ATTACH_FAILED);
  const http = `http://127.0.0.1:${active.port}`;

  try {
    // 탭이 하나도 없으면 빈 탭을 연다 (크롬 111+는 /json/new에 PUT만 받는다)
    const targets = (await (await fetch(`${http}/json/list`)).json()) as {
      type: string;
    }[];
    const opened = targets.some((t) => t.type === 'page')
      ? null
      : ((await (
          await fetch(`${http}/json/new?about:blank`, { method: 'PUT' })
        ).json()) as { id: string });

    const browser = await chromium.connectOverCDP(
      `ws://127.0.0.1:${active.port}${active.path}`,
      { timeout: 10_000 },
    );
    const context = browser.contexts()[0];
    if (!context) {
      await browser.close().catch(() => undefined);
      throw new Error('기본 브라우저 문맥이 없어요');
    }
    // 방금 연 빈 탭이 있으면 그 탭을 쓰고, 아니면 새 탭을 연다
    const page =
      (opened && context.pages().find((p) => p.url() === 'about:blank')) ||
      (await context.newPage());
    return new AttachedSession(browser, page);
  } catch (err) {
    if (err instanceof ProfileInUseError) throw err;
    throw new ProfileInUseError(ATTACH_FAILED, err);
  }
}

/**
 * 프로필 폴더로 크롬을 새로 띄운다.
 * @param profileDir 크롬 프로필 폴더
 * @param opts 띄우기 설정
 */
async function launch(
  profileDir: string,
  opts: LaunchOptions,
): Promise<ChromeSession> {
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless: opts.headless,
      viewport: opts.viewport,
      locale: 'ko-KR',
      ignoreDefaultArgs: opts.ignoreDefaultArgs,
      args: opts.args,
      timeout: 30_000,
    });
  } catch (err) {
    // 확인과 띄우기 사이에 사람이 같은 프로필로 크롬을 열었을 때.
    // 크롬은 이미 열린 크롬에 창을 넘기고 바로 끝나며 "Opening in existing browser session"을 남긴다.
    const message = String((err as Error)?.message ?? err);
    if (
      /ProcessSingleton|SingletonLock|existing browser session|profile.*in use/i.test(
        message,
      )
    ) {
      throw new ProfileInUseError();
    }
    throw err;
  }
  const page = context.pages()[0] ?? (await context.newPage());
  return new LaunchedSession(context, page);
}

/** 새로 띄운 크롬: 끝나면 크롬을 닫는다 */
class LaunchedSession implements ChromeSession {
  readonly attached = false;

  /**
   * @param context 띄운 크롬
   * @param page 일할 탭
   */
  constructor(
    private readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
  }
}

/** 이미 열려 있던 크롬: 끝나면 내가 연 탭만 닫고 연결을 끊는다 (크롬과 사람의 탭은 그대로) */
class AttachedSession implements ChromeSession {
  readonly attached = true;

  /**
   * @param browser 원격 연결
   * @param page 내가 연 탭
   */
  constructor(
    private readonly browser: Browser,
    readonly page: Page,
  ) {}

  async close(): Promise<void> {
    await this.page.close().catch(() => undefined);
    await this.browser.close().catch(() => undefined);
  }
}
