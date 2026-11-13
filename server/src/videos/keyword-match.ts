/**
 * 맞은 검색어 (RD-23): 주제의 검색 키워드 중 어떤 것이 영상의 제목·설명·태그에 들어 있는지 코드가 찾는다.
 * 검색어마다 따로 검색하지 않고(할당량이 검색어 수만큼 늘어서), 이미 받은 영상 정보(videos.list snippet)와 대조한다.
 * 띄어쓰기·대소문자·# 은 무시한다: '연애' 는 '#연애전쟁', '연애 의 조건' 에도 맞는다.
 */

/** 대조할 영상 글자 */
export interface KeywordSource {
  /** 제목 */
  title: string;
  /** 설명 (없으면 빈 글자) */
  description?: string | null;
  /** 태그 */
  tags?: string[] | null;
}

/**
 * 비교용으로 글자를 고른다 (유니코드 정규화 · 소문자 · 띄어쓰기와 # 빼기)
 * @param s 글자
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s#]+/g, '');
}

/**
 * 주제 키워드 중 영상의 제목·설명·태그에 들어 있는 것 (주제에 적은 순서대로, 겹치지 않게)
 * @param keywords 주제의 검색 키워드
 * @param source 영상 제목·설명·태그
 */
export function matchKeywords(
  keywords: string[],
  source: KeywordSource,
): string[] {
  const hay = normalizeForMatch(
    [source.title, source.description ?? '', ...(source.tags ?? [])].join('\n'),
  );
  const out: string[] = [];
  for (const k of keywords) {
    const needle = normalizeForMatch(k);
    if (needle && hay.includes(needle) && !out.includes(k)) out.push(k);
  }
  return out;
}
