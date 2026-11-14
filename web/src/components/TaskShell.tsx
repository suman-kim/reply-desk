import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api/http';
import { useDrafts } from '../api/queries';
import type { DraftListStatus, Topic, VideoItem } from '../api/types';
import { Badge, Button, Glyph, Segmented } from '../ds';
import { formatLogTime } from '../lib/format';
import type { LiveEvent } from '../live/apply-event';
import { NoticeRules, type Notice } from '../live/notify-rules';
import { paths } from '../nav/paths';
import { topicMatchBadge } from './badges';
import { StatusBadge } from './StatusBadge';
import { EmptyBox, ErrorBand, LoadingBox } from './StateBox';
import { TaskShellContext, useTaskShell, type BrowserNotify, type TaskRef, type TaskShellValue } from './task-shell-context';

/** 화면에 띄운 알림 (작업이면 영상 제목을 붙인다) */
type ShownNotice = Notice & {
  /** 알림의 영상 제목 */
  subject?: string;
};

/** 브라우저 저장소 키 (패널 열림, 브라우저 알림 켬) */
const PANEL_KEY = 'rd.taskPanelOpen';
const NOTIFY_KEY = 'rd.browserNotify';
/** 알림이 화면에 머무는 시간 */
const NOTICE_MS = 7_000;
/** 화면에 한 번에 쌓는 알림 수 */
const MAX_NOTICES = 4;

/**
 * 브라우저 저장소 읽기 (막힌 브라우저에서도 화면이 그려지게)
 * @param key 키
 */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * 브라우저 저장소 쓰기
 * @param key 키
 * @param on 켬/끔
 */
function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // 저장이 막혀도 이번 화면에서는 동작한다
  }
}

/**
 * 전역 작업 패널·알림. 어느 화면에서나 작업 창을 열고, 실시간 이벤트를 알림(오른쪽 아래)과 브라우저 알림으로 띄운다.
 * @param props.children 앱 화면
 */
