import { ConflictException, Injectable } from '@nestjs/common';

/**
 * 프로필 잠금. 크롬은 같은 프로필 폴더를 두 번 열 수 없어서,
 * 게시·로그인 확인이 같은 프로필을 동시에 쓰지 않게 막는다. (서버 한 개라 메모리로 충분하다)
 */
@Injectable()
export class ProfileLockService {
  /** 쓰는 중인 프로필 ID → 하는 일 */
  private readonly inUse = new Map<number, string>();

  /**
   * 프로필을 잠그고 일을 한 뒤 푼다.
   * @param profileId 프로필 ID
   * @param what 하는 일 (막을 때 안내에 쓴다. 예: 게시)
   * @param fn 할 일
   */
  async run<T>(
    profileId: number,
    what: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.acquire(profileId, what);
    try {
      return await fn();
    } finally {
      this.release(profileId);
    }
  }

  /**
   * 잠근다. 이미 쓰는 중이면 409.
   * @param profileId 프로필 ID
   * @param what 하는 일
   */
  acquire(profileId: number, what: string): void {
    const current = this.inUse.get(profileId);
    if (current)
      throw new ConflictException(
        `이 프로필은 지금 ${current} 중이에요 · 끝난 뒤 다시 시도해 주세요`,
      );
    this.inUse.set(profileId, what);
  }

  /**
   * 푼다
   * @param profileId 프로필 ID
   */
  release(profileId: number): void {
    this.inUse.delete(profileId);
  }

  /**
   * 쓰는 중인지
   * @param profileId 프로필 ID
   */
  isBusy(profileId: number): boolean {
    return this.inUse.has(profileId);
  }
}
