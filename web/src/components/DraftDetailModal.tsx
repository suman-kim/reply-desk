import { Link } from 'react-router';
import { useDraftDetail, useTopics } from '../api/queries';
import { Badge } from '../ds/inyeon';
import { formatDuration, formatLogTime, relativeTime } from '../lib/format';
import { paths } from '../nav/paths';
import { POST_RESULT, STATUS_TONE } from './badges';
import { DraftReview } from './DraftReview';
import { Modal } from './Modal';
import { PostControl } from './PostControl';
import { ErrorBand, LoadingBox } from './StateBox';

/** 작업 하나 (주제·영상) */
export interface TaskRef {
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
}

/**
 * 작업 상세 창: 영상 정보, 분석·초안 고치기·검사, 이 영상의 댓글 게시, [댓글 달기].
 * 작업 목록 화면과 전역 작업 패널·알림의 [보기]가 함께 쓴다.
 * @param props.sel 고른 작업
 * @param props.onClose 닫기
 */
export function DraftDetailModal({ sel, onClose }: { sel: TaskRef; onClose: () => void }) {
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
              <Link to={paths.topic(topic.id, 'logs')} className="text-caption">
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
