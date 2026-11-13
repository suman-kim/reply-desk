/**
 * 화면에 보일 숫자·시각 글자. 숫자는 서버(코드)가 준 값만 쓴다.
 */

/**
 * 조회수 (예: 조회수 12,400회)
 * @param n 조회수
 */
export function formatViews(n: number): string {
  return `조회수 ${n.toLocaleString('ko-KR')}회`;
}

/**
 * 올린 때 (예: 3시간 전, 어제, 5일 전)
 * @param iso 시각 (ISO 문자열)
 * @param now 기준 시각
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '확인 전';
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

/**
 * 영상 길이 (예: 12:48, 1:02:03)
 * @param sec 초
 */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * 기록의 시각. 오늘이면 14:05, 아니면 11/12 14:05 (한국 시간)
 * @param iso 시각
 * @param now 기준 시각
 */
export function formatLogTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Seoul' };
  const day = (x: Date) => x.toLocaleDateString('ko-KR', opts);
  const time = d.toLocaleTimeString('ko-KR', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false });
  if (day(d) === day(now)) return time;
  const md = d.toLocaleDateString('ko-KR', { ...opts, month: 'numeric', day: 'numeric' }).replace(/\.\s?/g, '/').replace(/\/$/, '');
  return `${md} ${time}`;
}

/**
 * 글자 수. 이모지·한글 조합을 사람이 보는 글자 단위로 센다(서버 자동 검사와 같은 방식)
 * @param text 글
 */
export function countChars(text: string): number {
  const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
  let n = 0;
  for (const _ of segmenter.segment(text.trim())) n++;
  return n;
}
