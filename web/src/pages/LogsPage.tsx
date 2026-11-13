import { useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLogs, useTopics } from '../api/queries';
import type { PostLogRow } from '../api/types';
import { POST_RESULT } from '../components/badges';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PostLogDetail } from '../components/PostLogDetail';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Panel, Segmented, StatPill } from '../ds/inyeon';
import { formatDateTime, formatElapsed, formatLogTime, shortWatchUrl } from '../lib/format';

/** 결과 거르기 */
type ResultFilter = 'all' | 'success' | 'failed';

/**
 * 댓글 게시 목록: 어느 영상에, 어느 프로필로, 무슨 댓글을 달았는지 결과까지 최근 순으로 (계획서 '게시 기록').
 * 주제(전체·주제 하나)와 결과(전체·성공·실패)로 거른다. 고른 주제는 주소(?topic=)에 담는다.
 * 행을 누르면 창(모달)에서 게시 결과 캡처(성공: 게시된 댓글 화면, 실패: 실패 순간)와 자세한 정보를 본다.
 * 게시 중인 행은 대시보드 ③ 칸에서 보여 주고 여기에는 끝난 것만 둔다.
 */
export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const topicId = Number(params.get('topic')) || null;
  const [result, setResult] = useState<ResultFilter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const selectId = useId();
  const topics = useTopics();
  const logs = useLogs(topicId);

  /** 끝난 기록만 (게시 중인 행 제외) */
  const finished = useMemo(() => (logs.data ?? []).filter((r) => r.status !== 'running'), [logs.data]);
  const okCount = finished.filter((r) => r.status === 'success').length;
  const rows = useMemo(() => finished.filter((r) => result === 'all' || r.status === result), [finished, result]);
  const open = rows.find((r) => r.id === openId) ?? null;

  /**
   * 주제 거르기를 바꾼다 (주소에 담아 새로 고쳐도 유지)
   * @param value 주제 ID 또는 빈 값(전체)
   */
  const pickTopic = (value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set('topic', value);
    else p.delete('topic');
    setParams(p, { replace: true });
    setOpenId(null);
  };

  return (
    <div className="rd-page">
      <PageHeader
        title="댓글 게시 목록"
        description="어느 영상에, 어느 프로필로, 무슨 댓글을 달았는지 결과까지 최근 순으로 보여 줘요. 행을 누르면 게시된 화면 캡처와 자세한 정보를 볼 수 있어요."
        right={finished.length > 0 ? <StatPill label="성공" value={okCount} max={finished.length} /> : undefined}
      />
      <Panel>
        <div className="rd-log-filters">
          <div className="iy-field rd-log-topic">
            <label className="iy-field-label" htmlFor={selectId}>
              주제
            </label>
            <select id={selectId} className="iy-input rd-select" value={topicId ?? ''} onChange={(e) => pickTopic(e.target.value)}>
              <option value="">전체 주제</option>
              {topics.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rd-stack-8">
            <span className="iy-field-label">결과</span>
            <Segmented
              label="결과"
              value={result}
              onChange={(v) => {
                setResult(v as ResultFilter);
                setOpenId(null);
              }}
              options={[
                { value: 'all', label: `전체 ${finished.length}` },
                { value: 'success', label: `성공 ${okCount}` },
                { value: 'failed', label: `실패 ${finished.length - okCount}` },
              ]}
            />
          </div>
        </div>

        <section aria-label="댓글 게시 목록" className="rd-list-scroll">
          <div className="rd-log-row rd-grid-head text-label">
            <span>시각</span>
            <span>결과</span>
            <span>영상</span>
            <span>{topicId ? '프로필' : '주제 · 프로필'}</span>
            <span>댓글</span>
            <span>캡처</span>
          </div>
          {logs.isPending ? <LoadingBox>댓글 게시 목록을 불러오는 중…</LoadingBox> : null}
          {logs.error ? <ErrorBand error={logs.error} onRetry={() => void logs.refetch()} /> : null}
          {logs.data && rows.length === 0 ? (
            <EmptyBox>
              {finished.length === 0 ? (
                <>
                  아직 단 댓글이 없어요 · <Link to="/">대시보드</Link> ③이나 <Link to="/drafts">작업 목록</Link>에서 [댓글 달기]를 누르면 여기 쌓여요
                </>
              ) : result === 'success' ? (
                '성공한 게시가 없어요'
              ) : (
                '실패한 게시가 없어요'
              )}
            </EmptyBox>
          ) : null}
          <div className="rd-stack">
            {rows.map((r) => (
              <LogRow key={r.id} row={r} showTopic={!topicId} selected={r.id === openId} onOpen={() => setOpenId(r.id)} />
            ))}
          </div>
        </section>
      </Panel>

      <Modal
        open={!!open}
        label={open ? `댓글 게시 상세: ${open.video?.title ?? '지운 영상'}` : '댓글 게시 상세'}
        title={open?.video?.title ?? '지운 영상'}
        badges={open ? <Badge tone={POST_RESULT[open.status].tone}>{POST_RESULT[open.status].label}</Badge> : undefined}
        subtitle={open ? `${formatDateTime(open.startedAt)} · ${open.profileName ?? '지운 프로필'}` : undefined}
        actions={
          open?.video ? (
            <a href={open.video.url} target="_blank" rel="noreferrer" className="iy-btn iy-btn-ghost iy-btn-sm">
              유튜브에서 보기
            </a>
          ) : undefined
        }
        onClose={() => setOpenId(null)}
      >
        {open ? <PostLogDetail row={open} /> : null}
      </Modal>
    </div>
  );
}

