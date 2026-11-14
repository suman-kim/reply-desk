import { useProfiles, useTopics } from '../api/queries';

/* 메뉴 탭 옆 숫자. 새 메뉴의 숫자도 여기에 더하고 menu.tsx 항목의 Count로 연결한다 */

/** 탭 옆 숫자 모양 */
function CountBubble({ n, warn, title }: { n: number; warn?: boolean; title: string }) {
  if (n <= 0) return null;
  return (
    <span className={`rd-tab-count${warn ? ' is-warn' : ''}`} title={title} aria-label={title}>
      {n}
    </span>
  );
}

/** 작업 목록 탭 숫자: 게시 대기 초안 */
export function PendingDraftsCount() {
  const topics = useTopics();
  const n = topics.data?.reduce((sum, t) => sum + t.pendingDrafts, 0) ?? 0;
  return <CountBubble n={n} title={`게시 대기 초안 ${n}개`} />;
}

/** 계정 관리 탭 숫자: 로그인이 필요한 계정 */
export function NeedLoginCount() {
  const profiles = useProfiles();
  const n = profiles.data?.filter((p) => p.loginStatus === 'needs_login').length ?? 0;
  return <CountBubble n={n} warn title={`로그인이 필요한 계정 ${n}개`} />;
}

