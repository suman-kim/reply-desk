import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isAttachable,
  openChromeSession,
  profileOwnerPid,
  quitChrome,
} from './chrome-session.js';
import { ProfileInUseError } from './youtube-browser.js';

/** 크롬 없이 확인할 수 있는 부분: 프로필 폴더를 누가 쓰는지, 붙을 수 없는 크롬이면 막는지 */
describe('chrome-session', () => {
  /** 테스트용 빈 프로필 폴더 */
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rd-chrome-session-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /**
   * 크롬처럼 SingletonLock 링크를 만든다
   * @param pid 링크에 적을 프로세스 번호
   */
  const lockBy = (pid: number) =>
    symlink(`my-mac.local-${pid}`, join(dir, 'SingletonLock'));

  it('잠금 링크가 없으면 아무도 안 쓴다', async () => {
    expect(await profileOwnerPid(dir)).toBeNull();
  });

  it('살아 있는 프로세스가 잠갔으면 그 번호', async () => {
    await lockBy(process.pid);
    expect(await profileOwnerPid(dir)).toBe(process.pid);
  });

  it('크롬이 비정상 종료해 링크만 남았으면 아무도 안 쓴다', async () => {
    await lockBy(2 ** 22 - 1);
    expect(await profileOwnerPid(dir)).toBeNull();
  });

  it('원격 연결 없이 연 크롬이 쓰고 있으면 붙지 않고 ProfileInUseError', async () => {
    // 이 테스트 프로세스(node)는 --remote-debugging-port 없이 떴다
    await lockBy(process.pid);
    await expect(
      openChromeSession(dir, {
        headless: true,
        viewport: { width: 800, height: 600 },
        ignoreDefaultArgs: [],
        args: [],
      }),
    ).rejects.toBeInstanceOf(ProfileInUseError);
  });
});

/** 크롬 대신 node 프로세스로 실행 인자 확인·정상 종료를 본다 */
describe('chrome-session 프로세스', () => {
  /**
   * 오래 도는 node 프로세스를 띄운다
   * @param extra 실행 인자 뒤에 붙일 것 (ps에 보인다)
   */
  const run = (extra: string[]) =>
    spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)', '--', ...extra],
      { stdio: 'ignore' },
    );

  it('원격 연결 인자로 뜬 프로세스만 붙을 수 있다', async () => {
    const plain = run([]);
    const debug = run(['--remote-debugging-port=0']);
    try {
      expect(await isAttachable(plain.pid!)).toBe(false);
      expect(await isAttachable(debug.pid!)).toBe(true);
    } finally {
      plain.kill('SIGKILL');
      debug.kill('SIGKILL');
    }
  });

  it('정상 종료(SIGTERM)하고 끝날 때까지 기다린다', async () => {
    const child = run([]);
    const exited = new Promise((r) => child.once('exit', r));
    expect(await quitChrome(child.pid!, 5_000)).toBe(true);
    await exited;
  });

  it('이미 끝난 프로세스면 바로 true', async () => {
    const child = run([]);
    child.kill('SIGKILL');
    await new Promise((r) => child.once('exit', r));
    expect(await quitChrome(child.pid!, 1_000)).toBe(true);
  });
});
