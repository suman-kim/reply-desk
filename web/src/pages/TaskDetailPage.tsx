import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useDraftDetail, useVideos } from '../api/queries';
import type { DraftDetail, Topic } from '../api/types';
import { DraftCard } from '../components/DraftCard';
import { EvidencePanel } from '../components/EvidencePanel';
import { Icon } from '../components/Icon';
import { PostControl } from '../components/PostControl';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { VideoModal } from '../components/VideoModal';
import { POST_RESULT } from '../components/badges';
import { Badge, Tabs } from '../ds';
import { formatDuration, formatLogTime, relativeTime } from '../lib/format';
import { readyNeighbors } from '../lib/video-order';
import { paths } from '../nav/paths';
import { useRouteTopic } from '../nav/route-topic';
import { RESTORE_SCROLL } from '../nav/scroll-memory';

/** 작업 상세로 올 때 넘기는 값: 돌아갈 곳 (영상 목록의 정렬·거르기·쪽, 작업 목록) */
interface TaskFrom {
  from?: string;
}

/** 좁은 화면 나누기: 판단 근거 · 초안과 게시 */
type Pane = 'evidence' | 'action';

/**
 * 작업 상세 (/t/:topicId/videos/:videoId, RD-26): 영상 하나를 보고 → 판단하고 → 초안을 고치고 → 댓글을 다는 곳.
 * 넓으면 두 칸(A 판단 근거 | B 초안 · 게시), 좁으면 탭으로 나눈다. 위에는 돌아가기와 게시 대기 앞뒤 넘기기.
 * 영상 목록·작업 목록·작업 패널·알림의 [보기]가 모두 여기로 온다.
 */
export function TaskDetailPage() {
  const topic = useRouteTopic();
  const { videoId } = useParams();
  const id = Number(videoId) || null;
  if (!id) {
    return (
      <div className="rd-page">
        <EmptyBox>없는 영상이에요 · <Link to={paths.topic(topic.id, 'dashboard')}>영상 목록으로</Link></EmptyBox>
      </div>
    );
  }
  // 영상을 넘기면 고른 탭·고치던 글을 처음부터 (key)
  return <TaskDetail key={`${topic.id}:${id}`} topic={topic} videoId={id} />;
}

/**
 * 작업 상세 본문
 * @param props.topic 주제
 * @param props.videoId 영상
 */
function TaskDetail({ topic, videoId }: { topic: Topic; videoId: number }) {
  const location = useLocation();
  const from = (location.state as TaskFrom | null)?.from;
  const detail = useDraftDetail(topic.id, videoId);
  const videos = useVideos(topic.id);
  const [pane, setPane] = useState<Pane>('action');
  const [watching, setWatching] = useState(false);
  const near = useMemo(() => readyNeighbors(videos.data ?? [], videoId), [videos.data, videoId]);

  const back = from ?? paths.topic(topic.id, 'dashboard');
  const backLabel = from?.includes('/drafts') ? '작업 목록' : '영상 목록';
  const state: TaskFrom = { from: back };
  const d = detail.data;

  return (
    <div className="rd-page rd-task">
      <div className="rd-task-top">
        {/* 돌아가면 목록에서 보던 곳으로 (RD-29) */}
        <Link to={back} state={RESTORE_SCROLL} className="dk-btn dk-btn-ghost dk-btn-sm rd-task-back">
          <Icon name="arrowLeft" size={16} />
          {backLabel}
        </Link>
        <nav aria-label="게시 대기 넘기기" className="rd-row-tight">
          <span className="text-caption rd-muted">
            {near.index ? (
              <>
                게시 대기 <b className="tnum rd-ink">{near.index}</b> / {near.total}
              </>
            ) : (
              <>게시 대기 {near.total}개</>
            )}
          </span>
          <PagerLink to={near.prev ? paths.video(topic.id, near.prev.id) : null} state={state} label="이전 게시 대기 영상" icon="chevronLeft" />
          <PagerLink to={near.next ? paths.video(topic.id, near.next.id) : null} state={state} label="다음 게시 대기 영상" icon="chevronRight" />
        </nav>
      </div>

      {detail.isPending ? <LoadingBox>작업을 불러오는 중…</LoadingBox> : null}
      {detail.error ? <ErrorBand error={detail.error} onRetry={() => void detail.refetch()} /> : null}

      {d ? (
        <>
          <TaskHead detail={d} />

          <Tabs
            className="rd-task-tabs"
            label="작업 상세 나누기"
            value={pane}
            onChange={(v) => setPane(v as Pane)}
            items={[
              { value: 'evidence', label: '판단 근거' },
              { value: 'action', label: '초안 · 게시' },
            ]}
          />

          <div className="rd-task-cols">
            <section aria-label="판단 근거" className={`rd-task-col${pane === 'evidence' ? '' : ' is-off'}`}>
              <div className="rd-colh">
                <em>A</em>판단 근거
              </div>
              <EvidencePanel detail={d} onWatch={() => setWatching(true)} />
            </section>
            <section aria-label="초안과 게시" className={`rd-task-col${pane === 'action' ? '' : ' is-off'}`}>
              <div className="rd-colh">
                <em>B</em>초안 · 게시
              </div>
              <DraftCard topic={topic} detail={d} />
              {d.draft?.state === 'ready' || d.video.commented ? (
                <PostControl
                  key={`${d.video.id}:${d.attempts[0]?.id ?? 0}`}
                  topic={topic}
                  video={d.video}
                  attempts={d.attempts}
                  next={
                    near.next ? (
                      <Link to={paths.video(topic.id, near.next.id)} state={state} className="dk-btn dk-btn-primary dk-btn-md rd-next-btn">
                        <span className="rd-clamp-1">다음 영상 · {near.next.title}</span>
                        <Icon name="arrowRight" size={16} />
                      </Link>
                    ) : (
                      <Link to={back} state={RESTORE_SCROLL} className="dk-btn dk-btn-primary dk-btn-md">
                        {backLabel}으로
                        <Icon name="arrowRight" size={16} />
                      </Link>
                    )
                  }
                />
              ) : null}
              <History topic={topic} attempts={d.attempts} />
            </section>
          </div>
        </>
      ) : null}

      <VideoModal topicId={topic.id} video={watching && d ? d.video : null} onClose={() => setWatching(false)} />
    </div>
  );
}

