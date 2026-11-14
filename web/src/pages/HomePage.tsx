import { Link, Navigate, useLocation } from 'react-router';
import { useLogs, useProfiles, useTopics } from '../api/queries';
import type { PostLogRow, Topic } from '../api/types';
import { POST_RESULT } from '../components/badges';
import { Icon } from '../components/Icon';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, Keyword } from '../ds';
import { formatLogTime } from '../lib/format';
import { topicTone } from '../lib/topic-tone';
import { legacyPath, paths, resumeTopic } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';

/** 홈의 최근 게시 줄 수 */
const RECENT_ROWS = 4;

/**
 * 홈 (주제를 고르기 전): "왼쪽에서 주제를 고르세요"와 주제 카드(오늘 현황·게시 대기·검색어), 로그인 경고, 모든 주제의 최근 게시.
 * 좁은 화면에서는 사이드 메뉴가 숨으므로 이 카드로 바로 고른다.
 * 앱을 처음 열었을 때 마지막에 고른 주제가 있으면 그 주제의 대시보드로 이어 간다.
 */
export function HomePage() {
  const location = useLocation();
  const topics = useTopics();
  const profiles = useProfiles();
  const { startTopicId } = useSelectedTopic();
  const needLogin = profiles.data?.filter((p) => p.loginStatus === 'needs_login') ?? [];

  // 예전 주소(/?topic=3)는 새 주소로
  const legacy = legacyPath(location.pathname, location.search);
  if (legacy) return <Navigate to={legacy} replace />;

  // 앱을 처음 열었으면 마지막 주제로 이어 간다 (주제 목록을 받아 아직 있는지 본 뒤)
  const firstEntry = location.key === 'default';
  if (firstEntry && startTopicId && topics.isPending)
    return (
      <div className="rd-page">
        <LoadingBox>마지막에 보던 주제를 여는 중…</LoadingBox>
      </div>
    );
  const resume = resumeTopic({ firstEntry, lastTopicId: startTopicId, topicIds: topics.data?.map((t) => t.id) ?? [] });
  if (resume) return <Navigate to={paths.topic(resume)} replace />;

  return (
    <div className="rd-page rd-home">
      <header className="rd-home-hello">
        <span className="text-eyebrow">주제 고르기</span>
        <h1>어느 주제부터 볼까요?</h1>
        <p>왼쪽에서 주제를 고르면 그 주제의 영상 · 작업 · 게시 기록만 모아서 보여 드려요.</p>
      </header>

      {needLogin.length > 0 ? (
        <div className="rd-band rd-band-warning" role="status">
          <span className="text-body-strong">로그인이 필요한 계정이 있어요 · {needLogin.map((p) => p.name).join(', ')}</span>
          <Link to={paths.accounts} className="dk-btn dk-btn-secondary dk-btn-sm">
            계정 관리로 가기
          </Link>
        </div>
      ) : null}

      {topics.isPending ? <LoadingBox>주제를 불러오는 중…</LoadingBox> : null}
      {topics.error ? <ErrorBand error={topics.error} onRetry={() => void topics.refetch()} /> : null}
      {topics.data && topics.data.length === 0 ? (
        <EmptyBox>
          아직 주제가 없어요
          <br />
          홍보할 대상 하나가 주제 하나예요 · <Link to={paths.newTopic}>새 주제 만들기</Link>
        </EmptyBox>
      ) : null}
      {topics.data && topics.data.length > 0 ? (
        <section aria-label="주제 카드" className="rd-topic-cards">
          {topics.data.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
          <Link to={paths.newTopic} className="rd-new-card">
            <span className="rd-new-card-icon" aria-hidden="true">
              <Icon name="plus" />
            </span>
            <span className="text-heading">새 주제 만들기</span>
            <span className="text-caption rd-muted">홍보할 대상 하나가 주제 하나예요. 검색어와 댓글 말투를 정하면 영상을 찾아 초안을 써요.</span>
          </Link>
        </section>
      ) : null}

      {topics.data && topics.data.length > 0 ? <RecentPosts /> : null}
    </div>
  );
}

/**
 * 주제 카드 한 장: 첫 글자 · 이름 · 상태 · 홍보 대상 · 오늘 게시 · 게시 대기 · 검색어. 누르면 그 주제의 대시보드로 간다.
 * @param props.topic 주제
 */
function TopicCard({ topic: t }: { topic: Topic }) {
  const active = t.status === 'active';
  const pct = t.dailyCap > 0 ? Math.min(100, Math.round((t.postedToday / t.dailyCap) * 100)) : 0;
  return (
    <Link to={paths.topic(t.id)} className="rd-topic-card">
      <span className="rd-topic-card-top">
        <span className="rd-topic-card-avatar" style={topicTone(t.id)} aria-hidden="true">
          {Array.from(t.name)[0] ?? '?'}
        </span>
        <span className="rd-stack" style={{ minWidth: 0 }}>
          <span className="rd-row">
            <span className="text-heading rd-topic-card-name">{t.name}</span>
            <Badge tone={active ? 'success' : 'neutral'}>{active ? '진행 중' : '일시정지'}</Badge>
          </span>
          <span className="text-caption rd-muted rd-clamp-1">홍보 대상 · {t.brandTarget}</span>
        </span>
        <span className="rd-topic-card-go" aria-hidden="true">
          <Icon name="arrowRight" />
        </span>
      </span>
      <span className="rd-topic-card-stats">
        <span className="rd-mini-stat">
          <span>오늘 게시</span>
          <b>
            {t.postedToday}
            <small> / {t.dailyCap}</small>
          </b>
          <span className="rd-mini-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
        </span>
        <span className="rd-mini-stat">
          <span>게시 대기</span>
          <b>{t.pendingDrafts}</b>
        </span>
        <span className="rd-mini-stat">
          <span>검색어</span>
          <b>{t.keywords.length}</b>
        </span>
      </span>
      {t.keywords.length > 0 ? (
        <span className="rd-row-tight">
          {t.keywords.slice(0, 6).map((k) => (
            <Keyword key={k}>{k}</Keyword>
          ))}
          {t.keywords.length > 6 ? <span className="text-caption rd-muted">외 {t.keywords.length - 6}개</span> : null}
        </span>
      ) : null}
      <span className="rd-topic-card-foot">
        <span className="text-caption rd-muted">{t.profiles.length > 0 ? `쓸 프로필 ${t.profiles.map((p) => p.name).join(', ')}` : '쓸 프로필을 아직 고르지 않았어요'}</span>
        <span className="text-label">대시보드 열기</span>
      </span>
    </Link>
  );
}

/** 모든 주제의 최근 게시 (알림처럼 모든 주제를 본다). 누르면 그 주제의 댓글 게시 목록으로 */
function RecentPosts() {
  const logs = useLogs(null);
  const rows = (logs.data ?? []).slice(0, RECENT_ROWS);
  if (logs.isPending || logs.error || rows.length === 0) return null;
  return (
    <section aria-label="최근 게시" className="rd-stack-8">
      <h2 className="text-heading" style={{ margin: 0 }}>
        최근 게시 <span className="text-caption rd-muted">모든 주제</span>
      </h2>
      <div className="rd-recent">
        {rows.map((r) => (
          <RecentRow key={r.id} row={r} />
        ))}
      </div>
    </section>
  );
}

/**
 * 최근 게시 한 줄: 시각 · 결과 · 영상 · 주제
 * @param props.row 게시 기록
 */
function RecentRow({ row: r }: { row: PostLogRow }) {
  const result = POST_RESULT[r.status];
  const to = r.topic ? paths.topic(r.topic.id, 'logs') : paths.home;
  return (
    <Link to={to} className="rd-recent-row">
      <span className="text-mono rd-muted">{formatLogTime(r.startedAt)}</span>
      <Badge tone={result.tone}>{result.label}</Badge>
      <span className="rd-cell-sub">
        <span className="text-body-strong rd-clamp-1">{r.video?.title ?? '지운 영상'}</span>
        <span className="text-caption rd-muted rd-clamp-1">
          {r.profileName ?? '프로필 없음'}
          {r.status === 'failed' && r.failureReason ? ` · ${r.failureReason}` : ''}
        </span>
      </span>
      {r.topic ? <span className="dk-badge dk-badge-neutral rd-recent-topic">{r.topic.name}</span> : null}
    </Link>
  );
}
