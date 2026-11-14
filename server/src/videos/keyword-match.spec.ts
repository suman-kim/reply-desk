import { matchKeywords, normalizeForMatch } from './keyword-match.js';

describe('맞은 검색어 (제목·설명·태그와 대조)', () => {
  const keywords = ['연애', '썸', '재회', '사주'];

  it('제목에 있는 검색어를 주제에 적은 순서대로 찾는다', () => {
    expect(
      matchKeywords(keywords, {
        title: '사주에 식신 있으면 · 연애할 때 이걸 해야 돼요',
      }),
    ).toEqual(['연애', '사주']);
  });

  it('설명과 태그에만 있는 검색어도 찾는다', () => {
    expect(
      matchKeywords(keywords, {
        title: '재물복을 부르는 이름 한자',
        description: '이름과 생일로 보는 사주 이야기',
        tags: ['썸타는법'],
      }),
    ).toEqual(['썸', '사주']);
  });

  it('띄어쓰기·대소문자·# 은 무시한다', () => {
    expect(
      matchKeywords(['연애 전쟁', 'Shorts'], { title: '#연애전쟁 #shorts' }),
    ).toEqual(['연애 전쟁', 'Shorts']);
    expect(normalizeForMatch(' #연애 의 조건 ')).toBe('연애의조건');
  });

  it('하나도 없으면 빈 목록, 빈 키워드는 건너뛴다', () => {
    expect(
      matchKeywords(['재회', ' '], {
        title: '결혼 비용 문제로 파혼하게 된 이유',
      }),
    ).toEqual([]);
  });
});