/**
 * 앞뒤 넘기기 단추 (갈 곳이 없으면 눌리지 않는 모양)
 * @param props.to 갈 주소 (없으면 null)
 * @param props.state 넘길 값 (돌아갈 곳)
 * @param props.label 이름
 * @param props.icon 아이콘
 */
function PagerLink({ to, state, label, icon }: { to: string | null; state: TaskFrom; label: string; icon: 'chevronLeft' | 'chevronRight' }) {
  if (!to) {
    return (
      <span className="rd-pg is-disabled" aria-disabled="true" aria-label={label} role="link">
        <Icon name={icon} size={16} />
      </span>
    );
  }
  return (
    <Link to={to} state={state} className="rd-pg" aria-label={label}>
      <Icon name={icon} size={16} />
    </Link>
  );
}

/**
 * 작업 머리: 제목 · 채널 · 올린 때 · 조회수 · 길이 · 내 채널/다른 채널 · 유튜브에서 보기
 * @param props.detail 작업
 */
function TaskHead({ detail }: { detail: DraftDetail }) {
  const v = detail.video;
  return (
    <header className="rd-task-head">
      <h1 className="text-display rd-task-title">{v.title}</h1>
      <div className="rd-task-meta text-caption">
        <span className="rd-ink text-body-strong">{v.channelTitle}</span>
        <span aria-hidden="true">·</span>
        <span>{relativeTime(v.publishedAt)} 올라옴</span>
        <span aria-hidden="true">·</span>
        <span>
          조회수 <span className="text-mono">{v.viewCount.toLocaleString('ko-KR')}</span>회
        </span>
        <span aria-hidden="true">·</span>
        <span className="text-mono">{formatDuration(v.durationSec)}</span>
        {v.isMine ? <Badge tone="accent">내 채널</Badge> : <Badge>다른 채널</Badge>}
        <a href={v.url} target="_blank" rel="noreferrer" className="rd-task-yt">
          유튜브에서 보기
          <Icon name="external" size={14} />
        </a>
      </div>
    </header>
  );
}

/**
 * 이 영상의 게시 기록 (최근 순)
 * @param props.topic 주제
 * @param props.attempts 게시 기록
 */
function History({ topic, attempts }: { topic: Topic; attempts: DraftDetail['attempts'] }) {
  if (attempts.length === 0) return null;
  return (
    <div className="rd-card rd-stack-8">
      <h2 className="text-label rd-ink" style={{ margin: 0 }}>
        이 영상의 게시 기록
      </h2>
      <ul className="rd-hist">
        {attempts.map((a) => (
          <li key={a.id}>
            <Link to={paths.topic(topic.id, 'logs')} className="rd-hist-row">
              <span className="text-mono rd-muted">{formatLogTime(a.startedAt)}</span>
              <Badge tone={POST_RESULT[a.status].tone} loading={a.status === 'running'}>
                {POST_RESULT[a.status].label}
              </Badge>
              <span className="text-caption rd-muted rd-clamp-1">{a.failureReason ?? (a.commentUrl ? '댓글이 올라갔어요' : '')}</span>
              <Icon name="chevronRight" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
