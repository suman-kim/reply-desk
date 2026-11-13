import type { DraftDetail } from '../api/types';
import { formatDuration, relativeTime } from '../lib/format';
import { KeywordLine, TopicMatchBox } from './TopicMatchBox';
import { VideoThumb } from './VideoThumb';

/**
 * 작업 상세 A칸 '판단 근거' (RD-26): 이 영상에 댓글을 달아도 되는지 판단하는 데 쓰는 것만 위에서부터.
 * 주제와 매칭(큰 퍼센트 · 맞은 검색어) → 영상 정보(썸네일 · 채널 · 조회수 · 분석한 AI) → 고른 이유 → 근거로 쓴 장면·댓글.
 * 아직 분석 전이면 매칭 대신 '분석 전'을 알리고, 맞은 검색어만 보인다.
 * @param props.detail 영상·분석·초안
 * @param props.onWatch 썸네일을 눌렀을 때 (영상 보기 창)
 */
export function EvidencePanel({ detail, onWatch }: { detail: DraftDetail; onWatch: () => void }) {
  const { video, analysis } = detail;
  return (
    <div className="rd-stack-16">
      {analysis ? (
        <TopicMatchBox match={detail.topicMatch} keywords={video.matchedKeywords} />
      ) : (
        <div className="rd-tm is-none">
          <div className="rd-tm-head">
            <span className="text-label rd-ink">주제와 매칭</span>
          </div>
          <span className="text-body-sm rd-ink">아직 분석 전이에요</span>
          <span className="text-caption rd-muted">[초안 작성]을 누르면 영상을 분석해 주제와 얼마나 맞는지, 고른 이유와 근거 장면을 여기 보여 줘요</span>
          <KeywordLine keywords={video.matchedKeywords} />
        </div>
      )}

      <div className="rd-card rd-ev-video">
        <VideoThumb url={video.thumbnailUrl} title={video.title} durationSec={video.durationSec} onPlay={onWatch} />
        <dl className="rd-ev-dl">
          <dt>채널</dt>
          <dd className="rd-clamp-1 text-body-strong">{video.channelTitle}</dd>
          <dt>올린 때</dt>
          <dd>{relativeTime(video.publishedAt)}</dd>
          <dt>조회수</dt>
          <dd className="text-mono">{video.viewCount.toLocaleString('ko-KR')}회</dd>
          <dt>길이</dt>
          <dd className="text-mono">{formatDuration(video.durationSec)}</dd>
          <dt>분석한 AI</dt>
          <dd className="text-mono rd-clamp-1">{analysis ? analysis.model : '아직 없음'}</dd>
        </dl>
      </div>

      {analysis ? (
        <div className="rd-card">
          <h2 className="text-heading" style={{ margin: 0 }}>
            이 영상을 고른 이유
          </h2>
          <ol className="rd-ol">
            {analysis.pickReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {analysis && analysis.scenes.length > 0 ? (
        <div className="rd-card">
          <h2 className="text-heading" style={{ margin: 0 }}>
            근거로 쓴 장면 · 댓글
          </h2>
          <ul className="rd-quotes">
            {analysis.scenes.map((s, i) => (
              <li key={i} className="rd-quote">
                <span className="rd-quote-ts text-mono">{s.time ?? (s.source === 'comment' ? '댓글' : '설명')}</span>
                <span className="text-body">
                  “{s.quote}” <span className="text-caption rd-muted">· {s.source === 'comment' ? '인기 댓글' : s.time ? '영상 속 장면' : '영상 설명'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
