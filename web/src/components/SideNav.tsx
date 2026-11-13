import { useEffect, useId, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useTopics } from '../api/queries';
import type { Topic } from '../api/types';
import { COMMON_MENU, TOPIC_MENU } from '../menu';
import { paths, sectionFromPath } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';
import { Icon } from './Icon';
import { CountBubble } from './MenuCounts';
import { ErrorBand } from './StateBox';

/**
 * 왼쪽 사이드 메뉴 (모든 화면 공통): 앱 이름 · 주제 목록 · 고른 주제 메뉴 · 공통 메뉴.
 * 고른 주제 메뉴(대시보드·작업 목록·댓글 게시 목록·주제 설정)는 주제를 고른 뒤에만 보인다.
 * 화면 너비에 따라 모양이 바뀐다(styles.css '사이드 메뉴')
 * - 1280px 이상: 펼친 채로 붙어 있다
 * - 768~1279px: 아이콘만 보이게 접힌다. 위쪽 막대 ☰로 펼친 메뉴를 덮어 연다
 * - 767px 이하: 숨긴다. ☰로 덮어 연다
 * @param props.open 덮개로 펼쳐 열었는지 (좁은 화면)
 * @param props.onClose 덮개 닫기 (닫기 버튼·바깥 누름·Esc)
 */
export function SideNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const topics = useTopics();
  const { topic: selected } = useSelectedTopic();
  /** 지금 보는 주제 안의 화면 (주제를 바꾸면 같은 화면을 연다) */
  const section = sectionFromPath(pathname);
  const closeRef = useRef<HTMLButtonElement>(null);
  const topicsHeadId = useId();
  const topicMenuHeadId = useId();
  const commonHeadId = useId();

  // 덮개로 열면 닫기 버튼에 초점을 두고, Esc로 닫는다. 닫으면 연 버튼(☰)으로 초점을 돌려준다
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <div className="rd-snav-slot">
      <nav id="rd-snav" className={`rd-snav${open ? ' is-open' : ''}`} aria-label="메뉴">
        <div className="rd-snav-top">
          <Link to={paths.home} className="rd-snav-brand" title="유튜브 댓글 에이전트 · 주제 고르기">
            <span className="rd-snav-logo" aria-hidden="true">
              댓
            </span>
            <span className="rd-snav-text text-body-strong">유튜브 댓글 에이전트</span>
          </Link>
          {open ? (
            <button ref={closeRef} type="button" className="rd-icon-button" aria-label="메뉴 닫기" onClick={onClose}>
              <Icon name="close" />
            </button>
          ) : null}
        </div>

        <div className="rd-snav-group" role="group" aria-labelledby={topicsHeadId}>
          <div className="rd-snav-head">
            <span id={topicsHeadId} className="text-label">
              주제
            </span>
            {topics.data ? <span className="text-caption rd-muted">{topics.data.length}개</span> : null}
          </div>
          {topics.isPending ? <span className="rd-snav-text text-caption rd-muted rd-snav-note">주제를 불러오는 중…</span> : null}
          {topics.error ? (
            <div className="rd-snav-text">
              <ErrorBand error={topics.error} onRetry={() => void topics.refetch()} />
            </div>
          ) : null}
          {topics.data?.map((t) => (
            <SideTopic key={t.id} topic={t} selected={t.id === selected?.id} href={paths.topic(t.id, section ?? 'dashboard')} />
          ))}
          <Link to={paths.newTopic} className="rd-snav-item rd-snav-new" title="새 주제 만들기" aria-current={pathname === paths.newTopic ? 'page' : undefined}>
            <Icon name="plus" />
            <span className="rd-snav-text">새 주제</span>
          </Link>
        </div>

        {selected ? (
          <div className="rd-snav-group" role="group" aria-labelledby={topicMenuHeadId}>
            <div className="rd-snav-head">
              <span id={topicMenuHeadId} className="text-label rd-clamp-1" title={`${selected.name} 메뉴`}>
                {selected.name}
              </span>
            </div>
            {TOPIC_MENU.map((m) => {
              const on = section === m.section;
              return (
                <Link
                  key={m.section}
                  to={paths.topic(selected.id, m.section)}
                  className={`rd-snav-item${on ? ' is-on' : ''}`}
                  aria-current={on ? 'page' : undefined}
                  title={m.label}
                >
                  <Icon name={m.icon} />
                  <span className="rd-snav-text">{m.label}</span>
                  {m.Count ? <m.Count topic={selected} /> : null}
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rd-snav-text rd-snav-note text-caption rd-muted">
            주제를 고르면 그 주제의 대시보드 · 작업 목록 · 댓글 게시 목록 · 주제 설정이 여기 보여요
          </p>
        )}

        <div className="rd-snav-group rd-snav-common" role="group" aria-labelledby={commonHeadId}>
          <div className="rd-snav-head">
            <span id={commonHeadId} className="text-label">
              공통
            </span>
          </div>
          {COMMON_MENU.map((m) => {
            const on = pathname.replace(/\/+$/, '') === m.path;
            return (
              <Link key={m.path} to={m.path} className={`rd-snav-item${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined} title={m.label}>
                <Icon name={m.icon} />
                <span className="rd-snav-text">{m.label}</span>
                {m.Count ? <m.Count /> : null}
              </Link>
            );
          })}
        </div>
      </nav>
      {/* 덮개로 열었을 때 바깥을 누르면 닫는다 (키보드는 Esc·닫기 버튼) */}
      {open ? <div className="rd-snav-backdrop" aria-hidden="true" onClick={onClose} /> : null}
    </div>
  );
}

/**
 * 주제 목록 한 칸: 상태 점 · 이름 · 오늘 n/상한 · 게시 대기 수. 접힌 메뉴에서는 이름 첫 글자 동그라미로 보인다.
 * @param props.topic 주제
 * @param props.selected 고른 주제인지
 * @param props.href 누르면 갈 주소 (보던 화면을 그대로 연다)
 */
function SideTopic({ topic: t, selected, href }: { topic: Topic; selected: boolean; href: string }) {
  const active = t.status === 'active';
  const meta = active ? `오늘 ${t.postedToday}/${t.dailyCap}` : `일시정지 · 오늘 ${t.postedToday}/${t.dailyCap}`;
  return (
    <Link
      to={href}
      className={`rd-snav-topic${selected ? ' is-on' : ''}`}
      aria-current={selected ? 'true' : undefined}
      title={`${t.name} · ${meta} · 게시 대기 ${t.pendingDrafts}개`}
    >
      {/* 접힌 메뉴: 이름 첫 글자 + 상태 점 */}
      <span className="rd-snav-avatar" aria-hidden="true">
        {Array.from(t.name)[0] ?? '?'}
        <span className={`rd-snav-dot${active ? ' is-active' : ''}`} />
      </span>
      {/* 펼친 메뉴: 상태 점 · 이름 · 숫자 */}
      <span className={`rd-snav-dot rd-snav-text${active ? ' is-active' : ''}`} aria-hidden="true" />
      <span className="rd-snav-topic-body rd-snav-text">
        <span className="rd-snav-topic-name">{t.name}</span>
        <span className="rd-snav-topic-meta">{meta}</span>
      </span>
      <CountBubble n={t.pendingDrafts} title={`게시 대기 초안 ${t.pendingDrafts}개`} />
    </Link>
  );
}
