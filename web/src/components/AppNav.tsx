import { Link, useLocation } from 'react-router';
import { useProfiles, useToday } from '../api/queries';
import { Badge, StatPill } from '../ds/inyeon';
import type { LiveStatus } from '../live/useLiveEvents';
import { MENU, menuOf } from '../menu';

/**
 * 모든 화면 위의 메뉴: 앱 이름 · 메뉴 탭(menu.tsx 목록) · 오늘 전체 게시 n/10 · 로그인 필요 알림
 * @param props.live 실시간 연결 상태
 */
export function AppNav({ live }: { live: LiveStatus }) {
  const { pathname } = useLocation();
  const current = menuOf(pathname);
  const profiles = useProfiles();
  const today = useToday();
  const needLogin = profiles.data?.filter((p) => p.loginStatus === 'needs_login') ?? [];

  return (
    <nav className="rd-nav" aria-label="메뉴">
      <div className="rd-nav-inner">
        <Link to="/" className="rd-nav-brand text-body-strong">
          유튜브 댓글 에이전트
        </Link>
        <div className="rd-tabs">
          {MENU.map((m) => {
            const on = m === current;
            return (
              <Link key={m.path} to={m.path} className={`rd-tab${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined}>
                {m.label}
                {m.Count ? <m.Count /> : null}
              </Link>
            );
          })}
        </div>
        <div className="rd-nav-status">
          {live === 'reconnecting' ? <span className="text-caption rd-muted">실시간 연결을 다시 잇는 중…</span> : null}
          {needLogin.map((p) => (
            <Link key={p.id} to="/accounts" className="rd-nav-alert" title="계정 관리에서 다시 로그인해 주세요">
              <Badge dot tone="warning">
                {p.name} 로그인 필요
              </Badge>
            </Link>
          ))}
          <StatPill label="오늘 전체 게시" value={today.data?.posted ?? 0} max={today.data?.cap ?? 10} />
        </div>
      </div>
    </nav>
  );
}
