/**
 * 화면 주소 만들기·읽기. 주소 글자는 여기서만 만든다(화면마다 '/t/…'를 직접 쓰지 않는다).
 *
 * 주소 구조 (RD-25)
 * - `/` : 주제를 고르기 전(홈). 주제 카드에서 고른다
 * - `/topics/new` : 새 주제 만들기
 * - `/t/:topicId/dashboard | drafts | logs | settings` : 고른 주제의 메뉴
 * - `/t/:topicId/videos/:videoId` : 작업 상세 (영상 하나의 판단 근거 · 초안 · 게시, RD-26). 메뉴로는 '대시보드' 안이다
 * - `/accounts`, `/settings` : 공통 메뉴 (주제와 상관없음)
 */

/** 고른 주제 안의 화면 */
export type TopicSection = 'dashboard' | 'drafts' | 'logs' | 'settings';

/** 고른 주제 안의 화면 목록 (주소 확인용) */
export const TOPIC_SECTIONS: readonly TopicSection[] = ['dashboard', 'drafts', 'logs', 'settings'];

/** 주소 뒤에 붙일 값 (빈 값·0·null은 붙이지 않는다) */
type Query = Record<string, string | number | null | undefined>;

/**
 * 주소 뒤 ?a=1&b=2 를 만든다
 * @param query 붙일 값
 */
function toSearch(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '' && v !== 0) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** 화면 주소 */
export const paths = {
  /** 홈 (주제를 고르기 전) */
  home: '/',
  /** 새 주제 만들기 */
  newTopic: '/topics/new',
  /** 계정 관리 */
  accounts: '/accounts',
  /** 설정 */
  settings: '/settings',
  /**
   * 고른 주제의 화면
   * @param topicId 주제 ID
   * @param section 화면 (기본 대시보드)
   * @param query 주소 뒤 값 (예: { video: 12 })
   */
  topic: (topicId: number, section: TopicSection = 'dashboard', query?: Query) => `/t/${topicId}/${section}${toSearch(query)}`,
  /**
   * 작업 상세 (영상 하나)
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   */
  video: (topicId: number, videoId: number) => `/t/${topicId}/videos/${videoId}`,
};

/** 주소가 가리키는 주제: 숫자 = 그 주제, 'none' = 주제를 고르기 전(홈), undefined = 주제와 상관없는 화면 */
export type PathTopic = number | 'none' | undefined;

/**
 * 주소에서 주제를 읽는다
 * @param pathname 지금 주소 (예: /t/3/drafts)
 */
export function topicFromPath(pathname: string): PathTopic {
  if (pathname === '/' || pathname === '') return 'none';
  const m = /^\/t\/(\d+)(?:\/|$)/.exec(pathname);
  return m ? Number(m[1]) : undefined;
}

/**
 * 주소에서 고른 주제 안의 화면을 읽는다 (주제 화면이 아니면 null)
 * @param pathname 지금 주소
 */
export function sectionFromPath(pathname: string): TopicSection | null {
  // 작업 상세는 대시보드(영상 목록) 안의 화면이다
  if (videoFromPath(pathname) !== null) return 'dashboard';
  const m = /^\/t\/\d+\/([a-z]+)\/?$/.exec(pathname);
  const s = m?.[1] as TopicSection | undefined;
  return s && TOPIC_SECTIONS.includes(s) ? s : null;
}

/**
 * 주소에서 작업 상세의 영상을 읽는다 (작업 상세가 아니면 null)
 * @param pathname 지금 주소 (예: /t/3/videos/12)
 */
export function videoFromPath(pathname: string): number | null {
  const m = /^\/t\/\d+\/videos\/(\d+)\/?$/.exec(pathname);
  return m ? Number(m[1]) : null;
}

/**
 * 대시보드 예전 주소(?video=&step=, RD-26 전 ①②③)를 작업 상세로 바꾼다. 영상이 없으면 null
 * @param topicId 주제 ID
 * @param search 주소 뒤 값 (?…)
 */
export function legacyDashboardPath(topicId: number, search: string): string | null {
  const video = Number(new URLSearchParams(search).get('video')) || null;
  return video ? paths.video(topicId, video) : null;
}

/**
 * 예전 주소(RD-25 전)를 새 주소로 바꾼다. 즐겨찾기·열어 둔 탭이 그대로 열리게 한다. 바꿀 것이 없으면 null.
 * - `/?topic=3&video=9&step=2` → `/t/3/videos/9` (영상이 없으면 `/t/3/dashboard`)
 * - `/drafts?topic=3&video=9` → `/t/3/videos/9` (영상이 없으면 `/t/3/drafts`, 주제가 없으면 홈)
 * - `/logs?topic=3` → `/t/3/logs` (주제가 없으면 홈)
 * - `/topics/3/edit` → `/t/3/settings`
 * @param pathname 주소
 * @param search 주소 뒤 값 (?…)
 */
export function legacyPath(pathname: string, search: string): string | null {
  const q = new URLSearchParams(search);
  const topic = Number(q.get('topic')) || null;
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    if (!topic) return null;
    const video = Number(q.get('video')) || null;
    return video ? paths.video(topic, video) : paths.topic(topic, 'dashboard');
  }
  if (path === '/drafts') {
    if (!topic) return paths.home;
    const video = Number(q.get('video')) || null;
    return video ? paths.video(topic, video) : paths.topic(topic, 'drafts');
  }
  if (path === '/logs') return topic ? paths.topic(topic, 'logs') : paths.home;
  const edit = /^\/topics\/(\d+)\/edit$/.exec(path);
  if (edit) return paths.topic(Number(edit[1]), 'settings');
  return null;
}

/**
 * 앱을 처음 열었을 때 마지막에 고른 주제로 이어 갈지 정한다.
 * 홈을 처음 열었고(앱 안에서 홈으로 온 것이 아님), 기억한 주제가 아직 있을 때만 이어 간다.
 * @param input.firstEntry 앱을 연 첫 화면인지
 * @param input.lastTopicId 기억한 주제 (없으면 null)
 * @param input.topicIds 지금 있는 주제 ID들
 */
export function resumeTopic(input: { firstEntry: boolean; lastTopicId: number | null; topicIds: number[] }): number | null {
  const { firstEntry, lastTopicId, topicIds } = input;
  return firstEntry && lastTopicId && topicIds.includes(lastTopicId) ? lastTopicId : null;
}
