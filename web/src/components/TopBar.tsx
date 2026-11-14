import { Link, useLocation } from 'react-router';
import { useProfiles, useToday } from '../api/queries';
import { Badge, StatPill } from '../ds';
import type { LiveStatus } from '../live/useLiveEvents';
import { placeOf } from '../menu';
import { paths } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';
import { Icon } from './Icon';
import { TopicPendingCount } from './MenuCounts';
import { useTaskShell } from './task-shell-context';

/**
 * 위쪽 막대 (얇게, 모든 화면 공통): ☰(좁은 화면) · 지금 위치 · 로그인 경고 · 오늘 전체 게시 · [작업 N].
 * [작업]은 고른 주제의 작업 패널을 연다. 주제를 고르기 전에는 숨긴다.
 * @param props.live 실시간 연결 상태
 * @param props.navOpen 사이드 메뉴를 덮개로 열었는지
 * @param props.onOpenNav ☰ 누름 (사이드 메뉴 덮개 열기)
 */
export function TopBar({ live, navOpen, onOpenNav }: { live: LiveStatus; navOpen: boolean; onOpenNav: () => void }) {
  const { pathname } = useLocation();
  const place = placeOf(pathname);
  const { topic } = useSelectedTopic();
  const profiles = useProfiles();
  const today = useToday();
  const shell = useTaskShell();
  const needLogin = profiles.data?.filter((p) => p.loginStatus === 'needs_login') ?? [];

  return (
    <header className="rd-topbar">
      <button
        type="button"
        className="rd-icon-button rd-topbar-menu"
        aria-label="메뉴 열기"
        aria-expanded={navOpen}
        aria-controls="rd-snav"
        onClick={onOpenNav}
      >
        <Icon name="menu" />
      </button>

      {/* 지금 위치: 주제 화면이면 '주제 / 화면' */}
      <nav aria-label="지금 위치" className="rd-crumb">
        {place.section && topic ? (
          <>
            <Link to={paths.topic(topic.id)} className="rd-crumb-topic">
              {topic.name}
            </Link>
            <span className="rd-crumb-sep" aria-hidden="true">
              /
            </span>
            {place.parent ? (
              <>
                <Link to={paths.topic(topic.id, place.parent.section)} className="rd-crumb-topic">
                  {place.parent.label}
                </Link>
                <span className="rd-crumb-sep" aria-hidden="true">
                  /
                </span>
              </>
            ) : null}
          </>
        ) : null}
        <span className="rd-crumb-here" aria-current="page">
          {place.label}
        </span>
      </nav>

      <div className="rd-topbar-status">
        {live === 'reconnecting' ? <span className="text-caption rd-muted rd-topbar-live">실시간 연결을 다시 잇는 중…</span> : null}
        {/* 로그인 경고: 한 계정이면 이름, 여럿이면 개수 (좁은 화면에서 넘치지 않게) */}
        {needLogin.length > 0 ? (
          <Link to={paths.accounts} className="rd-nav-alert" title={`${needLogin.map((p) => p.name).join(', ')} · 계정 관리에서 다시 로그인해 주세요`}>
            <Badge tone="warning">{needLogin.length === 1 ? `${needLogin[0].name} 로그인 필요` : `로그인 필요 ${needLogin.length}개`}</Badge>
          </Link>
        ) : null}
        {/* 서버에서 받은 값만 보인다 (불러오기 전에는 숫자를 지어내지 않는다) */}
        {today.data ? <StatPill className="rd-topbar-stat" label="오늘 전체 게시" value={today.data.posted} max={today.data.cap} /> : null}
        {/* 고른 주제의 작업 패널 열기·닫기 (숫자는 그 주제의 게시 대기 초안) */}
        {topic ? (
          <button
            type="button"
            className={`rd-nav-task${shell.panelOpen ? ' is-on' : ''}`}
            aria-pressed={shell.panelOpen}
            aria-controls="rd-task-panel"
            title={`${topic.name}의 작업 패널`}
            onClick={shell.togglePanel}
          >
            <Icon name="tray" size={16} />
            작업
            <TopicPendingCount topic={topic} />
          </button>
        ) : null}
      </div>
    </header>
  );
}
