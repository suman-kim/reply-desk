import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  useActions,
  useDraftDetail,
  useSearchStatus,
  useToday,
  useTopics,
  useVideos,
} from '../api/queries';
import type { Topic } from '../api/types';
import { videoBadges } from '../components/badges';
import { DraftReview } from '../components/DraftReview';
import { PostControl } from '../components/PostControl';
import { VideoModal, type ModalVideo } from '../components/VideoModal';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Button, Field, Panel, StatPill, TopicItem, VideoCard } from '../ds/inyeon';
import { formatDuration, formatViews, relativeTime } from '../lib/format';
import { searchRunText, searchStatusText } from '../lib/search-text';

/** ①②③ 단계 번호 */
type Step = 1 | 2 | 3;

/** 단계 이름과 한 줄 설명 (단계 표시줄·이전/다음 버튼) */
const STEPS: { n: Step; title: string; hint: string }[] = [
  { n: 1, title: '영상 불러오기', hint: '키워드로 영상을 모으고 초안까지 써 둬요' },
  { n: 2, title: '영상 선택', hint: '고른 이유와 초안을 보고 고쳐요' },
  { n: 3, title: '댓글 달기', hint: '크롬으로 한 글자씩 입력해 게시해요' },
];

/**
 * 대시보드: 주제 사이드바 · ①②③ 단계(한 번에 한 화면, 이전·다음으로 넘김) (계획서 '화면 구조').
 * 댓글 게시 결과는 따로 '댓글 게시 목록' 메뉴(LogsPage)에 둔다.
 * 고른 주제·영상·단계는 주소(?topic=&video=&step=)에 담아, 새로 고쳐도 같은 화면이 열린다.
 */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const topics = useTopics();
  const topicId = Number(params.get('topic')) || topics.data?.[0]?.id || null;
  const videoId = Number(params.get('video')) || null;
  const stepParam = Number(params.get('step'));
  const step: Step = stepParam === 2 || stepParam === 3 ? stepParam : 1;
  const topic = topics.data?.find((t) => t.id === topicId) ?? null;

  /**
   * 주소의 값을 바꾼다. 주제를 바꾸면 영상과 단계는 처음으로.
   * @param next.topic 주제
   * @param next.video 영상 (null이면 고르지 않음)
   * @param next.step 단계
   */
  const select = (next: { topic?: number; video?: number | null; step?: Step }) => {
    const p = new URLSearchParams(params);
    if (next.topic !== undefined) {
      p.set('topic', String(next.topic));
      p.delete('video');
      p.delete('step');
    }
    if (next.video !== undefined) {
      if (next.video) p.set('video', String(next.video));
      else p.delete('video');
    }
    if (next.step !== undefined) {
      if (next.step === 1) p.delete('step');
      else p.set('step', String(next.step));
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
          {topic ? (
            <TopicWorkspace
              topic={topic}
              videoId={videoId}
              step={step}
              onSelectVideo={(id) => select({ video: id })}
              onPickVideo={(id) => select({ video: id, step: 2 })}
              onStep={(n) => select({ step: n })}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

/**
 * 고른 주제의 일하는 자리: 주제 머리 · 운영 규칙 · 단계 표시줄 · 지금 단계 화면 · 이전/다음 (게시 결과는 '댓글 게시 목록' 메뉴)
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 * @param props.step 지금 단계
 * @param props.onSelectVideo 영상을 고를 때 (단계는 그대로)
 * @param props.onPickVideo ①에서 카드를 눌러 고를 때 (②로 넘어간다)
 * @param props.onStep 단계를 바꿀 때
 */
function TopicWorkspace({
  topic,
  videoId,
  step,
  onSelectVideo,
  onPickVideo,
  onStep,
}: {
  topic: Topic;
  videoId: number | null;
  step: Step;
  onSelectVideo: (id: number | null) => void;
  onPickVideo: (id: number) => void;
  onStep: (n: Step) => void;
}) {
  const { updateTopic } = useActions();
  const today = useToday();
  const videos = useVideos(topic.id);
  const selected = videos.data?.find((v) => v.id === videoId) ?? null;
  /** 영상 보기 창에 띄운 영상 (①의 [영상 보기], ② 머리의 [영상 보기]) */
  const [watching, setWatching] = useState<ModalVideo | null>(null);

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

      <StepBar topic={topic} videoId={selected?.id ?? null} videoCount={videos.data?.length ?? null} step={step} onStep={onStep} />

      {step === 1 ? <LoadPanel topic={topic} selectedId={selected?.id ?? null} onSelect={onPickVideo} onWatch={setWatching} /> : null}
      {step === 2 ? <SelectPanel topic={topic} videoId={selected?.id ?? null} onWatch={setWatching} /> : null}
      {step === 3 ? <PostPanel topic={topic} videoId={selected?.id ?? null} /> : null}

      <StepNav step={step} canGo={(n) => n === 1 || !!selected} onStep={onStep} />

      <VideoModal topicId={topic.id} video={watching} onClose={() => setWatching(null)} />
    </>
  );
}

/**
 * 단계 표시줄: ① ② ③을 한 줄에 두고, 단계마다 지금 상태를 한 줄로 보인다. 눌러서 바로 옮길 수 있다.
 * 영상을 고르기 전에는 ②·③이 잠긴다.
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 * @param props.videoCount 불러온 영상 수 (불러오기 전 null)
 * @param props.step 지금 단계
 * @param props.onStep 단계를 바꿀 때
 */
function StepBar({
  topic,
  videoId,
  videoCount,
  step,
  onStep,
}: {
  topic: Topic;
  videoId: number | null;
  videoCount: number | null;
  step: Step;
  onStep: (n: Step) => void;
}) {
  const detail = useDraftDetail(topic.id, videoId);
  const title = detail.data?.video.title;
  /** 단계마다 지금 상태 한 줄 */
  const status: Record<Step, string> = {
    1: videoCount === null ? '불러오는 중…' : videoCount > 0 ? `영상 ${videoCount}개` : '아직 불러오지 않음',
    2: !videoId ? '영상을 골라 주세요' : (title ?? '불러오는 중…'),
    3: !videoId ? '영상을 골라 주세요' : (detail.data?.status?.label ?? (detail.data?.draft ? '초안 확인' : '초안 없음')),
  };

  return (
    <nav aria-label="단계" className="rd-stepbar">
      {STEPS.map((s) => {
        const locked = s.n !== 1 && !videoId;
        const state = s.n === step ? 'is-current' : s.n < step ? 'is-done' : '';
        return (
          <button
            key={s.n}
            type="button"
            className={`rd-stepbar-item ${state}`}
            aria-current={s.n === step ? 'step' : undefined}
            disabled={locked}
            title={locked ? '①에서 영상을 먼저 골라 주세요' : s.hint}
            onClick={() => onStep(s.n)}
          >
            <span className="rd-stepbar-num">{s.n}</span>
            <span className="rd-stepbar-text">
              <span className="text-body-strong">{s.title}</span>
              <span className="text-caption rd-stepbar-status">{status[s.n]}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * 이전·다음 버튼. 다음으로 갈 수 없으면 이유를 한 줄로 보인다.
 * 단계의 주요 버튼(영상 불러오기, 댓글 달기)보다 눈에 덜 띄게 보조 버튼으로 둔다.
 * @param props.step 지금 단계
 * @param props.canGo 그 단계로 갈 수 있는지
 * @param props.onStep 단계를 바꿀 때
 */
function StepNav({ step, canGo, onStep }: { step: Step; canGo: (n: Step) => boolean; onStep: (n: Step) => void }) {
  const prev = STEPS.find((s) => s.n === step - 1);
  const next = STEPS.find((s) => s.n === step + 1);
  const nextBlocked = next && !canGo(next.n);
  return (
    <div className="rd-stepnav">
      <div>
        {prev ? (
          <Button variant="ghost" onClick={() => onStep(prev.n)}>
            ← 이전 · {prev.title}
          </Button>
        ) : null}
      </div>
      <div className="rd-stepnav-next">
        {nextBlocked ? <span className="text-caption rd-block-reason">영상을 먼저 골라 주세요</span> : null}
        {next ? (
          <Button variant="secondary" disabled={nextBlocked} onClick={() => onStep(next.n)}>
            다음 · {next.title} →
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** ① 목록을 한 번에 그리는 카드 수 (무제한으로 불러와도 화면이 무겁지 않게 [더 보기]로 늘린다) */
const PAGE_SIZE = 30;

/**
 * ① 영상 불러오기: 영상만 불러온다(초안은 ②에서). 검색에 안 나온 영상은 링크로 추가한다.
 * 카드를 누르면 그 영상으로 ② 영상 선택으로 넘어가고, 카드의 [영상 보기]는 이 화면에서 영상과 댓글을 띄운다.
 * @param props.topic 주제
 * @param props.selectedId 고른 영상
 * @param props.onSelect 카드를 누르거나 링크로 추가해 영상을 고를 때 (②로 넘어간다)
 * @param props.onWatch 영상 보기 창을 열 때
 */
function LoadPanel({
  topic,
  selectedId,
  onSelect,
  onWatch,
}: {
  topic: Topic;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onWatch: (v: ModalVideo) => void;
}) {
  const { load, addVideo } = useActions();
  const videos = useVideos(topic.id);
  /** 누르기 전 검색 상태 (저장된 목록인지, 새 영상만 찾는지) */
  const searchStatus = useSearchStatus(topic.id);
  /** 마지막 [영상 불러오기]의 검색 결과 (방식·새 영상 수·쓴 할당량) */
  const lastRun = load.data?.search ?? null;
  /**
   * [영상 불러오기] (force면 [새로 검색])
   * @param force 최근에 검색했어도 다시 검색할지
   */
  const runLoad = (force: boolean) => load.mutate({ topicId: topic.id, force }, { onSuccess: () => setShown(PAGE_SIZE) });
  const [shown, setShown] = useState(PAGE_SIZE);
  /** 링크로 추가할 주소 (검색에 안 걸린 영상) */
  const [link, setLink] = useState('');

  // 링크로 넣은 영상은 목록에 더하고, 바로 골라 ②로 넘어간다
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
  const has = (videos.data?.length ?? 0) > 0;
  const sortLabel = topic.videoSortBy === 'date' ? '최신순' : '조회수 높은 순';
  const countLabel = topic.fetchLimit > 0 ? `상위 ${topic.fetchLimit}개` : '검색 결과 끝까지(최대 500개)';

  const label = load.isPending ? '영상 불러오는 중…' : load.error ? '다시 시도' : has ? '다시 불러오기' : '영상 불러오기';

  return (
    <Panel
      step={1}
      title="영상 불러오기"
      hint={`'${topic.keywords[0] ?? ''}' 등 ${topic.videoWindowDays > 0 ? `${topic.videoWindowDays === 1 ? '24시간' : `${topic.videoWindowDays}일`} 안에 올라온` : '올린 날짜와 상관없이'} 영상을 ${sortLabel}으로 ${countLabel} 가져와요 · 초안은 ② 영상 선택에서 써요`}
    >
      <Button
        variant="primary"
        fullWidth
        loading={load.isPending}
        disabled={topic.status === 'paused'}
        onClick={() => runLoad(false)}
      >
        {label}
      </Button>
      {/* 유튜브 할당량: 지금 누르면 검색하는지 미리 알리고, 저장된 목록일 때는 [새로 검색]을 둔다 */}
      {searchStatus.data && !load.isPending ? (
        <div className="rd-search-note text-caption">
          <span className="rd-muted">{searchStatusText(searchStatus.data)}</span>
          {searchStatus.data.nextMode === 'cached' && topic.status !== 'paused' ? (
            <button type="button" className="rd-link-button" onClick={() => runLoad(true)}>
              새로 검색
            </button>
          ) : null}
        </div>
      ) : null}
      {lastRun && !load.isPending ? (
        <div className={`rd-band ${lastRun.mode === 'cached' ? 'rd-band-accent' : 'rd-band-success'}`} role="status">
          <span className="text-body-sm">{searchRunText(lastRun)}</span>
        </div>
      ) : null}
      {topic.status === 'paused' ? <span className="text-caption rd-block-reason">일시정지된 주제예요 · 다시 시작하면 불러올 수 있어요</span> : null}
      {load.error ? <ErrorBand error={load.error} /> : null}
      <Field
        label="링크로 영상 추가"
        value={link}
        placeholder="https://www.youtube.com/watch?v=… (검색에 안 나온 영상)"
        onChange={(e) => setLink(e.target.value)}
        hint="넣으면 목록에 더하고 그 영상으로 ② 영상 선택으로 넘어가요"
        error={addVideo.error?.message}
        action={
          <Button variant="secondary" loading={addVideo.isPending} disabled={link.trim().length === 0} onClick={add}>
            추가
          </Button>
        }
      />
      {has ? (
        <div className="rd-list-head">
          <span className="text-caption rd-muted">{videos.data!.length}개 영상 · 카드를 누르면 ② 영상 선택으로 넘어가요</span>
          <span className="text-caption rd-ink2" style={{ fontWeight: 600 }}>
            {sortLabel}
          </span>
        </div>
      ) : null}
      {videos.isPending ? <LoadingBox>영상 목록을 불러오는 중…</LoadingBox> : null}
      {videos.error ? <ErrorBand error={videos.error} onRetry={() => void videos.refetch()} /> : null}
      {videos.data && !has ? <EmptyBox>[영상 불러오기]를 누르면 영상 목록이 여기 떠요</EmptyBox> : null}
      <div className="rd-video-grid">
        {videos.data?.slice(0, shown).map((v) => (
          <div key={v.id} className="rd-video-cell">
            <VideoCard
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
            <button type="button" className="rd-video-watch" aria-label={`${v.title} 영상 보기`} onClick={() => onWatch(v)}>
              ▶ 영상 보기
            </button>
          </div>
        ))}
      </div>
      {videos.data && videos.data.length > shown ? (
        <Button variant="secondary" fullWidth onClick={() => setShown((n) => n + PAGE_SIZE)}>
          {Math.min(PAGE_SIZE, videos.data.length - shown)}개 더 보기 ({shown}/{videos.data.length})
        </Button>
      ) : null}
    </Panel>
  );
}

/**
 * ② 영상 선택: 고른 영상의 이유·고민·근거 장면·초안·검사. 초안이 없으면 [초안 작성]으로 이때 쓴다.
 * 영상 고르기·링크로 추가하기는 ①에서 한다.
 * @param props.topic 주제
 * @param props.videoId 고른 영상
 * @param props.onWatch 영상 보기 창을 열 때
 */
function SelectPanel({ topic, videoId, onWatch }: { topic: Topic; videoId: number | null; onWatch: (v: ModalVideo) => void }) {
  const detail = useDraftDetail(topic.id, videoId);
  const v = detail.data?.video;

  return (
    <Panel step={2} title="영상 선택" hint="고른 영상의 고른 이유와 초안을 보고 고쳐요 · 다른 영상은 ①에서 골라요">
      {!videoId ? (
        <EmptyBox>영상을 고르면 고른 이유, 영상 속 고민 한 줄, 댓글 초안과 그렇게 쓴 이유가 여기 보여요</EmptyBox>
      ) : detail.isPending ? (
        <LoadingBox />
      ) : detail.error ? (
        <ErrorBand error={detail.error} onRetry={() => void detail.refetch()} />
      ) : v ? (
        <>
          <div className="rd-video-head">
            <div className="rd-stack" style={{ minWidth: 0 }}>
              <a href={v.url} target="_blank" rel="noreferrer" className="text-body-strong" style={{ fontSize: 15, color: 'var(--ink)' }}>
                {v.title}
              </a>
              <span className="text-caption rd-muted">
                {v.channelTitle} · {relativeTime(v.publishedAt)} · {formatViews(v.viewCount)}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onWatch(v)}>
              ▶ 영상 보기
            </Button>
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