export function TaskShellProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(() => readFlag(PANEL_KEY));
  const [notices, setNotices] = useState<ShownNotice[]>([]);
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  const [notifyPref, setNotifyPref] = useState(() => readFlag(NOTIFY_KEY));
  const rules = useRef(new NoticeRules());
  const browserOn = supported && notifyPref && permission === 'granted';
  const browserOnRef = useRef(browserOn);
  useEffect(() => {
    browserOnRef.current = browserOn;
  }, [browserOn]);

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      writeFlag(PANEL_KEY, !open);
      return !open;
    });
  }, []);

  const dismiss = useCallback((id: number) => setNotices((list) => list.filter((n) => n.id !== id)), []);

  /**
   * 작업 상세 화면으로 (RD-26: 작업은 창 대신 한 화면에서 본다)
   * @param t 주제·영상
   */
  const openTask = useCallback((t: TaskRef) => void navigate(paths.video(t.topicId, t.videoId)), [navigate]);

  /**
   * 알림의 [보기]: 작업이면 작업 상세, 아니면 그 화면으로
   * @param n 알림
   */
  const act = useCallback(
    (n: Notice) => {
      if (n.target) openTask(n.target);
      else if (n.href) void navigate(n.href);
    },
    [navigate, openTask],
  );

  const show = useCallback(
    (n: ShownNotice) => {
      setNotices((list) => [...list, n].slice(-MAX_NOTICES));
      setTimeout(() => dismiss(n.id), NOTICE_MS);
      // 다른 탭·창을 보고 있을 때만 브라우저 알림 (보고 있으면 화면 알림으로 충분하다)
      if (browserOnRef.current && document.visibilityState === 'hidden') {
        const bn = new Notification(n.title, { body: [n.subject, n.body].filter(Boolean).join('\n'), tag: `rd-${n.id}` });
        bn.onclick = () => {
          window.focus();
          act(n);
          bn.close();
        };
      }
    },
    [act, dismiss],
  );

  const onLiveEvent = useCallback(
    (e: LiveEvent) => {
      const notice = rules.current.toNotice(e);
      if (!notice) return;
      if (!notice.target) return show(notice);
      // 작업 알림에는 영상 제목을 붙인다 (못 받으면 제목 없이)
      api<VideoItem>('GET', `/topics/${notice.target.topicId}/videos/${notice.target.videoId}`)
        .then((v) => show({ ...notice, subject: v.title }))
        .catch(() => show(notice));
    },
    [show],
  );

  const browserNotify = useMemo<BrowserNotify>(
    () => ({
      supported,
      on: browserOn,
      denied: permission === 'denied',
      enable: () => {
        if (!supported) return;
        void Notification.requestPermission().then((p) => {
          setPermission(p);
          setNotifyPref(p === 'granted');
          writeFlag(NOTIFY_KEY, p === 'granted');
        });
      },
      disable: () => {
        setNotifyPref(false);
        writeFlag(NOTIFY_KEY, false);
      },
    }),
    [supported, browserOn, permission],
  );

  const value = useMemo<TaskShellValue>(
    () => ({ panelOpen, togglePanel, openTask, onLiveEvent, browserNotify }),
    [panelOpen, togglePanel, openTask, onLiveEvent, browserNotify],
  );

  return (
    <TaskShellContext.Provider value={value}>
      {children}
      <div className="rd-toasts" role="status" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`rd-toast rd-toast-${n.tone}`}>
            <span className="rd-toast-mark" aria-hidden="true">
              <Glyph name={n.tone === 'success' ? 'check' : n.tone === 'danger' ? 'x' : 'alert'} size={13} />
            </span>
            <span className="text-body-strong">{n.title}</span>
            {n.subject ? <span className="text-body-sm rd-clamp">{n.subject}</span> : null}
            <span className="text-caption rd-muted">{n.body}</span>
            <div className="rd-toast-actions">
              {n.target || n.href ? (
                <button
                  type="button"
                  className="rd-link-button"
                  onClick={() => {
                    act(n);
                    dismiss(n.id);
                  }}
                >
                  보기
                </button>
              ) : null}
              <button type="button" className="rd-link-button" aria-label="알림 닫기" onClick={() => dismiss(n.id)}>
                닫기
              </button>
            </div>
          </div>
        ))}
      </div>
    </TaskShellContext.Provider>
  );
}

/** 패널 거르기 (RD-31): 전체 · 게시 대기 · 작성 중 · 확인 필요(실패·검사 미통과·작성 실패) · 게시 완료. 값이 null이면 모든 상태 */
const PANEL_GROUPS: Record<'all' | 'pending' | 'writing' | 'attention' | 'posted', DraftListStatus[] | null> = {
  all: null,
  pending: ['pending'],
  writing: ['writing'],
  attention: ['failed', 'check_failed', 'error'],
  posted: ['posted'],
};

/** 패널 거르기 이름 (화면에 보이는 순서) */
const PANEL_GROUP_LABELS: [keyof typeof PANEL_GROUPS, string][] = [
  ['all', '전체'],
  ['pending', '게시 대기'],
  ['writing', '작성 중'],
  ['attention', '확인 필요'],
  ['posted', '게시 완료'],
];

/** 거른 칸이 비었을 때 한 줄 */
const PANEL_EMPTY: Record<keyof typeof PANEL_GROUPS, string> = {
  all: '아직 작업이 없어요 · 대시보드에서 영상을 골라 초안을 써 보세요',
  pending: '게시를 기다리는 초안이 없어요',
  writing: '지금 쓰는 초안이 없어요',
  attention: '확인할 작업이 없어요',
  posted: '아직 게시한 댓글이 없어요',
};

/** 패널에 한 번에 보이는 작업 수 (더 보려면 작업 목록으로) */
const PANEL_ROWS = 30;