/**
 * 댓글 게시 목록 한 행. 행 어디를 눌러도 상세 창이 열린다(키보드는 제목 버튼). 링크는 창을 열지 않고 새 탭으로 간다.
 * @param props.row 댓글 게시 한 행
 * @param props.showTopic 주제 이름을 보일지 (주제 하나만 볼 때는 숨긴다)
 * @param props.selected 지금 연 행인지
 * @param props.onOpen 상세 창 열기
 */
function LogRow({ row: r, showTopic, selected, onOpen }: { row: PostLogRow; showTopic: boolean; selected: boolean; onOpen: () => void }) {
  /** 행 안 링크는 새 탭만 열고 창은 열지 않는다 */
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const capture = `/api/posting/attempts/${r.id}/capture`;

  return (
    <div className="rd-log-row rd-row-click" data-selected={selected || undefined} onClick={onOpen}>
      <span className="rd-cell-sub">
        <span className="text-mono">{formatLogTime(r.startedAt)}</span>
        <span className="text-caption rd-muted">{formatElapsed(r.startedAt, r.finishedAt)} 걸림</span>
      </span>
      <span>
        <Badge tone={POST_RESULT[r.status].tone}>{POST_RESULT[r.status].label}</Badge>
      </span>
      <span className="rd-cell-sub">
        <button type="button" className="rd-row-open text-body-sm rd-clamp" aria-haspopup="dialog" onClick={onOpen}>
          {r.video?.title ?? '지운 영상'}
        </button>
        {r.video ? (
          <>
            <span className="text-caption rd-muted">{r.video.channelTitle}</span>
            <a href={r.video.url} target="_blank" rel="noreferrer" className="text-caption text-mono rd-link-out" onClick={stop}>
              {shortWatchUrl(r.video.youtubeId)} ↗
            </a>
          </>
        ) : null}
      </span>
      <span className="rd-cell-sub">
        {showTopic ? <span className="text-caption rd-ink2">{r.topic?.name ?? '지운 주제'}</span> : null}
        <span className="text-caption rd-muted">{r.profileName ?? '지운 프로필'}</span>
      </span>
      <span className="rd-cell-sub">
        <span className="text-body-sm rd-clamp">{r.commentText}</span>
        {r.status === 'failed' ? (
          <span className="text-caption rd-danger-ink rd-clamp">{r.failureReason}</span>
        ) : r.commentUrl ? (
          <a href={r.commentUrl} target="_blank" rel="noreferrer" className="text-caption rd-link-out" onClick={stop}>
            댓글 보기 ↗
          </a>
        ) : null}
      </span>
      <span>
        {r.hasScreenshot ? (
          <img src={capture} alt={`${r.video?.title ?? '게시'} 캡처`} className="rd-capture-thumb" loading="lazy" />
        ) : (
          <span className="text-caption rd-muted">없음</span>
        )}
      </span>
    </div>
  );
}
