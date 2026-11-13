import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openChromeSession, profileOwnerPid } from './chrome-session.js';
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
