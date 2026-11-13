import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useActions, useLogs, useSearchStatus, useVideos } from '../api/queries';
import type { Topic, VideoItem } from '../api/types';
import { inVideoFilter, isReadyToPost, videoStatus, type VideoFilter } from '../components/badges';
import { Icon } from '../components/Icon';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { VideoModal, type ModalVideo } from '../components/VideoModal';
import { Badge, Button, Chips, Glyph, Keyword, MatchBar, Segmented, StatPill } from '../ds';
import { formatDuration, formatLogTime, relativeTime } from '../lib/format';
import { searchRunText, searchStatusText } from '../lib/search-text';
import { topicTone } from '../lib/topic-tone';
import { PAGE_SIZE, sortVideos, type VideoSort } from '../lib/video-order';
import { legacyDashboardPath, paths } from '../nav/paths';
import { useRouteTopic } from '../nav/route-topic';

/** 보기 방식: 표 · 카드 */
type ViewMode = 'table' | 'cards';

/** 주소의 값 읽기 (모르는 값이면 기본값) */
function pick<T extends string>(v: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/**
 * 대시보드 (/t/:topicId/dashboard): 고른 주제의 '영상' 중심 화면 (RD-26).
 * 위에서부터 주제 머리 · 오늘 일의 흐름(영상 찾기 → 초안 → 댓글 달기 → 결과) · 영상 불러오기 · 영상 목록(표/카드, 정렬, 거르기, 30개씩).
 * 행을 누르면 작업 상세(/t/:topicId/videos/:videoId)로 간다. 정렬·거르기·보기·쪽은 주소에 담아 뒤로 오면 그대로다.
 * 예전 주소(?video=&step=)는 작업 상세로 넘긴다.
 */
export function DashboardPage() {
  const topic = useRouteTopic();
  const location = useLocation();
  const legacy = legacyDashboardPath(topic.id, location.search);
  if (legacy) return <Navigate to={legacy} replace />;
  // 주제를 바꾸면 고른 값도 처음부터 (key)
  return <VideoDashboard key={topic.id} topic={topic} />;
}

/**
 * 대시보드 본문
 * @param props.topic 주제
 */
function VideoDashboard({ topic }: { topic: Topic }) {
  const { updateTopic } = useActions();
  const videos = useVideos(topic.id);
  const [params, setParams] = useSearchParams();
  const sort = pick<VideoSort>(params.get('sort'), ['rel', 'views', 'new'], topic.videoSortBy === 'date' ? 'new' : 'views');
  const filter = pick<VideoFilter>(params.get('filter'), ['all', 'none', 'has', 'done', 'low'], 'all');
  const view = pick<ViewMode>(params.get('view'), ['table', 'cards'], 'table');
  const page = Math.max(1, Number(params.get('page')) || 1);
  /** 영상 보기 창 (썸네일을 누르면) */
  const [watching, setWatching] = useState<ModalVideo | null>(null);

  /**
   * 주소 값 바꾸기 (정렬·거르기를 바꾸면 첫 쪽으로)
   * @param next 바꿀 값
   */
  const setQuery = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    if (!('page' in next)) p.delete('page');
    setParams(p, { replace: true });
  };

  const all = useMemo(() => videos.data ?? [], [videos.data]);
  const sorted = useMemo(() => sortVideos(all, sort), [all, sort]);
  const filtered = useMemo(() => sorted.filter((v) => inVideoFilter(v, filter)), [sorted, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const count = (f: VideoFilter) => all.filter((v) => inVideoFilter(v, f)).length;
  const threshold = all.find((v) => v.topicMatch)?.topicMatch?.threshold ?? 50;

  return (
    <div className="rd-page rd-dash">
      <TopicHead topic={topic} />

      {topic.status === 'paused' ? (
        <div className="rd-band rd-band-warning">
          <span className="text-body-strong">일시정지된 주제예요 · 새 영상을 찾지 않고 게시도 멈춰 있어요</span>
          <Button size="sm" loading={updateTopic.isPending} onClick={() => updateTopic.mutate({ id: topic.id, input: { status: 'active' } })}>
            다시 시작
          </Button>
        </div>
      ) : null}

      <FlowStrip topic={topic} videos={videos.data ?? null} />

      <section id="videos" aria-label="영상" className="rd-stack-12">
        <LoadBar topic={topic} hasVideos={all.length > 0} />

        {all.length > 0 ? (
          <div className="rd-vtools">
            <Chips
              label="거르기"
              value={filter}
              onChange={(v) => setQuery({ filter: v === 'all' ? null : v })}
              items={[
                { value: 'all', label: '전체', count: all.length },
                { value: 'none', label: '초안 없음', count: count('none') },
                { value: 'has', label: '초안 있음', count: count('has') },
                { value: 'done', label: '게시 완료', count: count('done') },
                { value: 'low', label: '매칭 낮음', count: count('low') },
              ]}
            />
            <div className="rd-row">
              <Segmented
                label="정렬"
                value={sort}
                onChange={(v) => setQuery({ sort: v })}
                options={[
                  { value: 'rel', label: '관련도' },
                  { value: 'views', label: '조회수' },
                  { value: 'new', label: '최신' },
                ]}
              />
              <Segmented
                label="보기 방식"
                value={view}
                onChange={(v) => setQuery({ view: v === 'table' ? null : v, page: params.get('page') })}
                options={[
                  { value: 'table', label: <span className="rd-seg-icon"><Icon name="rows" size={16} /><span className="dk-sr">표로 보기</span></span> },
                  { value: 'cards', label: <span className="rd-seg-icon"><Icon name="grid" size={16} /><span className="dk-sr">카드로 보기</span></span> },
                ]}
              />
            </div>
          </div>
        ) : null}

        {videos.isPending ? <LoadingBox>영상 목록을 불러오는 중…</LoadingBox> : null}
        {videos.error ? <ErrorBand error={videos.error} onRetry={() => void videos.refetch()} /> : null}
        {videos.data && all.length === 0 ? (
          <EmptyBox>
            아직 불러온 영상이 없어요
            <br />
            [영상 불러오기]를 누르면 검색어로 영상을 모아 여기 보여 줘요
          </EmptyBox>
        ) : null}
        {all.length > 0 && filtered.length === 0 ? (
          <div className="rd-box rd-stack-8" style={{ alignItems: 'center' }}>
            <span className="text-body-strong" style={{ color: 'var(--ink)' }}>
              이 거르기에 맞는 영상이 없어요
            </span>
            <Button size="sm" onClick={() => setQuery({ filter: null })}>
              거르기 풀기
            </Button>
          </div>
        ) : null}

        {rows.length > 0 && view === 'table' ? (
          <VideoTable topic={topic} rows={rows} offset={(current - 1) * PAGE_SIZE} threshold={threshold} onWatch={setWatching} />
        ) : null}
        {rows.length > 0 && view === 'cards' ? (
          <VideoCards topic={topic} rows={rows} offset={(current - 1) * PAGE_SIZE} threshold={threshold} onWatch={setWatching} />
        ) : null}

        {filtered.length > 0 ? (
          <Pager total={filtered.length} page={current} pages={pages} onPage={(n) => setQuery({ page: n === 1 ? null : String(n) })} />
        ) : null}
      </section>

      <VideoModal topicId={topic.id} video={watching} onClose={() => setWatching(null)} />
    </div>
  );
}

/**
 * 주제 머리: 첫 글자 · 이름 · 상태 · 홍보 대상 · 검색어 · 이 주제 오늘 · [주제 설정]
 * @param props.topic 주제
 */
function TopicHead({ topic }: { topic: Topic }) {
  const active = topic.status === 'active';
  return (
    <section aria-label="고른 주제" className="rd-topic-head">
      <div className="rd-topic-title">
        <span className="rd-topic-avatar" style={topicTone(topic.id)} aria-hidden="true">
          {Array.from(topic.name)[0] ?? '?'}
        </span>
        <div className="rd-stack" style={{ gap: 6, minWidth: 0 }}>
          <div className="rd-row">
            <h1 className="text-display" style={{ margin: 0 }}>
              {topic.name}
            </h1>
            <Badge tone={active ? 'success' : 'neutral'}>{active ? '진행 중' : '일시정지'}</Badge>
          </div>
          <div className="rd-row-tight">
            <span className="text-caption rd-muted">홍보 대상 {topic.brandTarget} · 검색어</span>
            {topic.keywords.map((k) => (
              <Keyword key={k}>{k}</Keyword>
            ))}
          </div>
        </div>
      </div>
      <div className="rd-row">
        <StatPill label="이 주제 오늘" value={topic.postedToday} max={topic.dailyCap} />
        <Link to={paths.topic(topic.id, 'settings')} className="dk-btn dk-btn-secondary dk-btn-md">
          <Icon name="topicSettings" size={16} />
          주제 설정
        </Link>
      </div>
    </section>
  );
}

/**
 * 오늘 일의 흐름 (계획안 목표 1): 1 영상 찾기 → 2 초안 확인·고치기 → 3 댓글 달기 → 4 결과 확인.
 * 칸마다 숫자와 한 줄, 누르면 그 일을 하는 곳으로 간다.
 * @param props.topic 주제
 * @param props.videos 영상 목록 (불러오기 전 null)
 */
function FlowStrip({ topic, videos }: { topic: Topic; videos: VideoItem[] | null }) {
  const logs = useLogs(topic.id);
  const list = videos ?? [];
  const drafts = list.filter((v) => inVideoFilter(v, 'has')).length;
  const attention = list.filter((v) => !v.commented && (v.draftState === 'error' || (v.draftState === 'ready' && !v.checkPassed))).length;
  const ready = sortVideos(list, 'rel').filter(isReadyToPost);
  const lastPost = logs.data?.find((l) => l.status === 'success');
  // 오늘(이 컴퓨터 날짜) 실패한 게시
  const today = new Date().toDateString();
  const failedToday = logs.data?.filter((l) => l.status === 'failed' && new Date(l.startedAt).toDateString() === today).length ?? 0;
  const windowText = topic.videoWindowDays > 0 ? (topic.videoWindowDays === 1 ? '24시간 안' : `${topic.videoWindowDays}일 안`) : '기간 제한 없음';

  return (
    <nav aria-label="오늘 일의 흐름" className="rd-flow">
      <a className="rd-flow-step is-first" href="#videos">
        <span className="rd-flow-k">
          <em>1</em>영상 찾기
        </span>
        <span className="rd-flow-v">
          {videos ? list.length.toLocaleString('ko-KR') : '–'}
          <small> 개</small>
        </span>
        <span className="text-caption rd-muted">
          {windowText} · 검색어 {topic.keywords.length}개
        </span>
      </a>
      <Link className="rd-flow-step" to={paths.topic(topic.id, 'drafts')}>
        <span className="rd-flow-k">
          <em>2</em>초안 확인·고치기
        </span>
        <span className="rd-flow-v">
          {drafts}
          <small> 개</small>
        </span>
        {attention > 0 ? <Badge tone="warning">확인 필요 {attention}</Badge> : <span className="text-caption rd-muted">확인할 것 없음</span>}
      </Link>
      <Link className="rd-flow-step" to={ready[0] ? paths.video(topic.id, ready[0].id) : paths.topic(topic.id, 'drafts')}>
        <span className="rd-flow-k">
          <em>3</em>댓글 달기
        </span>
        <span className="rd-flow-v">
          {ready.length}
          <small> 개 대기</small>
        </span>
        <span className="text-caption rd-muted rd-clamp-1">{ready[0] ? `다음: ${ready[0].title}` : '게시 대기 초안이 없어요'}</span>
      </Link>
      <Link className="rd-flow-step" to={paths.topic(topic.id, 'logs')}>
        <span className="rd-flow-k">
          <em>4</em>결과 확인
        </span>
        <span className="rd-flow-v">
          {topic.postedToday}
          <small> / {topic.dailyCap} 게시</small>
        </span>
        <span className="text-caption rd-muted">
          {lastPost ? `마지막 ${formatLogTime(lastPost.startedAt)}` : '아직 게시 기록이 없어요'}
          {failedToday > 0 ? ` · 오늘 실패 ${failedToday}` : ''}
        </span>
      </Link>
    </nav>
  );
}

/**
 * 영상 불러오기 줄: 제목 · 지금 누르면 검색하는지 · 링크로 추가 · [영상 불러오기]
 * @param props.topic 주제
 * @param props.hasVideos 이미 불러온 영상이 있는지
 */
function LoadBar({ topic, hasVideos }: { topic: Topic; hasVideos: boolean }) {
  const navigate = useNavigate();
  const { load, addVideo } = useActions();
  const searchStatus = useSearchStatus(topic.id);
  const lastRun = load.data?.search ?? null;
  const [link, setLink] = useState('');
  const paused = topic.status === 'paused';
  const sortLabel = topic.videoSortBy === 'date' ? '최신순' : '조회수 순';
  const countLabel = topic.fetchLimit > 0 ? `상위 ${topic.fetchLimit}개` : '검색 결과 끝까지(최대 500개)';
  const runLoad = (force: boolean) => load.mutate({ topicId: topic.id, force });
  // 링크로 넣은 영상은 바로 작업 상세로
  const add = () =>
    addVideo.mutate(
      { topicId: topic.id, url: link },
      {
        onSuccess: (added) => {
          setLink('');
          void navigate(paths.video(topic.id, added.id));
        },
      },
    );

  return (
    <div className="rd-stack-8">
      <div className="rd-loadbar">
        <div className="rd-stack" style={{ minWidth: 0 }}>
          <h2 className="text-title" style={{ margin: 0 }}>
            영상
          </h2>
          <span className="text-caption rd-muted">
            검색어로 찾은 영상을 {sortLabel}으로 {countLabel} 모아요 · 행을 누르면 작업 상세로 가요
          </span>
        </div>
        <div className="rd-loadbar-actions">
          <form
            className="rd-linkadd"
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim()) add();
            }}
          >
            <label className="dk-sr" htmlFor="rd-linkadd">
              링크로 영상 추가
            </label>
            <span className="rd-linkadd-icon" aria-hidden="true">
              <Icon name="link" size={16} />
            </span>
            <input
              id="rd-linkadd"
              className="dk-input"
              value={link}
              placeholder="검색에 안 나온 영상 링크 붙여넣기"
              onChange={(e) => setLink(e.target.value)}
            />
            <Button type="submit" loading={addVideo.isPending} disabled={link.trim().length === 0}>
              추가
            </Button>
          </form>
          <Button variant="dark" loading={load.isPending} disabled={paused} leading={<Icon name="refresh" size={16} />} onClick={() => runLoad(false)}>
            {load.isPending ? '불러오는 중…' : hasVideos ? '다시 불러오기' : '영상 불러오기'}
          </Button>
        </div>
      </div>
      {/* 유튜브 할당량: 지금 누르면 검색하는지 미리 알리고, 저장된 목록일 때는 [새로 검색] */}
      {searchStatus.data && !load.isPending ? (
        <div className="rd-search-note text-caption">
          <span className="rd-muted">{searchStatusText(searchStatus.data)}</span>
          {searchStatus.data.nextMode === 'cached' && !paused ? (
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
      {paused ? <span className="text-caption rd-block-reason">일시정지된 주제예요 · 다시 시작하면 불러올 수 있어요</span> : null}
      {load.error ? <ErrorBand error={load.error} /> : null}
      {addVideo.error ? <ErrorBand error={addVideo.error} /> : null}
    </div>
  );
}

/** 행·카드가 함께 쓰는 값 */
interface RowsProps {
  topic: Topic;
  rows: VideoItem[];
  /** 이 쪽 앞의 영상 수 (번호) */
  offset: number;
  /** 주제 매칭 기준 */
  threshold: number;
  onWatch: (v: ModalVideo) => void;
}

/**
 * 영상 상태 칸: 상태 배지 하나(없으면 '초안 없음') + 내 채널
 * @param props.v 영상
 */
function StatusCell({ v }: { v: VideoItem }) {
  const s = videoStatus(v);
  return (
    <span className="rd-row-tight">
      {s ? (
        <Badge tone={s.tone} dot={s.dot} loading={s.loading}>
          {s.label}
        </Badge>
      ) : (
        <span className="text-caption rd-muted">초안 없음</span>
      )}
      {v.isMine ? <Badge tone="accent">내 채널</Badge> : null}
    </span>
  );
}

/**
 * 매칭 칸: 매칭 막대, 분석 전이면 '분석 전'
 * @param props.v 영상
 * @param props.threshold 기준
 */
function MatchCell({ v, threshold }: { v: VideoItem; threshold: number }) {
  return v.topicMatch ? <MatchBar percent={v.topicMatch.percent} threshold={v.topicMatch.threshold ?? threshold} /> : <span className="text-caption rd-muted">분석 전</span>;
}

/**
 * 썸네일 버튼 (누르면 영상 보기 창). 행 전체 링크 위에 떠 있다
 * @param props.v 영상
 * @param props.onWatch 영상 보기
 * @param props.wide 카드처럼 꽉 채울지
 */
function Thumb({ v, onWatch, wide }: { v: VideoItem; onWatch: (v: ModalVideo) => void; wide?: boolean }) {
  return (
    <button type="button" className={`rd-vthumb${wide ? ' is-wide' : ''}`} aria-label={`영상 보기: ${v.title}`} onClick={() => onWatch(v)}>
      {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Glyph name="play" size={18} />}
      <span className="rd-vthumb-play" aria-hidden="true">
        <Glyph name="play" size={wide ? 26 : 18} />
      </span>
      <span className="rd-vthumb-dur">{formatDuration(v.durationSec)}</span>
    </button>
  );
}

/**
 * 영상 표 (넓은 화면). 행 전체가 작업 상세 링크이고, 썸네일만 영상 보기 창을 연다
 * @param props 행 값
 */
function VideoTable({ topic, rows, offset, threshold, onWatch }: RowsProps) {
  const location = useLocation();
  return (
    <div className="rd-vtable" role="table" aria-label="영상 목록">
      <div className="rd-vgrid rd-vhead" role="row">
        <span role="columnheader" className="rd-c-rank">
          #
        </span>
        <span role="columnheader">영상</span>
        <span role="columnheader" className="rd-c-match">
          주제와 매칭
        </span>
        <span role="columnheader" className="rd-c-kw">
          맞은 검색어
        </span>
        <span role="columnheader" className="rd-c-views">
          조회수
        </span>
        <span role="columnheader">상태</span>
      </div>
      {rows.map((v, i) => (
        <div key={v.id} className="rd-vgrid rd-vrow" role="row">
          <span role="cell" className="rd-c-rank text-mono rd-muted">
            {offset + i + 1}
          </span>
          <span role="cell" className="rd-vcell-main">
            <Thumb v={v} onWatch={onWatch} />
            <span className="rd-cell-sub">
              <Link className="rd-vlink" to={paths.video(topic.id, v.id)} state={{ from: location.pathname + location.search }}>
                <span className="rd-clamp">{v.title}</span>
              </Link>
              <span className="text-caption rd-muted rd-clamp-1">
                {v.channelTitle} · {relativeTime(v.publishedAt)}
              </span>
            </span>
          </span>
          <span role="cell" className="rd-c-match">
            <MatchCell v={v} threshold={threshold} />
          </span>
          <span role="cell" className="rd-c-kw rd-row-tight">
            {v.matchedKeywords.length > 0 ? v.matchedKeywords.map((k) => <Keyword key={k}>{k}</Keyword>) : <span className="text-caption rd-muted" title="제목·설명·태그에 검색어가 없어요">—</span>}
          </span>
          <span role="cell" className="rd-c-views text-mono">
            {v.viewCount.toLocaleString('ko-KR')}
          </span>
          <span role="cell">
            <StatusCell v={v} />
          </span>
          <span className="rd-vgo" aria-hidden="true">
            <Icon name="chevronRight" size={18} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 영상 카드 (카드 보기)
 * @param props 행 값
 */
function VideoCards({ topic, rows, offset, threshold, onWatch }: RowsProps) {
  const location = useLocation();
  return (
    <ul className="rd-vcards" aria-label="영상 목록">
      {rows.map((v, i) => (
        <li key={v.id} className="rd-vcard">
          <span className="rd-vcard-rank text-mono">{offset + i + 1}</span>
          <Thumb v={v} onWatch={onWatch} wide />
          <Link className="rd-vlink" to={paths.video(topic.id, v.id)} state={{ from: location.pathname + location.search }}>
            <span className="rd-clamp">{v.title}</span>
          </Link>
          <span className="text-caption rd-muted rd-clamp-1">
            {v.channelTitle} · {relativeTime(v.publishedAt)} · <span className="text-mono">{v.viewCount.toLocaleString('ko-KR')}회</span>
          </span>
          <span className="rd-vcard-foot">
            <MatchCell v={v} threshold={threshold} />
            <StatusCell v={v} />
          </span>
          {v.matchedKeywords.length > 0 ? (
            <span className="rd-row-tight">
              {v.matchedKeywords.map((k) => (
                <Keyword key={k}>{k}</Keyword>
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * 쪽 넘기기 (30개씩)
 * @param props.total 거른 영상 수
 * @param props.page 지금 쪽
 * @param props.pages 쪽 수
 * @param props.onPage 쪽 바꾸기
 */
function Pager({ total, page, pages, onPage }: { total: number; page: number; pages: number; onPage: (n: number) => void }) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  // 처음 · 지금 앞뒤 · 마지막만 보인다
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <div className="rd-pager">
      <span className="text-caption rd-muted">
        <span className="tnum">{total.toLocaleString('ko-KR')}</span>개 중 <span className="tnum">{from}–{to}</span> · {PAGE_SIZE}개씩
      </span>
      {pages > 1 ? (
        <nav aria-label="쪽" className="rd-row-tight">
          <button type="button" className="rd-pg" aria-label="이전 쪽" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          {nums.map((n, i) => (
            <span key={n} className="rd-row-tight">
              {i > 0 && n - nums[i - 1] > 1 ? <span className="rd-muted">…</span> : null}
              <button type="button" className={`rd-pg${n === page ? ' is-on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
                {n}
              </button>
            </span>
          ))}
          <button type="button" className="rd-pg" aria-label="다음 쪽" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
