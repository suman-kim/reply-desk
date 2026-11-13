/** 유튜브 영상 ID 모양 (11자) */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * 링크나 ID에서 유튜브 영상 ID를 꺼낸다.
 * 지원: watch?v=, youtu.be/, shorts/, embed/, live/, m.youtube.com, ID 그대로
 * @param input 사용자가 붙여 넣은 링크
 * @returns 영상 ID, 알아볼 수 없으면 null
 */
export function parseYoutubeVideoId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;

  let url: URL;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      const [, kind, id] = url.pathname.split('/');
      if (['shorts', 'embed', 'live', 'v'].includes(kind))
        candidate = id ?? null;
    }
  }
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * ISO 8601 길이(PT12M48S)를 초로 바꾼다.
 * @param iso API의 contentDetails.duration
 */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
