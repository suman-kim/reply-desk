import { useVideoComments } from '../api/queries';
import { Spinner } from '../ds/inyeon';
import { formatViews, relativeTime } from '../lib/format';
import { Modal } from './Modal';
import { ErrorBand } from './StateBox';

/** 창에 띄울 영상 (카드·② 머리에서 넘긴다) */
export interface ModalVideo {
  /** 내부 영상 ID (댓글을 받을 때) */
  id: number;
  /** 유튜브 영상 ID (플레이어) */
  youtubeId: string;
  /** 제목 */
  title: string;
  /** 채널 이름 */
  channelTitle: string;
  /** 조회수 */
  viewCount: number;
  /** 올린 시각 */
  publishedAt: string;
}

/**
 * 영상 보기 창: 유튜브 플레이어와 인기 댓글. 공용 창(Modal)이라 Esc·바깥 누르기로 닫히고 초점이 창 안에 머문다.
 * 퍼가기를 막은 영상은 플레이어에 오류가 나므로 [유튜브에서 보기]를 함께 둔다.
 * @param props.topicId 주제 ID (댓글 API 주소)
 * @param props.video 띄울 영상. null이면 닫는다
 * @param props.onClose 닫을 때
 */
export function VideoModal({ topicId, video, onClose }: { topicId: number; video: ModalVideo | null; onClose: () => void }) {
  const comments = useVideoComments(topicId, video?.id ?? null);
  const watchUrl = video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '';

  return (
    <Modal
      open={!!video}
      width="wide"
      label={video ? `영상 보기: ${video.title}` : '영상 보기'}
      title={video?.title}
      subtitle={video ? `${video.channelTitle} · ${relativeTime(video.publishedAt)} · ${formatViews(video.viewCount)}` : undefined}
      actions={
        <a href={watchUrl} target="_blank" rel="noreferrer" className="iy-btn iy-btn-ghost iy-btn-sm">
          유튜브에서 보기
        </a>
      }
      onClose={onClose}
    >
      {video ? (
        <div className="rd-modal-content">
          <div className="rd-player">
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&hl=ko`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <section className="rd-comments" aria-label="인기 댓글">
            <div className="rd-list-head">
              <span className="text-label rd-ink2">인기 댓글</span>
              {comments.data && !comments.data.disabled ? (
                <span className="text-caption rd-muted">{comments.data.comments.length}개 · 관련성 순</span>
              ) : null}
            </div>
            {comments.isPending ? (
              <div className="rd-box-row text-body-sm" style={{ padding: 24 }}>
                <Spinner size={18} />
                <span>댓글을 불러오는 중…</span>
              </div>
            ) : null}
            {comments.error ? <ErrorBand error={comments.error} onRetry={() => void comments.refetch()} /> : null}
            {comments.data?.disabled ? <p className="text-body-sm rd-muted rd-comments-empty">댓글이 막힌 영상이에요</p> : null}
            {comments.data && !comments.data.disabled && comments.data.comments.length === 0 ? (
              <p className="text-body-sm rd-muted rd-comments-empty">아직 댓글이 없어요</p>
            ) : null}
            <ol className="rd-comment-list">
              {comments.data?.comments.map((c) => (
                <li key={c.id} className="rd-comment">
                  {c.authorImageUrl ? (
                    <img className="rd-comment-avatar" src={c.authorImageUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="rd-comment-avatar" aria-hidden="true" />
                  )}
                  <div className="rd-stack" style={{ minWidth: 0 }}>
                    <span className="text-caption">
                      <strong>{c.author}</strong> <span className="rd-muted">· {relativeTime(c.publishedAt)}</span>
                    </span>
                    <span className="text-body-sm rd-comment-text">{c.text}</span>
                    <span className="text-caption rd-muted">
                      좋아요 {c.likeCount.toLocaleString('ko-KR')}
                      {c.replyCount > 0 ? ` · 답글 ${c.replyCount}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
