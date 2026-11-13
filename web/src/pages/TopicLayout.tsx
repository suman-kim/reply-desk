import { Link, Outlet, useParams } from 'react-router';
import { useTopics } from '../api/queries';
import { EmptyBox, ErrorBand, LoadingBox } from '../components/StateBox';
import { paths } from '../nav/paths';

/**
 * 고른 주제 화면들의 틀 (/t/:topicId/…). 주제를 불러와 아래 화면(대시보드·작업 목록·댓글 게시 목록·주제 설정)에 넘긴다(useRouteTopic).
 * 불러오는 중·오류·없는 주제(지워짐)도 여기서 한 번만 보인다.
 */
export function TopicLayout() {
  const { topicId } = useParams();
  const topics = useTopics();
  const topic = topics.data?.find((t) => t.id === Number(topicId)) ?? null;

  if (topics.isPending) return <div className="rd-page"><LoadingBox>주제를 불러오는 중…</LoadingBox></div>;
  if (topics.error) return <div className="rd-page"><ErrorBand error={topics.error} onRetry={() => void topics.refetch()} /></div>;
  if (!topic) {
    return (
      <div className="rd-page">
        <EmptyBox>
          없는 주제예요 (지워졌을 수 있어요)
          <br />
          왼쪽에서 다른 주제를 고르거나 <Link to={paths.home}>주제 고르기</Link>로 가 주세요
        </EmptyBox>
      </div>
    );
  }
  return <Outlet context={topic} />;
}
