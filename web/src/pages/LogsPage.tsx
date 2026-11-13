import { useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useLogs, useTopics } from '../api/queries';
import { PageHeader } from '../components/PageHeader';
import { ErrorBand } from '../components/StateBox';
import { LogTable, Panel, Segmented, StatPill } from '../ds/inyeon';
import { formatLogTime } from '../lib/format';

/** 결과 거르기 */
type ResultFilter = 'all' | 'success' | 'failed';

/**
 * 게시 기록: 어느 영상에, 어느 프로필로, 무슨 댓글을 달았는지 결과까지 최근 순으로 (계획서 '게시 기록').
 * 주제(전체·주제 하나)와 결과(전체·성공·실패)로 거른다. 고른 주제는 주소(?topic=)에 담는다.
 * 게시 중인 행은 대시보드 ③ 칸에서 보여 주고 여기에는 끝난 것만 둔다.
 */
export function LogsPage() {
  const [params, setParams] = useSearchParams();
  const topicId = Number(params.get('topic')) || null;
  const [result, setResult] = useState<ResultFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const selectId = useId();
  const topics = useTopics();
  const logs = useLogs(topicId);

  /** 끝난 기록만 (게시 중인 행 제외) */
  const finished = useMemo(() => (logs.data ?? []).filter((r) => r.status !== 'running'), [logs.data]);
  const okCount = finished.filter((r) => r.status === 'success').length;

  const rows = useMemo(
    () =>
      finished
        .filter((r) => result === 'all' || r.status === result)
        .map((r) => ({
          id: String(r.id),
          time: formatLogTime(r.startedAt),
          // 주제 하나만 볼 때는 주제 칸을 숨긴다
          topic: topicId ? undefined : (r.topic?.name ?? '지운 주제'),
          video: r.video ? (
            <a href={`https://www.youtube.com/watch?v=${r.video.youtubeId}`} target="_blank" rel="noreferrer">
              {r.video.title}
            </a>
          ) : (
            '지운 영상'
          ),
          profile: r.profileName ?? '지운 프로필',
          comment: r.commentUrl ? (
            <a href={r.commentUrl} target="_blank" rel="noreferrer">
              {r.commentText}
            </a>
          ) : (
            r.commentText
          ),
          ok: r.status === 'success',
          reason: r.failureReason ?? undefined,
          capture: r.hasScreenshot ? `/api/posting/attempts/${r.id}/capture` : undefined,
        })),
    [finished, result, topicId],
  );

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

  const emptyText = logs.isPending
    ? '불러오는 중…'
    : finished.length === 0
      ? '아직 기록이 없어요 · 대시보드 ③에서 [댓글 달기]를 누르면 여기 쌓여요'
      : result === 'success'
        ? '성공한 기록이 없어요'
        : '실패한 기록이 없어요';

  return (
    <div className="rd-page">
      <PageHeader
        title="게시 기록"
        description="어느 영상에, 어느 프로필로, 무슨 댓글을 달았는지 결과까지 최근 순으로 보여 줘요. 실패한 기록은 원인과 화면 캡처를 볼 수 있어요."
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
                { value: 'all', label: '전체' },
                { value: 'success', label: '성공' },
                { value: 'failed', label: '실패' },
              ]}
            />
          </div>
        </div>
        {logs.error ? <ErrorBand error={logs.error} onRetry={() => void logs.refetch()} /> : null}
        <LogTable
          rows={rows}
          // 캡처가 있는 기록이 있을 때만 [캡처 보기]를 둔다 (표는 실패 행마다 버튼을 붙인다)
          onCapture={rows.some((r) => r.capture) ? (row) => setOpenId(openId === row.id ? null : row.id) : undefined}
          openCaptureId={openId}
          emptyText={emptyText}
        />
        {finished.length === 0 && !logs.isPending ? (
          <span className="text-caption rd-muted">
            <Link to="/">대시보드로 가기</Link>
          </span>
        ) : null}
      </Panel>
    </div>
  );
}
