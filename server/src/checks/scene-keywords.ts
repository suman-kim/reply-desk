/**
 * 근거 장면 인용에서 장면 언급 검사용 단어를 뽑는다.
 * AI가 준 장면 핵심 단어가 검증(인용에 있는 것만)에서 모두 빠지고 시점도 없으면(영상을 못 보는 AI, 댓글 근거)
 * 검사할 단어가 없어 '장면 언급'이 늘 실패한다. 그때 인용의 단어로 대신한다.
 */

/** 낱말 끝에서 떼어 낼 조사·어미 (긴 것부터 본다) */
const ENDINGS = [
  '에서는',
  '이라는',
  '에서',
  '으로',
  '까지',
  '부터',
  '한테',
  '에게',
  '라는',
  '이라',
  '하고',
  '처럼',
  '보다',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '도',
  '로',
  '와',
  '과',
  '만',
  '요',
];

/** 어느 글에나 나와 장면을 짚었다고 볼 수 없는 말 */
const STOPWORDS = new Set([
  '진짜',
  '정말',
  '너무',
  '그냥',
  '이거',
  '저거',
  '그거',
  '저도',
  '나도',
  '우리',
  '그리고',
  '근데',
  '하는',
  '있는',
  '없는',
  '같은',
  '이런',
  '그런',
  '영상',
  '댓글',
  '사람',
  '생각',
]);

/**
 * 인용들에서 단어를 뽑는다 (조사를 떼고 두 글자 이상, 흔한 말 제외, 긴 것부터 최대 8개)
 * @param quotes 근거 장면 인용
 */
export function keywordsFromQuotes(quotes: string[]): string[] {
  const words = new Set<string>();
  for (const quote of quotes) {
    for (const raw of quote.split(/[^\p{L}\p{N}]+/u)) {
      let word = raw;
      const ending = ENDINGS.find(
        (e) => word.endsWith(e) && word.length - e.length >= 2,
      );
      if (ending) word = word.slice(0, -ending.length);
      if (word.length >= 2 && !STOPWORDS.has(word)) words.add(word);
    }
  }
  return [...words].sort((a, b) => b.length - a.length).slice(0, 8);
}
