import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  useActions,
  useDraftDetail,
  useDraftProgress,
  useLogs,
  useToday,
  useTopics,
  useVideos,
} from '../api/queries';
import type { Topic } from '../api/types';
import { videoBadges } from '../components/badges';
import { DraftReview } from '../components/DraftReview';
import { PostControl } from '../components/PostControl';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Field, LogTable, Panel, Segmented, StatPill, TopicItem, VideoCard } from '../ds/inyeon';
import { formatDuration, formatLogTime, formatViews, relativeTime } from '../lib/format';

/**
 * 대시보드: 헤더 · 주제 사이드바 · ①②③ 세 칸 · 게시 기록 (계획서 '화면 구조')
 * 고른 주제와 영상은 주소(?topic=&video=)에 담아, 새로 고쳐도 같은 화면이 열린다.
 */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const topics = useTopics();
  const topicId = Number(params.get('topic')) || topics.data?.[0]?.id || null;
  const videoId = Number(params.get('video')) || null;
  const topic = topics.data?.find((t) => t.id === topicId) ?? null;

  /** 주소의 값을 바꾼다 */
  const select = (next: { topic?: number; video?: number | null }) => {
    const p = new URLSearchParams(params);
    if (next.topic !== undefined) {
      p.set('topic', String(next.topic));
      p.delete('video');
    }
    if (next.video !== undefined) {
      if (next.video) p.set('video', String(next.video));
      else p.delete('video');
    }
    setParams(p, { replace: true });
  };

  return (
    <div className="rd-page">
      <div className="rd-layout">
        <aside aria-label="주제 목록" className="rd-sidebar">
          <div className="rd-sidebar-head">
            <span className="text-label rd-ink2">주제</span>
            {topics.data ? <span className="text-caption rd-muted">{topics.data.length}개</span> : null}
          </div>
          {topics.isPending ? <LoadingBox>주제를 불러오는 중…</LoadingBox> : null}
          {topics.error ? <ErrorBand error={topics.error} onRetry={() => void topics.refetch()} /> : null}
          {topics.data?.map((t) => (
            <TopicItem
              key={t.id}
              name={t.name}
              meta={`오늘 ${t.postedToday}/${t.dailyCap} · 초안 ${t.pendingDrafts}`}
              status={t.status}
              selected={t.id === topicId}
              count={t.pendingDrafts}
              onClick={() => select({ topic: t.id })}
            />
          ))}
          <Link to="/topics/new" className="iy-btn iy-btn-dashed iy-btn-md iy-btn-block" style={{ marginTop: 8, textDecoration: 'none' }}>
            + 새 주제
          </Link>
        </aside>

        <main className="rd-main">
          {topics.data && topics.data.length === 0 ? (
            <EmptyBox>
              아직 주제가 없어요
              <br />
              홍보할 대상 하나가 주제 하나예요 · 왼쪽 [+ 새 주제]로 만들어 주세요
            </EmptyBox>
          ) : null}
          {topic ? <TopicWorkspace topic={topic} videoId={videoId} onSelectVideo={(id) => select({ video: id })} /> : null}
        </main>
      </div>
    </div>
  );
}

/**
 * 고른 주제의 일하는 자리: 주제 머리 · 운영 규칙 · ①②③ · 게시 기록
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 * @param props.onSelectVideo 영상을 고를 때
 */