/**
 * 작업 패널 (오른쪽). 고른 주제의 작업만 보고, 행을 누르면 그 자리에서 작업 창을 연다(알림은 모든 주제).
 * 넓으면 오른쪽에 붙고(본문이 좁아짐), 좁으면 위에 덮는다(styles.css). 아래 링크로 그 주제의 작업 목록 화면에 간다.
 * @param props.topic 고른 주제
 */
export function TaskPanel({ topic }: { topic: Topic }) {
  const shell = useTaskShell();
  const drafts = useDrafts({ topicId: topic.id });
  const [group, setGroup] = useState<keyof typeof PANEL_GROUPS>('pending');
  const counts = drafts.data?.counts;
  const count = (g: keyof typeof PANEL_GROUPS) =>
    counts ? (PANEL_GROUPS[g] ?? (Object.keys(counts) as DraftListStatus[])).reduce((sum, s) => sum + counts[s], 0) : 0;
  const statuses = PANEL_GROUPS[group];
  const rows = (drafts.data?.rows ?? []).filter((r) => !statuses || statuses.includes(r.status));
  const { browserNotify } = shell;

  return (
    <aside id="rd-task-panel" className="rd-taskpanel" aria-label="작업 패널">
      <div className="rd-card-head">
        <span className="rd-stack">
          <span className="text-heading">작업</span>
          <span className="text-caption rd-muted">{topic.name}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={shell.togglePanel}>
          닫기
        </Button>
      </div>
      <Segmented
        label="작업 거르기"
        value={group}
        onChange={(v) => setGroup(v as keyof typeof PANEL_GROUPS)}
        options={PANEL_GROUP_LABELS.map(([value, label]) => ({ value, label: `${label} ${count(value)}` }))}
      />
      {drafts.isPending ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
      {drafts.error ? <ErrorBand error={drafts.error} onRetry={() => void drafts.refetch()} /> : null}
      {drafts.data && rows.length === 0 ? (
        <EmptyBox>{PANEL_EMPTY[group]}</EmptyBox>
      ) : null}
      <div className="rd-stack">
        {rows.slice(0, PANEL_ROWS).map((r) => {
          const match = topicMatchBadge(r.topicMatch);
          return (
            <Link key={r.id} className="rd-task-row" to={paths.video(r.topic.id, r.video.id)}>
              <span className="rd-row-tight">
                <StatusBadge status={r.status} label={r.statusLabel} />
                {match ? <Badge tone={match.tone}>{match.label}</Badge> : null}
              </span>
              <span className="text-body-sm rd-clamp">{r.video.title}</span>
              <span className="text-caption rd-muted">{formatLogTime(r.updatedAt)}</span>
            </Link>
          );
        })}
      </div>
      <Link to={paths.topic(topic.id, 'drafts')} className="text-body-sm rd-task-more">
        작업 목록에서 모두 보기 →
      </Link>
      <div className="rd-task-notify text-caption">
        {!browserNotify.supported ? (
          <span className="rd-muted">이 브라우저는 알림을 지원하지 않아요 · 화면 알림만 보여요</span>
        ) : browserNotify.on ? (
          <>
            <span className="rd-muted">브라우저 알림 켜짐 · 다른 탭을 보고 있을 때 알려 줘요</span>
            <button type="button" className="rd-link-button" onClick={browserNotify.disable}>
              끄기
            </button>
          </>
        ) : browserNotify.denied ? (
          <span className="rd-muted">브라우저 설정에서 이 사이트의 알림이 막혀 있어요 · 주소창 왼쪽 자물쇠에서 허용해 주세요</span>
        ) : (
          <>
            <span className="rd-muted">초안·게시가 끝나면 다른 탭을 보고 있어도 알려 줘요</span>
            <button type="button" className="rd-link-button" onClick={browserNotify.enable}>
              브라우저 알림 켜기
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
