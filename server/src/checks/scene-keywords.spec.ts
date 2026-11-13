import { keywordsFromQuotes } from './scene-keywords.js';

describe('keywordsFromQuotes', () => {
  it('조사를 떼고 두 글자 이상 단어를 긴 것부터 뽑는다 (흔한 말은 뺀다)', () => {
    expect(
      keywordsFromQuotes(['아빠가 상황판단이 안되시네', '진짜 너무 웃겨요']),
    ).toEqual(['상황판단', '안되시네', '아빠', '웃겨']);
  });

  it('실제 초안(2026-11-13, gemma4)이 근거 댓글을 짚었으면 통과할 단어가 생긴다', () => {
    const words = keywordsFromQuotes(['아빠가 상황판단이 안되시네']);
    const draft =
      '[광고] 아빠가 상황판단이 안되시네라는 댓글 진짜 공감돼요.. 자식 연애가 집안 경사인데';
    expect(words.some((w) => draft.includes(w))).toBe(true);
  });

  it('인용이 없으면 빈 목록', () => {
    expect(keywordsFromQuotes([])).toEqual([]);
  });
});
