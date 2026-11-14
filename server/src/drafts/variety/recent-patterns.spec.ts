import {
  avoidBlock,
  phrasesIn,
  recentPatterns,
  similarity,
} from './recent-patterns.js';

/** 실제 Ollama 초안에서 보인 말버릇을 줄인 예 */
const RECENT = [
  '여자애가 부탁 다 들어주는 거 진짜 귀여워요 혹시 운명원 같은 데서 봐달라고 하면 답이 나올까요',
  '연애의 조건 가사처럼 진짜 내 인연은 언제쯤일지 운명원 같은 곳에서 확인해보고 싶네요',
  '관계 곱창내놓는다는 말 진짜 뼈 때리네요 운명원 같은 데서 연애운 알면 궁금하네요',
  '썸 탈 때 이 노래 진짜 생각나네요 요즘은 나는솔로 보면서 대리만족 중이에요',
  '이름이랑 생일 운세 부분 진짜 공감했어요 운명원 한번 알아봐야겠네요',
];

describe('최근 초안 말버릇 (RD-33)', () => {
  it('자주 나온 말을 피할 말로, 아주 자주 나온 말은 검사용으로 찾는다', () => {
    const p = recentPatterns(RECENT, ['운명원', '연애']);
    expect(p.avoid).toContain('진짜');
    expect(p.avoid).toContain('운명원 같은');
    // 5개 중 5개(100%) → 검사에서 막는다, 3개(60%)는 피할 말만
    expect(p.overused).toEqual(['진짜']);
  });

  it('꼭 써야 하는 말(브랜드·검색어·장면 단어)은 한 낱말로는 피하라고 하지 않는다', () => {
    const p = recentPatterns(RECENT, ['운명원', '연애']);
    expect(p.avoid).not.toContain('운명원');
    expect(p.avoid.some((w) => !w.includes(' ') && w.includes('연애'))).toBe(
      false,
    );
  });

  it('최근 초안이 4개보다 적으면 말버릇을 따지지 않는다', () => {
    expect(recentPatterns(RECENT.slice(0, 3), [])).toEqual({
      avoid: [],
      overused: [],
    });
  });

  it('말버릇은 낱말 단위로 본다 ("진짜"는 "진짜로"에 걸리지 않는다)', () => {
    expect(phrasesIn('진짜로 궁금해요', ['진짜'])).toEqual([]);
    expect(phrasesIn('아 진짜, 궁금해요', ['진짜'])).toEqual(['진짜']);
    expect(phrasesIn('운명원 같은 데서', ['운명원 같은'])).toEqual([
      '운명원 같은',
    ]);
  });

  it('유사도: 같은 영상을 다시 쓴 거의 같은 글은 높고, 다른 글은 낮다', () => {
    const a =
      '진짜 돌싱남이랑 모솔녀 조합도 제발 해줬으면 좋겠어요. 운명원 같은 곳에서 이런 매칭도 가능할지 궁금하네요';
    const b =
      '아니 진짜 돌싱남 모솔녀 조합도 제발 해줬으면 좋겠어요ㅋㅋ 운명원 같은 데 가면 이런 매칭도 가능할지 궁금하네요';
    expect(similarity(a, b)).toBeGreaterThanOrEqual(0.2);
    expect(similarity(a, RECENT[4])).toBeLessThan(0.2);
    expect(similarity('', '')).toBe(0);
  });

  it('피할 말이 있을 때만 프롬프트 지시를 만든다', () => {
    expect(avoidBlock([])).toBe('');
    expect(avoidBlock(['진짜', '운명원 같은'])).toBe(
      '[최근 초안에 자주 나온 말] 이번엔 쓰지 않는다\n- 진짜\n- 운명원 같은\n최근 초안과 시작·끝맺음·문장 구조도 다르게 쓴다.',
    );
  });
});
