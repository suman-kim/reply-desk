import {
  ProfileLoginStatus,
  type Profile,
} from '../profiles/profile.entity.js';
import { slugFromName } from '../profiles/profile.schemas.js';
import { pickNextProfile } from './profile-assigner.js';

/** 테스트용 프로필 */
const p = (id: number, loginStatus = ProfileLoginStatus.Ok) =>
  ({ id, name: `유튜브${id}`, loginStatus }) as Profile;

describe('자동 배정', () => {
  it('한 번도 안 쓴 프로필을 먼저 고른다', () => {
    const last = new Map([[1, new Date('2026-11-13T01:00:00Z')]]);
    expect(pickNextProfile([p(1), p(2), p(3)], last)?.id).toBe(2);
  });

  it('모두 썼으면 가장 오래전에 쓴 프로필을 고른다', () => {
    const last = new Map([
      [1, new Date('2026-11-13T03:00:00Z')],
      [2, new Date('2026-11-13T01:00:00Z')],
      [3, new Date('2026-11-13T02:00:00Z')],
    ]);
    expect(pickNextProfile([p(1), p(2), p(3)], last)?.id).toBe(2);
  });

  it('로그인이 풀렸거나 확인 전인 프로필은 빼고, 없으면 null', () => {
    expect(
      pickNextProfile([p(1, ProfileLoginStatus.NeedsLogin), p(2)], new Map())
        ?.id,
    ).toBe(2);
    expect(
      pickNextProfile([p(1, ProfileLoginStatus.Unknown)], new Map()),
    ).toBeNull();
  });
});

describe('slugFromName', () => {
  it.each([
    ['유튜브4', 'youtube4'],
    ['Main Account', 'main-account'],
    ['메인 계정', 'profile-7'],
    ['4번', 'profile-7'],
  ])('%s → %s', (name, slug) => {
    expect(slugFromName(name, 7)).toBe(slug);
  });
});
