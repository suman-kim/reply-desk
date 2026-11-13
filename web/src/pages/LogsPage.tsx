import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLogs } from '../api/queries';
import type { PostLogRow } from '../api/types';
import { POST_RESULT } from '../components/badges';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { PostLogDetail } from '../components/PostLogDetail';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Segmented } from '../ds';
import { formatDateTime, formatElapsed, formatLogTime, isToday } from '../lib/format';
import { paths } from '../nav/paths';
import { useRouteTopic } from '../nav/route-topic';

/** 결과 거르기 */
type ResultFilter = 'all' | 'success' | 'failed';

/**
 * 찾는 말이 영상 제목·채널·댓글·프로필에 들어 있는지 (띄어쓰기·대소문자 무시)
 * @param r 게시 기록
 * @param q 찾는 말
 */
function matches(r: PostLogRow, q: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const needle = norm(q);
  if (!needle) return true;
  return [r.video?.title, r.video?.channelTitle, r.commentText, r.profileName].some((s) => s && norm(s).includes(needle));
}

/**
 * 댓글 게시 목록 (/t/:topicId/logs, RD-26): 어느 영상에, 어느 계정으로, 무슨 댓글을 달았는지 결과까지 최근 순으로.
 * 넓으면 왼쪽 목록 | 오른쪽 자세히(큰 캡처), 좁으면 목록만 두고 누르면 창으로 연다.
 * 결과(전체·성공·실패)와 찾는 말로 거르고, 고른 기록은 주소(?log=)에 담는다. 게시 중인 행은 작업 상세에서 보여 주고 여기에는 끝난 것만 둔다.
 */
