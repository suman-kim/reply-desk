import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useDrafts } from '../api/queries';
import type { DraftListRow, DraftListStatus } from '../api/types';
import { STATUS_LABELS, topicMatchBadge } from '../components/badges';
import { StatusBadge } from '../components/StatusBadge';
import { DraftDetailModal, type TaskRef } from '../components/DraftDetailModal';
import { PageHeader } from '../components/PageHeader';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Field, Segmented, StatPill } from '../ds';
import { countChars, formatDuration, formatLogTime, formatViews, relativeTime, shortWatchUrl } from '../lib/format';
import { paths } from '../nav/paths';
import { useRouteTopic } from '../nav/route-topic';

/** 고른 작업 (주제·영상) */
type Selected = TaskRef;

/**
 * 작업 목록 (/t/:topicId/drafts): 고른 주제에서 AI가 쓴 초안(작업)을 한곳에서 보고, 행을 누르면 창(모달)에서 고치고 게시·다시 게시한다.
 * 연 작업은 주소(?video=)에 담는다. 댓글 게시 목록의 [작업 목록에서 다시 게시]가 이 주소로 바로 연다.
 */
export function DraftsPage() {
  const topic = useRouteTopic();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'all' | DraftListStatus>('all');
  const [q, setQ] = useState('');
  const drafts = useDrafts({
    status: status === 'all' ? undefined : status,
    topicId: topic.id,
    q: q.trim() || undefined,
  });
  const counts = drafts.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  const videoId = Number(params.get('video')) || null;
  const sel: Selected | null = videoId ? { topicId: topic.id, videoId } : null;

  /**
   * 작업 창을 열거나 닫는다 (주소에 담아 새로 고쳐도 유지)
   * @param next 열 영상 ID (null이면 닫기)
   */
  const select = (next: number | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('video', String(next));
    else p.delete('video');
    setParams(p, { replace: true });
  };

  return (
    <div className="rd-page">
      <PageHeader
        title="작업 목록"
        description="이 주제에서 AI가 쓴 초안을 영상마다 모아 봐요. 행을 누르면 창이 열려 초안을 고치고, 게시하거나 다시 게시할 수 있어요."
        right={counts ? <StatPill label="게시 대기" value={counts.pending + counts.failed} /> : undefined}
      />

      <div className="rd-filters">
        <Segmented
          label="상태"
          value={status}
          onChange={(v) => setStatus(v as typeof status)}
          options={[
            { value: 'all', label: `전체 ${total}` },
            ...STATUS_LABELS.filter(([s]) => s !== 'writing' || (counts?.writing ?? 0) > 0).map(([s, label]) => ({
              value: s,
              label: counts ? `${label} ${counts[s]}` : label,
            })),
          ]}
        />
        <Field value={q} onChange={(e) => setQ(e.target.value)} placeholder="영상 제목이나 댓글 내용으로 찾기" />
      </div>

      <section aria-label="작업 목록" className="rd-list-scroll">
        <div className="rd-grid-row rd-grid-head text-label">
          <span>상태</span>
          <span>영상</span>
          <span>초안</span>
          <span>고친 시각</span>
        </div>
        {drafts.isPending ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
        {drafts.error ? <ErrorBand error={drafts.error} onRetry={() => void drafts.refetch()} /> : null}
        {drafts.data && drafts.data.rows.length === 0 ? (
          <EmptyBox>
            {total === 0 ? (
              <>
                아직 작업이 없어요 · <Link to={paths.topic(topic.id, 'dashboard')}>대시보드</Link> ②에서 영상을 고르고 [초안 작성]을 누르면 여기 쌓여요
              </>
            ) : (
              '조건에 맞는 작업이 없어요 · 필터를 바꿔 보세요'
            )}
          </EmptyBox>
        ) : null}
        <div className="rd-stack">
          {drafts.data?.rows.map((r) => (
            <DraftRow
              key={r.id}
              row={r}
              selected={sel?.videoId === r.video.id}
              onOpen={() => select(r.video.id)}
            />
          ))}
        </div>
      </section>

      {sel ? <DraftDetailModal sel={sel} onClose={() => select(null)} /> : null}
    </div>
  );
}

/**
 * 작업 목록 한 행. 행 어디를 눌러도 창이 열린다(키보드는 제목 버튼). 유튜브·댓글 링크는 창을 열지 않고 새 탭으로 간다.
 * @param props.row 작업 한 행
 * @param props.selected 지금 연 작업인지
 * @param props.onOpen 창 열기
 */
function DraftRow({ row: r, selected, onOpen }: { row: DraftListRow; selected: boolean; onOpen: () => void }) {
  /** 행 안 링크는 새 탭만 열고 창은 열지 않는다 */
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const match = topicMatchBadge(r.topicMatch);

  return (
    <div className="rd-grid-row rd-row-click" data-selected={selected || undefined} onClick={onOpen}>
      <span className="rd-row-tight">
        <StatusBadge status={r.status} label={r.statusLabel} />
        {/* 주제와 매칭 (가장 중요한 판단) */}
        {match ? <Badge tone={match.tone}>{match.label}</Badge> : null}
        {r.video.isMine ? <Badge tone="rose">내 채널</Badge> : null}
      </span>
      <span className="rd-cell-sub">
        <button type="button" className="rd-row-open text-body-sm rd-clamp" aria-haspopup="dialog" onClick={onOpen}>
          {r.video.title}
        </button>
        <span className="text-caption rd-muted">
          {r.video.channelTitle} · {formatViews(r.video.viewCount)} · {relativeTime(r.video.publishedAt)} · {formatDuration(r.video.durationSec)}
        </span>
        <a href={r.video.url} target="_blank" rel="noreferrer" className="text-caption text-mono rd-link-out" onClick={stop}>
          {shortWatchUrl(r.video.youtubeId)} ↗
        </a>
      </span>
      <span className="rd-cell-sub">
        <span className="text-body-sm rd-clamp">{r.errorMessage ?? r.text}</span>
        <span className="text-caption rd-muted">
          {r.text ? `${countChars(r.text)}자` : null}
          {r.model ? ` · ${r.model}` : null}
          {r.edited ? ' · 직접 고침' : null}
          {r.commentUrl ? (
            <>
              {' · '}
              <a href={r.commentUrl} target="_blank" rel="noreferrer" onClick={stop}>
                댓글 보기 ↗
              </a>
            </>
          ) : null}
        </span>
      </span>
      <span className="text-mono rd-muted">{formatLogTime(r.updatedAt)}</span>
    </div>
  );
}
