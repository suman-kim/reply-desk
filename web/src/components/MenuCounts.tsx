import { useProfiles } from '../api/queries';
import type { Topic } from '../api/types';

/* 메뉴 옆 숫자. 새 메뉴의 숫자도 여기에 더하고 menu.tsx 항목의 Count로 연결한다 */

/**
 * 메뉴 옆 숫자 모양
 * @param props.n 숫자 (0 이하면 숨긴다)
 * @param props.warn 주의 색(노랑)으로 보일지
 * @param props.title 숫자의 뜻 (마우스를 올리면 보이고, 읽기 프로그램이 읽는다)
 */
export function CountBubble({ n, warn, title }: { n: number; warn?: boolean; title: string }) {
  if (n <= 0) return null;
  return (
    <span className={`rd-tab-count${warn ? ' is-warn' : ''}`} title={title} aria-label={title}>
      {n}
    </span>
  );
}

/**
 * 작업 목록 메뉴·[작업] 버튼 숫자: 고른 주제의 게시 대기 초안
 * @param props.topic 주제
 */
export function TopicPendingCount({ topic }: { topic: Topic }) {
  return <CountBubble n={topic.pendingDrafts} title={`게시 대기 초안 ${topic.pendingDrafts}개`} />;
}

/** 계정 관리 메뉴 숫자: 로그인이 필요한 계정 */
export function NeedLoginCount() {
  const profiles = useProfiles();
  const n = profiles.data?.filter((p) => p.loginStatus === 'needs_login').length ?? 0;
  return <CountBubble n={n} warn title={`로그인이 필요한 계정 ${n}개`} />;
}
