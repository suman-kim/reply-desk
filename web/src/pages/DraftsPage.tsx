import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useDraftDetail, useDrafts, useTopics } from '../api/queries';
import type { DraftListRow, DraftListStatus } from '../api/types';
import { POST_RESULT, STATUS_LABELS, STATUS_TONE } from '../components/badges';
import { DraftReview } from '../components/DraftReview';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PostControl } from '../components/PostControl';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Field, Segmented, StatPill } from '../ds/inyeon';
import { countChars, formatDuration, formatLogTime, formatViews, relativeTime, shortWatchUrl } from '../lib/format';

/** 고른 작업 (주제·영상) */
interface Selected {
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
}

/**
 * 작업 목록: AI가 쓴 초안(작업)을 한곳에서 보고, 행을 누르면 창(모달)에서 고치고 게시·다시 게시한다.
 * 연 작업은 주소(?topic=&video=)에 담는다. 댓글 게시 목록의 [작업 목록에서 다시 게시]가 이 주소로 바로 연다.
 */
export function DraftsPage() {
  const topics = useTopics();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<'all' | DraftListStatus>('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [q, setQ] = useState('');
  const drafts = useDrafts({
    status: status === 'all' ? undefined : status,
    topicId: topicFilter === 'all' ? undefined : Number(topicFilter),
    q: q.trim() || undefined,
  });
  const counts = drafts.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  const sel: Selected | null =
    Number(params.get('topic')) && Number(params.get('video'))
      ? { topicId: Number(params.get('topic')), videoId: Number(params.get('video')) }
      : null;

  /**
   * 작업 창을 열거나 닫는다 (주소에 담아 새로 고쳐도 유지)
   * @param next 열 작업 (null이면 닫기)
   */
  const select = (next: Selected | null) => {
    const p = new URLSearchParams(params);
    if (next) {
      p.set('topic', String(next.topicId));
      p.set('video', String(next.videoId));
    } else {
      p.delete('topic');
      p.delete('video');
    }
    setParams(p, { replace: true });
  };

  return (
    <div className="rd-page">
      <PageHeader
        title="작업 목록"
        description="AI가 쓴 초안을 영상마다 모아 봐요. 행을 누르면 창이 열려 초안을 고치고, 게시하거나 다시 게시할 수 있어요."
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
        <Segmented
          label="주제"
          value={topicFilter}
          onChange={setTopicFilter}
          options={[{ value: 'all', label: '모든 주제' }, ...(topics.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))]}
        />
        <Field value={q} onChange={(e) => setQ(e.target.value)} placeholder="영상 제목이나 댓글 내용으로 찾기" />
      </div>

      <section aria-label="작업 목록" className="rd-list-scroll">
        <div className="rd-grid-row rd-grid-head text-label">
          <span>상태</span>
          <span>영상</span>
          <span>주제</span>
          <span>초안</span>
          <span>고친 시각</span>
        </div>
        {drafts.isPending ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
        {drafts.error ? <ErrorBand error={drafts.error} onRetry={() => void drafts.refetch()} /> : null}
        {drafts.data && drafts.data.rows.length === 0 ? (
          <EmptyBox>
            {total === 0 ? (
              <>
                아직 작업이 없어요 · <Link to="/">대시보드</Link> ②에서 영상을 고르고 [초안 작성]을 누르면 여기 쌓여요
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
              selected={sel?.videoId === r.video.id && sel.topicId === r.topic.id}
              onOpen={() => select({ topicId: r.topic.id, videoId: r.video.id })}
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

  return (
    <div className="rd-grid-row rd-row-click" data-selected={selected || undefined} onClick={onOpen}>
      <span className="rd-row-tight">
        <Badge tone={STATUS_TONE[r.status]}>{r.statusLabel}</Badge>
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
      <span className="text-caption rd-ink2">{r.topic.name}</span>
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

/**
 * 작업 상세 창: 영상 정보, 분석·초안 고치기·검사, 이 영상의 댓글 게시, [댓글 달기]
 * @param props.sel 고른 작업
 * @param props.onClose 닫기
 */
function DraftDetailModal({ sel, onClose }: { sel: Selected; onClose: () => void }) {
  const topics = useTopics();
  const detail = useDraftDetail(sel.topicId, sel.videoId);
  const topic = topics.data?.find((t) => t.id === sel.topicId);
  const d = detail.data;

  return (
    <Modal
      open
      label={`작업 상세: ${d?.video.title ?? ''}`}
      title={d?.video.title ?? '작업'}
      badges={
        d ? (
          <>
            {d.status ? <Badge tone={STATUS_TONE[d.status.code]}>{d.status.label}</Badge> : null}
            {d.video.isMine ? <Badge tone="rose">내 채널</Badge> : null}
          </>
        ) : undefined
      }
      subtitle={d ? `${d.video.channelTitle} · ${topic?.name ?? ''}` : undefined}
      actions={
        d ? (
          <a href={d.video.url} target="_blank" rel="noreferrer" className="iy-btn iy-btn-ghost iy-btn-sm">
            유튜브에서 보기
          </a>
        ) : undefined
      }
      onClose={onClose}
    >
      {detail.isPending || !topic ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
      {detail.error ? <ErrorBand error={detail.error} onRetry={() => void detail.refetch()} /> : null}
      {d && topic ? (
        <>
          <dl className="rd-dl rd-dl-3">
            <div className="rd-dl-wide">
              <dt className="text-label">유튜브 주소</dt>
              <dd className="text-body-sm">
                <a href={d.video.url} target="_blank" rel="noreferrer" className="text-mono">
                  {d.video.url}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-label">조회수</dt>
              <dd className="text-body-sm">{d.video.viewCount.toLocaleString('ko-KR')}회</dd>
            </div>
            <div>
              <dt className="text-label">올린 때</dt>
              <dd className="text-body-sm">{relativeTime(d.video.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-label">영상 길이</dt>
              <dd className="text-body-sm">{formatDuration(d.video.durationSec)}</dd>
            </div>
            <div>
              <dt className="text-label">분석한 AI</dt>
              <dd className="text-body-sm">{d.analysis ? d.analysis.model : '아직 없음'}</dd>
            </div>
            <div>
              <dt className="text-label">초안 쓴 AI</dt>
              <dd className="text-body-sm">{d.draft?.model ?? '아직 없음'}</dd>
            </div>
          </dl>

          <DraftReview topic={topic} detail={d} />

          <div className="rd-stack-8">
            <span className="text-label rd-ink2">이 영상의 댓글 게시</span>
            {d.attempts.length === 0 ? <span className="text-body-sm rd-muted">아직 게시한 적 없어요</span> : null}
            {d.attempts.map((a) => (
              <div key={a.id} className="rd-history">
                <span className="text-mono rd-muted">{formatLogTime(a.startedAt)}</span>
                <Badge tone={POST_RESULT[a.status].tone} loading={a.status === 'running'}>
                  {POST_RESULT[a.status].label}
                </Badge>
                {a.failureReason ? <span className="text-caption rd-muted">{a.failureReason}</span> : null}
                {a.commentUrl ? (
                  <a href={a.commentUrl} target="_blank" rel="noreferrer" className="text-caption">
                    댓글 보기
                  </a>
                ) : null}
              </div>
            ))}
            {d.attempts.length > 0 ? (
              <Link to={`/logs?topic=${topic.id}`} className="text-caption">
                댓글 게시 목록에서 캡처 보기
              </Link>
            ) : null}
          </div>

          <PostControl key={`${d.video.id}:${d.attempts[0]?.id ?? 0}`} topic={topic} video={d.video} attempts={d.attempts} showBrowser={false} />
        </>
      ) : null}
    </Modal>
  );
}