export function LogsPage() {
  const topic = useRouteTopic();
  const logs = useLogs(topic.id);
  const [params, setParams] = useSearchParams();
  const result: ResultFilter = (['success', 'failed'] as const).find((v) => v === params.get('result')) ?? 'all';
  const [q, setQ] = useState('');
  /** 좁은 화면에서 자세히 창을 열었는지 */
  const [modal, setModal] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  /** 끝난 기록만 (게시 중인 행 제외) */
  const finished = useMemo(() => (logs.data ?? []).filter((r) => r.status !== 'running'), [logs.data]);
  const okCount = finished.filter((r) => r.status === 'success').length;
  const rows = useMemo(() => finished.filter((r) => (result === 'all' || r.status === result) && matches(r, q)), [finished, result, q]);
  const picked = Number(params.get('log')) || null;
  // 넓은 화면은 고르지 않았으면 맨 위 기록을 보여 준다
  const selected = rows.find((r) => r.id === picked) ?? rows[0] ?? null;
  const todayOf = (s: PostLogRow['status']) => finished.filter((r) => r.status === s && isToday(r.startedAt)).length;

  /**
   * 주소 값 바꾸기
   * @param next 바꿀 값 (null이면 지움)
   */
  const setQuery = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  /**
   * 기록 고르기: 오른쪽 칸이 보이면 그 칸에, 안 보이면(좁은 화면) 창으로
   * @param id 게시 기록
   */
  const pick = (id: number) => {
    setQuery({ log: String(id) });
    if (!detailRef.current || detailRef.current.offsetWidth === 0) setModal(true);
  };

  return (
    <div className="rd-page rd-logs">
      <header className="rd-header">
        <div className="rd-header-title">
          <h1 className="text-display">댓글 게시 목록</h1>
          <p className="text-body-sm">어느 영상에, 어느 계정으로, 무슨 댓글을 달았는지 결과까지 최근 순으로 보여요.</p>
        </div>
        <div className="rd-header-actions">
          <div className="rd-kpi is-success">
            <span>오늘 성공</span>
            <b className="tnum">{todayOf('success')}</b>
          </div>
          <div className="rd-kpi">
            <span>오늘 실패</span>
            <b className="tnum">{todayOf('failed')}</b>
          </div>
        </div>
      </header>

      <div className="rd-list-tools">
        <Segmented
          label="결과로 거르기"
          value={result}
          onChange={(v) => setQuery({ result: v === 'all' ? null : v, log: null })}
          options={[
            { value: 'all', label: <>전체 <span className="rd-seg-count">{finished.length}</span></> },
            { value: 'success', label: <>성공 <span className="rd-seg-count">{okCount}</span></> },
            { value: 'failed', label: <>실패 <span className="rd-seg-count">{finished.length - okCount}</span></> },
          ]}
        />
        <div className="rd-search">
          <label className="dk-sr" htmlFor="rd-log-q">
            영상 제목이나 댓글로 찾기
          </label>
          <span className="rd-search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input id="rd-log-q" className="dk-input" value={q} placeholder="영상 제목이나 댓글로 찾기" onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {logs.isPending ? <LoadingBox>댓글 게시 목록을 불러오는 중…</LoadingBox> : null}
      {logs.error ? <ErrorBand error={logs.error} onRetry={() => void logs.refetch()} /> : null}
      {logs.data && rows.length === 0 ? (
        <EmptyBox>
          {finished.length === 0 ? (
            <>
              아직 단 댓글이 없어요 · <Link to={paths.topic(topic.id, 'dashboard')}>영상 목록</Link>에서 영상을 골라 작업 상세의 [댓글 달기]를 누르면 여기 쌓여요
            </>
          ) : q.trim() ? (
            '찾는 말에 맞는 게시가 없어요'
          ) : result === 'success' ? (
            '성공한 게시가 없어요'
          ) : (
            '실패한 게시가 없어요 · 실패하면 원인과 다시 할 일을 여기 남겨요'
          )}
        </EmptyBox>
      ) : null}

      {rows.length > 0 ? (
        <div className="rd-logs-split">
          <ul className="rd-logs-list" aria-label="게시 기록">
            {rows.map((r) => (
              <li key={r.id}>
                <LogItem row={r} current={r.id === selected?.id} onPick={() => pick(r.id)} />
              </li>
            ))}
          </ul>
          <div ref={detailRef} className="rd-logs-detail">
            {selected ? <PostLogDetail key={selected.id} row={selected} head /> : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={modal && !!selected}
        label={selected ? `댓글 게시 상세: ${selected.video?.title ?? '지운 영상'}` : '댓글 게시 상세'}
        title={selected?.video?.title ?? '지운 영상'}
        badges={selected ? <Badge tone={POST_RESULT[selected.status].tone}>{POST_RESULT[selected.status].label}</Badge> : undefined}
        subtitle={selected ? `${formatDateTime(selected.startedAt)} · ${selected.profileName ?? '지운 프로필'}` : undefined}
        actions={
          selected?.video ? (
            <a href={selected.video.url} target="_blank" rel="noreferrer" className="dk-btn dk-btn-ghost dk-btn-sm">
              유튜브에서 보기
            </a>
          ) : undefined
        }
        onClose={() => setModal(false)}
      >
        {selected ? <PostLogDetail row={selected} /> : null}
      </Modal>
    </div>
  );
}

/**
 * 게시 기록 한 줄: 시각 · 걸린 시간 · 캡처 · 결과 / 영상 / 댓글(실패면 원인) / 프로필 · 채널
 * @param props.row 게시 기록
 * @param props.current 지금 고른 기록인지
 * @param props.onPick 고르기
 */
function LogItem({ row: r, current, onPick }: { row: PostLogRow; current: boolean; onPick: () => void }) {
  const res = POST_RESULT[r.status];
  return (
    <button type="button" className={`rd-logi${current ? ' is-on' : ''}`} aria-current={current || undefined} onClick={onPick}>
      <span className="rd-logi-top">
        <span className="text-mono rd-ink">{formatLogTime(r.startedAt)}</span>
        <span className="text-caption rd-muted">{formatElapsed(r.startedAt, r.finishedAt)} 걸림</span>
        <span className="rd-logi-badges">
          {r.hasScreenshot ? (
            <Badge tone="accent" icon={false}>
              캡처
            </Badge>
          ) : null}
          <Badge tone={res.tone}>{res.label}</Badge>
        </span>
      </span>
      <span className="text-body-strong rd-clamp-1 rd-ink">{r.video?.title ?? '지운 영상'}</span>
      {r.status === 'failed' ? (
        <span className="text-body-sm rd-clamp rd-danger">{r.failureReason ?? '원인을 남기지 못했어요'}</span>
      ) : (
        <span className="text-body-sm rd-clamp rd-ink2">{r.commentText}</span>
      )}
      <span className="text-caption rd-muted rd-clamp-1">
        {r.profileName ?? '지운 프로필'}
        {r.video ? ` · ${r.video.channelTitle}` : ''}
      </span>
    </button>
  );
}