function TopicWorkspace({ topic, videoId, onSelectVideo }: { topic: Topic; videoId: number | null; onSelectVideo: (id: number | null) => void }) {
  const { updateTopic } = useActions();
  const today = useToday();
  const videos = useVideos(topic.id);
  const selected = videos.data?.find((v) => v.id === videoId) ?? null;

  // 영상이 있는데 고른 것이 없거나 목록에 없으면 1위 영상을 고른다 (계획서: 준비 완료 → 1위 영상 자동 선택)
  useEffect(() => {
    const list = videos.data;
    if (list && list.length > 0 && !list.some((v) => v.id === videoId)) onSelectVideo(list[0].id);
  }, [videoId, videos.data, onSelectVideo]);

  return (
    <>
      <section aria-label="선택한 주제" className="rd-topic-head">
        <div className="rd-topic-title">
          <div className="rd-row">
            <h2 className="text-title">{topic.name}</h2>
            <Badge dot tone={topic.status === 'active' ? 'success' : 'neutral'}>
              {topic.status === 'active' ? '진행 중' : '일시정지'}
            </Badge>
          </div>
          <span className="text-body-sm rd-ink2">유도 대상 · {topic.brandTarget}</span>
          <div className="rd-row-tight">
            <span className="text-caption rd-muted">검색 키워드</span>
            {topic.keywords.map((k) => (
              <Badge key={k}>{k}</Badge>
            ))}
          </div>
        </div>
        <div className="rd-row">
          <StatPill label="이 주제 오늘" value={topic.postedToday} max={topic.dailyCap} />
          <Link to={`/topics/${topic.id}/edit`} className="iy-btn iy-btn-secondary iy-btn-md">
            주제 설정
          </Link>
        </div>
      </section>

      <p className="text-caption rd-rules">
        <strong>운영 규칙</strong> · 영상당 댓글 1개(전체 기준){today.data ? ` · 하루 전체 ${today.data.cap}개` : ''} · 다른 채널 영상은 맨 앞에 {topic.adDisclosure} · 성공·실패 모두 기록
      </p>

      {topic.status === 'paused' ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-strong">일시정지된 주제예요. 게시가 멈춰 있어요.</span>
          <Button
            size="sm"
            variant="secondary"
            loading={updateTopic.isPending}
            onClick={() => updateTopic.mutate({ id: topic.id, input: { status: 'active' } })}
          >
            다시 시작
          </Button>
        </div>
      ) : null}

      <div className="rd-columns">
        <div className="rd-col-1">
          <LoadPanel topic={topic} selectedId={selected?.id ?? null} onSelect={onSelectVideo} />
        </div>
        <div className="rd-col-2">
          <SelectPanel topic={topic} videoId={selected?.id ?? null} onSelect={onSelectVideo} />
        </div>
        <div className="rd-col-3">
          <PostPanel topic={topic} videoId={selected?.id ?? null} />
        </div>
      </div>

      <LogPanel topicId={topic.id} />
    </>
  );
}

/**
 * ① 영상 불러오기
 * @param props.topic 주제
 * @param props.selectedId 고른 영상
 * @param props.onSelect 영상을 고를 때
 */
function LoadPanel({ topic, selectedId, onSelect }: { topic: Topic; selectedId: number | null; onSelect: (id: number) => void }) {
  const { load } = useActions();
  const videos = useVideos(topic.id);
  const progress = useDraftProgress(topic.id);
  const p = progress.data;
  const drafting = !!p?.running;
  const has = (videos.data?.length ?? 0) > 0;
  const sortLabel = topic.videoSortBy === 'date' ? '최신순' : '조회수 높은 순';

  const label = load.isPending
    ? '최신 영상 불러오는 중…'
    : drafting
      ? `초안 자동 작성 중 (${p!.done}/${p!.total})`
      : load.error
        ? '다시 시도'
        : has
          ? '다시 불러오기'
          : '영상 불러오기';

  return (
    <Panel
      step={1}
      title="영상 불러오기"
      hint={`'${topic.keywords[0] ?? ''}' 등 ${topic.videoWindowDays > 0 ? `최근 ${topic.videoWindowDays}일` : '기간 제한 없이'} 영상을 ${sortLabel}으로 정렬하고, 초안까지 자동으로 써둬요`}
    >
      <Button variant="primary" fullWidth loading={load.isPending || drafting} disabled={topic.status === 'paused'} onClick={() => load.mutate(topic.id)}>
        {label}
      </Button>
      {topic.status === 'paused' ? <span className="text-caption rd-block-reason">일시정지된 주제예요 · 다시 시작하면 불러올 수 있어요</span> : null}
      {load.error ? <ErrorBand error={load.error} /> : null}
      {p && !p.running && p.failed > 0 ? (
        <span className="text-caption rd-muted">
          초안 {p.failed}개는 쓰지 못했어요 · 카드를 눌러 원인을 확인하세요
        </span>
      ) : null}
      {has ? (
        <div className="rd-list-head">
          <span className="text-caption rd-muted">{videos.data!.length}개 영상</span>
          <span className="text-caption rd-ink2" style={{ fontWeight: 600 }}>
            {sortLabel}
          </span>
        </div>
      ) : null}
      {videos.isPending ? <LoadingBox>영상 목록을 불러오는 중…</LoadingBox> : null}
      {videos.error ? <ErrorBand error={videos.error} onRetry={() => void videos.refetch()} /> : null}
      {videos.data && !has ? <EmptyBox>[영상 불러오기]를 누르면 영상 목록이 여기 떠요</EmptyBox> : null}
      <div className="rd-stack">
        {videos.data?.map((v) => (
          <VideoCard
            key={v.id}
            rank={v.rank ?? '+'}
            title={v.title}
            channel={v.channelTitle}
            date={relativeTime(v.publishedAt)}
            views={formatViews(v.viewCount)}
            duration={formatDuration(v.durationSec)}
            thumbnail={v.thumbnailUrl ?? undefined}
            selected={v.id === selectedId}
            badges={videoBadges(v)}
            onClick={() => onSelect(v.id)}
          />
        ))}
      </div>
    </Panel>
  );
}

