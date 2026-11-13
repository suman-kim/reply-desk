import { formatDuration } from '../lib/format';

/**
 * 영상 썸네일 (② 영상 선택 머리). 누르면 영상 보기 창(플레이어·인기 댓글)이 열린다.
 * 영상 길이를 오른쪽 아래에 겹쳐 보인다(유튜브와 같은 자리).
 * @param props.url 썸네일 주소 (없으면 null → 빈 자리)
 * @param props.title 영상 제목 (그림 설명·버튼 이름)
 * @param props.durationSec 영상 길이 (초)
 * @param props.onPlay 눌렀을 때 (영상 보기 창 열기)
 */
export function VideoThumb({
  url,
  title,
  durationSec,
  onPlay,
}: {
  url: string | null;
  title: string;
  durationSec: number;
  onPlay: () => void;
}) {
  return (
    <button type="button" className="rd-thumb" aria-label={`영상 보기: ${title}`} onClick={onPlay}>
      {url ? (
        <img src={url} alt={`${title} 썸네일`} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="rd-thumb-empty text-caption">썸네일 없음</span>
      )}
      <span className="rd-thumb-play" aria-hidden="true">
        ▶
      </span>
      <span className="rd-thumb-time text-mono">{formatDuration(durationSec)}</span>
    </button>
  );
}
