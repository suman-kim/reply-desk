import { useState } from 'react';
import { Link } from 'react-router';
import { useDraftDetail, useDrafts, useTopics } from '../api/queries';
import type { DraftListStatus } from '../api/types';
import { STATUS_LABELS, STATUS_TONE } from '../components/badges';
import { DraftReview } from '../components/DraftReview';
import { PageHeader } from '../components/PageHeader';
import { PostControl } from '../components/PostControl';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Field, Segmented, StatPill } from '../ds/inyeon';
import { formatLogTime } from '../lib/format';

/** 고른 초안 (주제·영상) */
interface Selected {
  topicId: number;
  videoId: number;
}

/**
 * 초안 목록: AI가 쓴 초안을 한곳에서 보고, 행을 누르면 오른쪽에서 고치고 게시·다시 게시한다.
 */
export function DraftsPage() {
  const topics = useTopics();
  const [status, setStatus] = useState<'all' | DraftListStatus>('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Selected | null>(null);
  const drafts = useDrafts({
    status: status === 'all' ? undefined : status,
    topicId: topicFilter === 'all' ? undefined : Number(topicFilter),
    q: q.trim() || undefined,
  });
  const counts = drafts.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="rd-page">
      <PageHeader
        title="초안 목록"
        description="AI가 쓴 초안을 모아 봐요. 행을 누르면 오른쪽에서 고치고, 게시하거나 다시 게시할 수 있어요."
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

      <div className="rd-drafts">
        <section aria-label="초안 목록" className="rd-drafts-list">
          <div className="rd-grid-row rd-grid-head text-label">
            <span>상태</span>
            <span>영상</span>
            <span>주제</span>
            <span>초안</span>
            <span>고친 시각</span>
          </div>
          {drafts.isPending ? <LoadingBox>초안을 불러오는 중…</LoadingBox> : null}
          {drafts.error ? <ErrorBand error={drafts.error} onRetry={() => void drafts.refetch()} /> : null}
          {drafts.data && drafts.data.rows.length === 0 ? (
            <EmptyBox>
              {total === 0 ? (
                <>
                  아직 초안이 없어요 · <Link to="/">대시보드</Link>에서 [영상 불러오기]를 누르면 AI가 초안을 써요
                </>
              ) : (
                '조건에 맞는 초안이 없어요 · 필터를 바꿔 보세요'
              )}
            </EmptyBox>
          ) : null}
          <div className="rd-stack">
            {drafts.data?.rows.map((r) => (
              <button
                type="button"
                key={r.id}
                className="rd-grid-row"
                aria-pressed={sel?.videoId === r.video.id && sel.topicId === r.topic.id}
                onClick={() => setSel({ topicId: r.topic.id, videoId: r.video.id })}
              >
                <span>
                  <Badge tone={STATUS_TONE[r.status]}>{r.statusLabel}</Badge>
                </span>
                <span className="rd-cell-sub">
                  <span className="text-body-sm rd-clamp">{r.video.title}</span>
                  <span className="text-caption rd-muted">{r.video.channelTitle}</span>
                </span>
                <span className="text-caption rd-ink2">{r.topic.name}</span>
                <span className="text-body-sm rd-clamp">{r.errorMessage ?? r.text}</span>
                <span className="text-mono rd-muted">{formatLogTime(r.updatedAt)}</span>
              </button>
            ))}
          </div>
        </section>

        {sel ? <DraftDetailAside sel={sel} onClose={() => setSel(null)} /> : null}
      </div>
    </div>
  );
}

/**
 * 초안 상세 (오른쪽): 상태, 영상, 고민·이유, 초안 고치기, 검사, 게시 기록, 게시
 * @param props.sel 고른 초안
 * @param props.onClose 닫기
 */
function DraftDetailAside({ sel, onClose }: { sel: Selected; onClose: () => void }) {
  const topics = useTopics();
  const detail = useDraftDetail(sel.topicId, sel.videoId);
  const topic = topics.data?.find((t) => t.id === sel.topicId);
  const d = detail.data;

  return (
    <aside aria-label="초안 상세" className="rd-drafts-detail">
      <div className="rd-card-head">
        <div className="rd-stack-8" style={{ minWidth: 0 }}>
          <div className="rd-row">
            {d?.status ? <Badge tone={STATUS_TONE[d.status.code]}>{d.status.label}</Badge> : null}
            {d?.video.isMine ? <Badge tone="rose">내 채널</Badge> : null}
          </div>
          <h2 className="text-heading" style={{ margin: 0 }}>
            {d?.video.title ?? '초안'}
          </h2>
          {d ? (
            <span className="text-caption rd-muted">
              {d.video.channelTitle} · {topic?.name}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" aria-label="상세 닫기" onClick={onClose}>
          닫기
        </Button>
      </div>
      {detail.isPending || !topic ? <LoadingBox /> : null}
      {detail.error ? <ErrorBand error={detail.error} onRetry={() => void detail.refetch()} /> : null}
      {d && topic ? (
        <>
          <DraftReview topic={topic} detail={d} />
          <div className="rd-stack-8">
            <span className="text-label rd-ink2">게시 기록</span>
            {d.attempts.length === 0 ? <span className="text-body-sm rd-muted">아직 게시한 적 없어요</span> : null}
            {d.attempts.map((a) => (
              <div key={a.id} className="rd-history">
                <span className="text-mono rd-muted">{formatLogTime(a.startedAt)}</span>
                <Badge tone={a.status === 'success' ? 'success' : a.status === 'failed' ? 'danger' : 'neutral'} loading={a.status === 'running'}>
                  {a.status === 'success' ? '성공' : a.status === 'failed' ? '실패' : '게시 중'}
                </Badge>
                {a.failureReason ? <span className="text-caption rd-muted">{a.failureReason}</span> : null}
              </div>
            ))}
          </div>
          <PostControl key={`${d.video.id}:${d.attempts[0]?.id ?? 0}`} topic={topic} video={d.video} attempts={d.attempts} showBrowser={false} />
        </>
      ) : null}
    </aside>
  );
}