/**
 * ② 영상 선택: 링크 직접 입력 + 고른 영상의 이유·초안·검사
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 * @param props.onSelect 링크로 추가한 영상을 고른다
 */
function SelectPanel({ topic, videoId, onSelect }: { topic: Topic; videoId: number | null; onSelect: (id: number) => void }) {
  const { addVideo } = useActions();
  const [link, setLink] = useState('');
  const detail = useDraftDetail(topic.id, videoId);
  const v = detail.data?.video;

  const add = () =>
    addVideo.mutate(
      { topicId: topic.id, url: link },
      {
        onSuccess: (added) => {
          setLink('');
          onSelect(added.id);
        },
      },
    );

  return (
    <Panel step={2} title="영상 선택" hint="목록에서 고르거나 링크를 직접 넣으세요">
      <Field
        label="링크 직접 입력"
        value={link}
        placeholder="https://www.youtube.com/watch?v=…"
        onChange={(e) => setLink(e.target.value)}
        error={addVideo.error?.message}
        action={
          <Button variant="secondary" loading={addVideo.isPending} disabled={link.trim().length === 0} onClick={add}>
            추가
          </Button>
        }
      />
      <div className="rd-divider" />
      {!videoId ? (
        <EmptyBox>영상을 고르면 고른 이유, 영상 속 고민 한 줄, 댓글 초안과 그렇게 쓴 이유가 여기 보여요</EmptyBox>
      ) : detail.isPending ? (
        <LoadingBox />
      ) : detail.error ? (
        <ErrorBand error={detail.error} onRetry={() => void detail.refetch()} />
      ) : v ? (
        <>
          <div className="rd-stack">
            <a href={v.url} target="_blank" rel="noreferrer" className="text-body-strong" style={{ fontSize: 15, color: 'var(--ink)' }}>
              {v.title}
            </a>
            <span className="text-caption rd-muted">
              {v.channelTitle} · {relativeTime(v.publishedAt)} · {formatViews(v.viewCount)}
            </span>
          </div>
          <DraftReview topic={topic} detail={detail.data!} />
        </>
      ) : null}
    </Panel>
  );
}

/**
 * ③ 댓글 달기
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 */
function PostPanel({ topic, videoId }: { topic: Topic; videoId: number | null }) {
  const detail = useDraftDetail(topic.id, videoId);
  return (
    <Panel step={3} title="댓글 달기" hint="크롬 프로필이 열리고 한 글자씩 입력해 게시해요">
      {detail.isPending && videoId ? (
        <LoadingBox />
      ) : (
        <PostControl
          key={`${videoId}:${detail.data?.attempts[0]?.id ?? 0}`}
          topic={topic}
          video={detail.data?.video ?? null}
          attempts={detail.data?.attempts ?? []}
          showBrowser
        />
      )}
    </Panel>
  );
}

/**
 * 게시 기록 (이 주제 / 전체). 게시 중인 행은 ③ 칸에서 보여 주고 여기에는 끝난 것만 둔다.
 * @param props.topicId 주제 ID
 */
function LogPanel({ topicId }: { topicId: number }) {
  const [scope, setScope] = useState<'topic' | 'all'>('topic');
  const [openId, setOpenId] = useState<string | null>(null);
  const logs = useLogs(scope === 'topic' ? topicId : null);
  const rows = useMemo(
    () =>
      (logs.data ?? [])
        .filter((r) => r.status !== 'running')
        .map((r) => ({
          id: String(r.id),
          time: formatLogTime(r.startedAt),
          topic: scope === 'all' ? (r.topic?.name ?? '지운 주제') : undefined,
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
    [logs.data, scope],
  );

  return (
    <div id="log" style={{ scrollMarginTop: 24 }}>
      <Panel title="게시 기록" hint="어느 영상에, 어느 프로필로, 무슨 댓글을 달았는지 결과까지 최근 순으로 보여줘요">
        <div>
          <Segmented
            label="기록 범위"
            value={scope}
            onChange={(v) => setScope(v as 'topic' | 'all')}
            options={[
              { value: 'topic', label: '이 주제' },
              { value: 'all', label: '전체' },
            ]}
          />
        </div>
        {logs.error ? <ErrorBand error={logs.error} onRetry={() => void logs.refetch()} /> : null}
        <LogTable
          rows={rows}
          // 캡처가 있는 기록이 있을 때만 [캡처 보기]를 둔다 (표는 실패 행마다 버튼을 붙인다)
          onCapture={rows.some((r) => r.capture) ? (row) => setOpenId(openId === row.id ? null : row.id) : undefined}
          openCaptureId={openId}
          emptyText={logs.isPending ? '불러오는 중…' : '아직 기록이 없어요 · ③에서 [댓글 달기]를 누르면 여기 쌓여요'}
        />
      </Panel>
    </div>
  );
}
