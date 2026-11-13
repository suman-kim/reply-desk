import type { TopicMatch } from '../api/types';
import { Badge, Keyword } from '../ds';

/**
 * 맞은 검색어 줄 (RD-23): 주제 검색 키워드 중 영상의 제목·설명·태그에 들어 있는 것
 * @param props.keywords 맞은 검색어
 */
export function KeywordLine({ keywords }: { keywords: string[] }) {
  return (
    <div className="rd-tm-kw">
      <span className="text-caption rd-muted">맞은 검색어</span>
      {keywords.length > 0 ? (
        <>
          {keywords.map((k) => (
            <Keyword key={k}>{k}</Keyword>
          ))}
          <span className="text-caption rd-muted">· 제목·설명·태그에서 찾음</span>
        </>
      ) : (
        <span className="text-caption rd-muted">제목·설명·태그에 검색어가 없어요</span>
      )}
    </div>
  );
}

/**
 * 주제와 매칭 카드 (작업 상세 '판단 근거' 맨 위, RD-26).
 * AI가 영상 분석에서 매긴 "이 영상이 주제와 얼마나 맞는지"를 큰 퍼센트와 막대(기준 표시), 이유 한 줄로 보인다.
 * 설정의 '주제 매칭 기준' 이상이면 초록 '주제와 매칭됨', 미만이면 노랑 '주제와 매칭 낮음'. 초안 작성·게시는 막지 않는다.
 * 아래에는 맞은 검색어(제목·설명·태그에서 코드가 찾은 것)를 붙인다.
 * @param props.match 주제와 매칭. 이 기능 전에 한 분석이면 null(매칭 확인 전)
 * @param props.keywords 맞은 검색어 (주지 않으면 줄을 숨긴다)
 */
export function TopicMatchBox({ match, keywords }: { match: TopicMatch | null; keywords?: string[] }) {
  const kw = keywords !== undefined ? <KeywordLine keywords={keywords} /> : null;

  if (!match) {
    return (
      <div className="rd-tm is-none">
        <div className="rd-tm-head">
          <span className="text-label rd-ink">주제와 매칭 확인 전</span>
        </div>
        <span className="text-caption rd-muted">이 기능 전에 한 분석이에요 · [분석부터 다시]를 누르면 주제와 얼마나 맞는지 매겨요</span>
        {kw}
      </div>
    );
  }
  return (
    <div className={`rd-tm ${match.matched ? 'is-ok' : 'is-low'}`}>
      <div className="rd-tm-head">
        <span className="text-label rd-ink">주제와 매칭</span>
        <Badge tone={match.matched ? 'success' : 'warning'}>{match.matched ? '주제와 매칭됨' : '주제와 매칭 낮음'}</Badge>
      </div>
      <div className="rd-tm-value">
        <span className="rd-tm-pct">{`${match.percent}%`}</span>
        <span className="text-caption rd-muted">검색어와 영상 내용이 얼마나 맞는지 AI가 매긴 값</span>
      </div>
      <div className="rd-tm-scale">
        <div
          className="rd-tm-bar"
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
        <div className="rd-tm-ticks text-mono" aria-hidden="true">
          <span>0</span>
          <span style={{ left: `${match.threshold}%` }}>기준 {match.threshold}</span>
          <span>100</span>
        </div>
      </div>
      <span className="text-body-sm rd-ink">{match.reason}</span>
      {!match.matched ? (
        <span className="text-caption rd-tm-warn">기준 {match.threshold}%보다 낮아요 · 다른 영상을 고르거나, 그래도 맞다면 그대로 게시해도 돼요</span>
      ) : null}
      {kw}
    </div>
  );
}
