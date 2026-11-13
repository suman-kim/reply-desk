import {
  ProfileLoginStatus,
  type Profile,
} from '../profiles/profile.entity.js';

/**
 * 자동 배정: 로그인된 프로필 중 가장 오래전에 게시한 프로필을 고른다(돌아가며 쓰기).
 * 한 번도 게시하지 않은 프로필이 먼저, 같으면 ID 순.
 * @param candidates 주제가 쓸 프로필
 * @param lastPostedAt 프로필 ID → 마지막 게시 성공 시각
 * @returns 이번 차례 프로필, 쓸 수 있는 프로필이 없으면 null
 */
export function pickNextProfile(
  candidates: Profile[],
  lastPostedAt: Map<number, Date>,
): Profile | null {
  const ready = candidates.filter(
    (p) => p.loginStatus === ProfileLoginStatus.Ok,
  );
  ready.sort((a, b) => {
    const ta = lastPostedAt.get(a.id)?.getTime() ?? -Infinity;
    const tb = lastPostedAt.get(b.id)?.getTime() ?? -Infinity;
    return ta - tb || a.id - b.id;
  });
  return ready[0] ?? null;
}
