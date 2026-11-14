import type { TopicMatch } from '../api/types';

/**
 * 주제와 매칭 상자 (② 화면·작업 창의 분석 맨 위).
 * AI가 영상 분석에서 매긴 "이 영상이 주제와 얼마나 맞는지"를 퍼센트와 막대, 이유 한 줄로 보인다.
 * 설정의 '주제 매칭 기준' 이상이면 초록 '주제와 매칭됨', 미만이면 노랑 '주제와 매칭 낮음'. 초안 작성·게시는 막지 않는다.
 * @param props.match 주제와 매칭. 이 기능 전에 한 분석이면 null(매칭 확인 전)
 */
export function TopicMatchBox({ match }: { match: TopicMatch | null }) {
  if (!match) {
    return (
      <div className="rd-match rd-match-none">
        <span className="text-label">주제와 매칭 확인 전</span>
        <span className="text-caption">이 기능 전에 한 분석이에요 · [분석부터 다시]를 누르면 주제와 얼마나 맞는지 매겨요</span>
      </div>
    );
  }
  return (
    <div className={`rd-match ${match.matched ? 'rd-match-ok' : 'rd-match-low'}`}>
      <div className="rd-match-head">
        <span className="text-label">{match.matched ? '주제와 매칭됨' : '주제와 매칭 낮음'}</span>
        <span className="rd-match-percent">{match.percent}%</span>
      </div>
      <div
        className="rd-match-bar"
        role="meter"
        aria-label="주제와 매칭"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={match.percent}
      >
        <span style={{ width: `${match.percent}%` }} />
        {/* 기준 위치 */}
        <i style={{ left: `${match.threshold}%` }} aria-hidden="true" />
      </div>
      <span className="text-body-sm rd-match-reason">{match.reason}</span>
      {!match.matched ? (
        <span className="text-caption">기준 {match.threshold}%보다 낮아요 · 다른 영상을 고르거나, 그래도 맞다면 그대로 게시해도 돼요</span>
      ) : null}
    </div>
  );
}
