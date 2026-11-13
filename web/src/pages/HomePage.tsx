import { Link, Navigate, useLocation } from 'react-router';
import { useProfiles, useTopics } from '../api/queries';
import type { Topic } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { Badge, StatPill } from '../ds/inyeon';
import { legacyPath, paths, resumeTopic } from '../nav/paths';
import { useSelectedTopic } from '../nav/selected-topic';

/**
 * 홈 (주제를 고르기 전): "왼쪽에서 주제를 고르세요"와 주제 카드(오늘 현황·게시 대기), 로그인 경고.
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
  if (firstEntry && startTopicId && topics.isPending) return <div className="rd-page"><LoadingBox>마지막에 보던 주제를 여는 중…</LoadingBox></div>;
  const resume = resumeTopic({ firstEntry, lastTopicId: startTopicId, topicIds: topics.data?.map((t) => t.id) ?? [] });
  if (resume) return <Navigate to={paths.topic(resume)} replace />;

  return (
    <div className="rd-page">
      <PageHeader
        title="주제 고르기"
        description="일할 주제를 고르면 그 주제의 대시보드 · 작업 목록 · 댓글 게시 목록 · 주제 설정이 왼쪽 메뉴에 열려요."
        right={
          <Link to={paths.newTopic} className="iy-btn iy-btn-secondary iy-btn-md">
            + 새 주제
          </Link>
        }
      />

      {needLogin.length > 0 ? (
        <div className="rd-band rd-band-warning" role="status">
          <span className="text-body-strong">로그인이 필요한 계정이 있어요 · {needLogin.map((p) => p.name).join(', ')}</span>
          <Link to={paths.accounts} className="iy-btn iy-btn-secondary iy-btn-sm">
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
        </section>
      ) : null}
    </div>
  );
}

/**
 * 주제 카드 한 장: 이름 · 상태 · 유도 대상 · 오늘 게시 · 게시 대기. 누르면 그 주제의 대시보드로 간다.
 * @param props.topic 주제
 */
function TopicCard({ topic: t }: { topic: Topic }) {
  const active = t.status === 'active';
  return (
    <Link to={paths.topic(t.id)} className="rd-topic-card">
      <span className="rd-row">
        <span className="text-heading rd-topic-card-name">{t.name}</span>
        <Badge dot tone={active ? 'success' : 'neutral'}>
          {active ? '진행 중' : '일시정지'}
        </Badge>
      </span>
      <span className="text-body-sm rd-ink2 rd-clamp">유도 대상 · {t.brandTarget}</span>
      <span className="rd-row">
        <StatPill label="오늘 게시" value={t.postedToday} max={t.dailyCap} />
        <span className={`text-caption ${t.pendingDrafts > 0 ? 'rd-accent-ink' : 'rd-muted'}`}>게시 대기 {t.pendingDrafts}개</span>
      </span>
      <span className="text-caption rd-topic-card-go">대시보드 열기 →</span>
    </Link>
  );
}
