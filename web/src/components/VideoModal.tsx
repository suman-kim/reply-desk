import { useEffect, useRef } from 'react';
import { useVideoComments } from '../api/queries';
import { Button, Spinner } from '../ds/inyeon';
import { formatViews, relativeTime } from '../lib/format';
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
 * 영상 보기 창: 유튜브 플레이어와 인기 댓글. 브라우저 기본 <dialog>라 Esc·바깥 누르기로 닫히고 초점이 창 안에 머문다.
 * 퍼가기를 막은 영상은 플레이어에 오류가 나므로 [유튜브에서 보기]를 함께 둔다.
 * @param props.topicId 주제 ID (댓글 API 주소)
 * @param props.video 띄울 영상. null이면 닫는다
 * @param props.onClose 닫을 때
 */
export function VideoModal({ topicId, video, onClose }: { topicId: number; video: ModalVideo | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const comments = useVideoComments(topicId, video?.id ?? null);

  // 영상이 정해지면 열고, 없어지면 닫는다
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (video && !dialog.open) dialog.showModal();
    if (!video && dialog.open) dialog.close();
  }, [video]);

  const watchUrl = video ? `https://www.youtube.com/watch?v=${video.youtubeId}` : '';

  return (
    <dialog
      ref={ref}
      className="rd-modal"
      aria-label={video ? `영상 보기: ${video.title}` : '영상 보기'}
      onClose={onClose}
      // 창 바깥(어두운 바탕)을 누르면 닫는다
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {video ? (
        <div className="rd-modal-body">
          <div className="rd-modal-head">
            <div className="rd-stack" style={{ minWidth: 0 }}>
              <span className="text-heading rd-modal-title">{video.title}</span>
              <span className="text-caption rd-muted">
                {video.channelTitle} · {relativeTime(video.publishedAt)} · {formatViews(video.viewCount)}
              </span>
            </div>
            <div className="rd-row-tight" style={{ flex: 'none' }}>
              <a href={watchUrl} target="_blank" rel="noreferrer" className="iy-btn iy-btn-ghost iy-btn-sm">
                유튜브에서 보기
              </a>
              <Button variant="secondary" size="sm" onClick={() => ref.current?.close()}>
                닫기
              </Button>
            </div>
          </div>

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
        </div>
      ) : null}
    </dialog>
  );
}
