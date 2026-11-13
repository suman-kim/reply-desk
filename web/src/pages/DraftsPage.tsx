import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { useDrafts } from '../api/queries';
import type { DraftListRow, DraftListStatus } from '../api/types';
import { STATUS_LABELS } from '../components/badges';
import { Icon } from '../components/Icon';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { StatusBadge } from '../components/StatusBadge';
import { Badge, MatchBar, Tabs } from '../ds';
import { bodyChars, formatDuration, formatLogTime, relativeTime } from '../lib/format';
import { paths } from '../nav/paths';
import { useRouteTopic } from '../nav/route-topic';

/** 상태 탭 값 */
type StatusTab = 'all' | DraftListStatus;

/**
 * 작업 목록 (/t/:topicId/drafts, RD-26): 고른 주제에서 AI가 쓴 초안(작업)을 영상마다 모아 본다.
 * 상태 탭(개수) · 찾기 · 표(상태 | 영상 | 매칭 | 초안 | 고친 시각). 행을 누르면 작업 상세에서 고치고 게시한다.
 * 상태는 주소(?status=)에 담아 작업 상세에서 돌아와도 그대로다. 예전 주소(?video=)는 작업 상세로 넘긴다.
 */
export function DraftsPage() {
  const topic = useRouteTopic();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const status = (STATUS_LABELS.map(([s]) => s).find((s) => s === params.get('status')) ?? 'all') as StatusTab;
  const [q, setQ] = useState('');
  const drafts = useDrafts({
    status: status === 'all' ? undefined : status,
    topicId: topic.id,
    q: q.trim() || undefined,
  });
  const counts = drafts.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  // 예전 주소(?video=, RD-26 전 작업 창)는 작업 상세로
  const legacyVideo = Number(params.get('video')) || null;
  if (legacyVideo) return <Navigate to={paths.video(topic.id, legacyVideo)} replace />;
  const from = location.pathname + location.search;

  const pickStatus = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'all') p.delete('status');
    else p.set('status', v);
    setParams(p, { replace: true });
  };

  return (
    <div className="rd-page rd-drafts">
      <header className="rd-header">
        <div className="rd-header-title">
          <h1 className="text-display">작업 목록</h1>
          <p className="text-body-sm">AI가 쓴 초안을 영상마다 모아 봐요. 행을 누르면 작업 상세에서 고치고 게시해요.</p>
        </div>
        <div className="rd-search">
          <label className="dk-sr" htmlFor="rd-draft-q">
            영상 제목이나 댓글로 찾기
          </label>
          <span className="rd-search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input id="rd-draft-q" className="dk-input" value={q} placeholder="영상 제목이나 댓글로 찾기" onChange={(e) => setQ(e.target.value)} />
        </div>
      </header>

      <Tabs
        className="rd-drafts-tabs"
        label="상태로 나누기"
        value={status}
        onChange={pickStatus}
        items={[
          { value: 'all', label: '전체', count: counts ? total : undefined },
          ...STATUS_LABELS.filter(([s]) => s !== 'writing' || (counts?.writing ?? 0) > 0).map(([s, label]) => ({
            value: s,
            label,
            count: counts?.[s],
          })),
        ]}
      />

      {drafts.isPending ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
      {drafts.error ? <ErrorBand error={drafts.error} onRetry={() => void drafts.refetch()} /> : null}
      {drafts.data && drafts.data.rows.length === 0 ? (
        <EmptyBox>
          {total === 0 ? (
            <>
              아직 작업이 없어요 · <Link to={paths.topic(topic.id, 'dashboard')}>영상 목록</Link>에서 영상을 고르고 [초안 작성]을 누르면 여기 쌓여요
            </>
          ) : (
            '조건에 맞는 작업이 없어요 · 탭이나 찾는 말을 바꿔 보세요'
          )}
        </EmptyBox>
      ) : null}

      {drafts.data && drafts.data.rows.length > 0 ? (
        <ul className="rd-dtable" aria-label="작업 목록">
          <li className="rd-dgrid rd-dhead" aria-hidden="true">
            <span>상태</span>
            <span>영상</span>
            <span className="rd-c-dmatch">매칭</span>
            <span className="rd-c-draft">초안</span>
            <span className="rd-c-time">고친 시각</span>
            <span />
          </li>
          {drafts.data.rows.map((r) => (
            <li key={r.id}>
              <DraftRow row={r} to={paths.video(topic.id, r.video.id)} from={from} disclosure={topic.adDisclosure} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 작업 목록 한 행 (행 전체가 작업 상세 링크)
 * @param props.row 작업 한 행
 * @param props.to 작업 상세 주소
 * @param props.from 돌아올 곳 (지금 주소)
 * @param props.disclosure 주제의 광고 표시 (글자 수에서 뺀다)
 */
function DraftRow({ row: r, to, from, disclosure }: { row: DraftListRow; to: string; from: string; disclosure: string }) {
  const failed = r.status === 'error';
  return (
    <Link className="rd-dgrid rd-drow" to={to} state={{ from }}>
      <span className="rd-drow-status">
        <StatusBadge status={r.status} label={r.statusLabel} />
        {r.video.isMine ? <Badge tone="accent">내 채널</Badge> : null}
      </span>
      <span className="rd-cell-sub">
        <span className="rd-clamp rd-drow-title">{r.video.title}</span>
        <span className="text-caption rd-muted rd-clamp-1">
          {r.video.channelTitle} · 조회수 <span className="text-mono">{r.video.viewCount.toLocaleString('ko-KR')}</span>회 · {relativeTime(r.video.publishedAt)} ·{' '}
          <span className="text-mono">{formatDuration(r.video.durationSec)}</span>
        </span>
      </span>
      <span className="rd-c-dmatch">
        {r.topicMatch ? <MatchBar percent={r.topicMatch.percent} threshold={r.topicMatch.threshold} /> : <span className="text-caption rd-muted">—</span>}
      </span>
      <span className="rd-c-draft rd-cell-sub">
        {failed ? (
          <>
            <span className="text-body-sm rd-clamp rd-danger">{r.errorMessage ?? '초안을 쓰지 못했어요'}</span>
            <span className="text-caption rd-muted">누르면 다시 쓸 수 있어요</span>
          </>
        ) : (
          <>
            <span className="text-body-sm rd-clamp rd-ink2">{r.text}</span>
            <span className="text-caption rd-muted">
              <span className="text-mono">{bodyChars(r.text, r.video.isMine ? null : disclosure)}</span>자{r.model ? <> · <span className="text-mono">{r.model}</span></> : null}
              {r.edited ? ' · 직접 고침' : null}
            </span>
          </>
        )}
      </span>
      <span className="rd-c-time text-mono rd-ink2">{formatLogTime(r.updatedAt)}</span>
      <span className="rd-vgo" aria-hidden="true">
        <Icon name="chevronRight" size={18} />
      </span>
    </Link>
  );
}
