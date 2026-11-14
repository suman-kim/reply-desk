import {
  lengthRange,
  pickStyle,
  STYLE_DIMENSIONS,
  styleBlock,
  type DraftStyle,
} from './draft-style.js';

/** 늘 같은 값을 주는 무작위 함수 */
const fixed = (v: number) => () => v;

describe('글 모양 고르기 (RD-33)', () => {
  it('최근 초안이 없으면 보기 중에서 고르고, 화면용 한 줄을 만든다', () => {
    const s = pickStyle([], { hasSceneTime: true }, fixed(0));
    expect(s).toMatchObject({
      persona: 'student',
      tone: 'polite',
      opening: 'question',
      brandWay: 'heard',
      brandSpot: 'early',
      length: 'short',
    });
    expect(s.summary).toBe(
      '20대 초반 대학생 · 존댓말 · 질문으로 시작 · 들은 말로 앞쪽에 · 짧게',
    );
  });

  it('최근 초안이 쓴 보기는 피한다 (보기의 절반까지)', () => {
    const recent: Partial<DraftStyle>[] = [
      {
        persona: 'student',
        tone: 'polite',
        opening: 'question',
        brandWay: 'heard',
        brandSpot: 'early',
        length: 'short',
      },
      {
        persona: 'office20',
        tone: 'casual',
        opening: 'quote',
        brandWay: 'friend',
        brandSpot: 'middle',
        length: 'medium',
      },
      {
        persona: 'office30',
        tone: 'mixed',
        opening: 'me',
        brandWay: 'search',
        brandSpot: 'end',
        length: 'long',
      },
    ];
    const s = pickStyle(recent, { hasSceneTime: true }, fixed(0));
    // 쓰는 사람 보기 6개 → 최근 3개를 피함
    expect(s.persona).toBe('jobseeker');
    // 말투 5개 → 최근 2개(polite, casual)를 피함
    expect(s.tone).toBe('mixed');
    // 자리 3개 → 최근 1개(early)만 피함
    expect(s.brandSpot).toBe('middle');
    // 길이 3개 → 최근 1개(short)만 피함
    expect(s.length).toBe('medium');
  });

  it('근거 장면에 시점이 없으면 시점으로 시작하지 않는다', () => {
    const openings = new Set(
      Array.from(
        { length: 20 },
        (_, i) => pickStyle([], { hasSceneTime: false }, fixed(i / 20)).opening,
      ),
    );
    expect(openings.has('time')).toBe(false);
    expect(openings.size).toBe(
      STYLE_DIMENSIONS.find((d) => d.key === 'opening')!.options.length - 1,
    );
  });

  it('길이 칸은 주제 범위를 셋으로 나누되 조금씩 겹친다', () => {
    expect(lengthRange('short', 40, 120)).toEqual([40, 70]);
    expect(lengthRange('medium', 40, 120)).toEqual([65, 90]);
    // 위쪽 15%는 남긴다 (작은 모델이 넘치지 않게)
    expect(lengthRange('long', 40, 120)).toEqual([80, 110]);
    expect(lengthRange('long', 40, 150)).toEqual([95, 135]);
  });

  it('프롬프트 지시: 고른 보기의 지시와 길이 범위', () => {
    const s = pickStyle([], { hasSceneTime: true }, fixed(0));
    const block = styleBlock(s, { minLength: 40, maxLength: 120 });
    expect(block).toContain('[이번 글 모양]');
    expect(block).toContain('- 쓰는 사람: 20대 초반 대학생');
    expect(block).toContain('- 시작: 첫 문장을 질문으로 시작한다');
    expect(block).toContain('- 길이: 40~70자 안팎');
    expect(block).not.toContain('- 장면:');
    // 장면 단어가 있으면 그대로 넣으라고 한다
    expect(
      styleBlock(s, { minLength: 40, maxLength: 120 }, ['스토리', '04:12']),
    ).toContain(
      '- 장면: 다음 중 하나 이상을 글에 그대로 넣어 장면을 짚는다: 스토리, 04:12',
    );
  });
});
