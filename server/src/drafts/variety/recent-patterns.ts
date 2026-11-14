/**
 * 최근 초안 피하기 (RD-33). 같은 주제의 최근 초안에서 자주 나온 말버릇을 찾아
 * 프롬프트에는 '피할 말'로 넘기고(30% 이상), 너무 자주 나온 말(70% 이상)이나 거의 같은 글은 자동 검사가 막는다.
 */

/** 피할 말로 넘기는 기준: 최근 초안 중 이 비율 이상에 나온 말 */
export const AVOID_RATIO = 0.3;
/** 검사에서 막는 기준: 최근 초안 중 이 비율 이상에 나온 말 */
export const OVERUSED_RATIO = 0.7;
/** 말버릇을 따지기 시작하는 최근 초안 수 (너무 적으면 우연이다) */
export const MIN_RECENT_FOR_PHRASES = 4;
/** 피할 말로 넘기는 최대 개수 */
export const MAX_AVOID = 8;
/** 거의 같은 글로 보는 유사도 (글자 3개 묶음 자카드). 실제 초안: 같은 영상 다시 생성 0.21~0.30, 다른 영상 0.11 이하 */
export const NEAR_DUPLICATE = 0.2;

/** 최근 초안에서 찾은 말버릇 */
export interface RecentPatterns {
  /** 프롬프트에 '쓰지 말 것'으로 넘길 말 (자주 나온 순) */
  avoid: string[];
  /** 또 쓰면 검사에서 걸리는 말 */
  overused: string[];
}

/**
 * 글을 낱말로 나눈다 (문장부호를 빼고 띄어쓰기로)
 * @param text 글
 */
export function wordsOf(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * 최근 초안의 말버릇을 찾는다. 두 낱말 묶음을 먼저, 그다음 한 낱말을 본다.
 * @param texts 최근 초안 본문 (광고 표시는 뺀 것)
 * @param exclude 꼭 써야 해서 피하라고 하면 안 되는 말 (브랜드 단어·주제 검색어·장면 핵심 단어). 이 말이 들어간 한 낱말은 뺀다
 */
export function recentPatterns(
  texts: string[],
  exclude: string[],
): RecentPatterns {
  if (texts.length < MIN_RECENT_FOR_PHRASES) return { avoid: [], overused: [] };
  const ex = exclude.map((e) => e.trim()).filter(Boolean);
  const df = new Map<string, number>();
  const add = (phrase: string) => df.set(phrase, (df.get(phrase) ?? 0) + 1);
  for (const text of texts) {
    const words = wordsOf(text);
    const seen = new Set<string>();
    words.forEach((w, i) => {
      // 한 낱말: 두 글자 이상, 꼭 써야 하는 말이 들어간 낱말은 뺀다
      if ([...w].length >= 2 && !ex.some((e) => w.includes(e))) seen.add(w);
      // 두 낱말 묶음: 브랜드가 들어가도 된다 (예: '운명원 같은'은 피할 말버릇)
      if (i + 1 < words.length) seen.add(`${w} ${words[i + 1]}`);
    });
    seen.forEach(add);
  }
  const n = texts.length;
  const ranked = [...df.entries()]
    .filter(([, c]) => c >= 2)
    // 두 낱말 묶음을 먼저, 자주 나온 순
    .sort(
      (a, b) =>
        b[1] - a[1] || Number(b[0].includes(' ')) - Number(a[0].includes(' ')),
    );
  // 묶음에 이미 들어간 한 낱말보다 묶음을 남긴다 (같은 수일 때)
  const avoid = ranked
    .filter(([, c]) => c / n >= AVOID_RATIO)
    .map(([p]) => p)
    .slice(0, MAX_AVOID);
  const overused = ranked
    .filter(([, c]) => c / n >= OVERUSED_RATIO)
    .map(([p]) => p);
  return { avoid, overused };
}

/**
 * 글자 3개 묶음 자카드 유사도 (0~1, 띄어쓰기는 무시)
 * @param a 글
 * @param b 글
 */
export function similarity(a: string, b: string): number {
  const grams = (t: string) => {
    const s = [...t.replace(/\s+/g, '')];
    const set = new Set<string>();
    for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3).join(''));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let common = 0;
  A.forEach((g) => {
    if (B.has(g)) common += 1;
  });
  const union = A.size + B.size - common;
  return union === 0 ? 0 : common / union;
}

/**
 * 글에 들어간 말버릇 (낱말 단위로 본다: '진짜'는 '진짜로'에는 걸리지 않게 낱말 경계로 비교)
 * @param text 글
 * @param phrases 말버릇
 */
export function phrasesIn(text: string, phrases: string[]): string[] {
  const padded = ` ${wordsOf(text).join(' ')} `;
  return phrases.filter((p) => padded.includes(` ${p} `));
}

/**
 * 프롬프트에 붙이는 '피할 말' 지시. 피할 말이 없으면 빈 글
 * @param avoid 피할 말
 */
export function avoidBlock(avoid: string[]): string {
  if (avoid.length === 0) return '';
  return [
    '[최근 초안에 자주 나온 말] 이번엔 쓰지 않는다',
    ...avoid.map((p) => `- ${p}`),
    '최근 초안과 시작·끝맺음·문장 구조도 다르게 쓴다.',
  ].join('\n');
}
