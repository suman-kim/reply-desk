import { CheckRunnerService } from './check-runner.service.js';
import type { CheckContext } from './check.types.js';
import { checkContextOf } from '../drafts/drafting.service.js';
import { withDisclosure } from './ad-disclosure.js';
import {
  DEFAULT_CHECKS,
  NoFakeReviewCheck,
  timeVariants,
} from './draft-checks.js';

/** 프로토타입의 운명원 주제·영상 v1 값을 기본으로 쓴다 */
function ctx(
  text: string,
  over: Partial<CheckContext['topic']> = {},
): CheckContext {
  return {
    text,
    fullText: text,
    disclosure: null,
    topic: {
      minLength: 40,
      maxLength: 120,
      brandWord: '운명원',
      bannedWords: [],
      ...over,
    },
    analysis: { sceneKeywords: ['확신', '텀', '읽씹'], sceneTimes: ['04:12'] },
  };
}

const runner = new CheckRunnerService(DEFAULT_CHECKS);
const GOOD =
  '4분쯤 확신이 없어서 텀이 길어진다는 말 듣고 뜨끔했어요. 저도 딱 그 상태라ㅠ 운명원 연애사주가 그렇게 잘 본다던데 이 사람이 내 인연인지 한번 물어보고 싶네요.';

describe('초안 자동 검사', () => {
  it('프로토타입의 좋은 초안은 모두 통과한다', () => {
    const report = runner.run(ctx(GOOD));
    expect(report.results.map((r) => [r.code, r.passed])).toEqual([
      ['length', true],
      ['scene_mention', true],
      ['brand_mention', true],
      ['no_link_hashtag', true],
      ['no_fake_review', true],
    ]);
    expect(report.passed).toBe(true);
  });

  it('글자 수가 범위를 벗어나면 원인과 할 일을 알려 준다', () => {
    const short = runner.run(ctx('운명원 확신'));
    const r = short.results.find((x) => x.code === 'length')!;
    expect(r.passed).toBe(false);
    expect(r.detail).toContain('40자 이상');
  });

  it('브랜드가 없거나 두 번 이상이면 막는다', () => {
    const none = runner.run(ctx(GOOD.replace('운명원', '거기')));
    expect(none.results.find((x) => x.code === 'brand_mention')!.passed).toBe(
      false,
    );
    const twice = runner.run(ctx(GOOD + ' 운명원'));
    expect(
      twice.results.find((x) => x.code === 'brand_mention')!.detail,
    ).toContain('2번');
  });

  it('링크와 해시태그를 막는다', () => {
    expect(runner.run(ctx(GOOD + ' unmyeong.kr')).passed).toBe(false);
    expect(runner.run(ctx(GOOD + ' #연애')).passed).toBe(false);
  });

  it('장면을 짚지 않거나 분석이 없으면 막는다', () => {
    const noScene =
      '요즘 연애가 너무 어려워요. 마음이 복잡하네요ㅠ 운명원 연애사주가 그렇게 잘 본다던데 저도 한번 물어보고 싶네요.';
    expect(
      runner.run(ctx(noScene)).results.find((x) => x.code === 'scene_mention')!
        .passed,
    ).toBe(false);
    expect(runner.run({ ...ctx(GOOD), analysis: null }).passed).toBe(false);
  });

  it('추가 금지 표현은 있을 때만 검사한다', () => {
    expect(
      runner.run(ctx(GOOD)).results.some((r) => r.code === 'banned_words'),
    ).toBe(false);
    const r = runner.run(ctx(GOOD, { bannedWords: ['인연'] }));
    expect(r.results.find((x) => x.code === 'banned_words')!.passed).toBe(
      false,
    );
  });
});

describe('지어낸 후기 검사', () => {
  const check = new NoFakeReviewCheck();
  const run = (text: string) => check.run(ctx(text)).passed;

  it.each([
    '운명원에서 받아봤는데 진짜 맞았어요',
    '운명원 다녀왔는데 소름 돋게 맞더라',
    '운명원 후기 남겨요',
    '운명원 추천해요',
  ])('써 본 척하는 문장을 막는다: %s', (text) => expect(run(text)).toBe(false));

  it.each([
    '영상 봤는데 공감돼요',
    '운명원이 잘 본다던데 궁금하네요',
    '우리 인연 남았는지 보고 싶다',
  ])('들은 말·바람·영상 감상은 통과한다: %s', (text) =>
    expect(run(text)).toBe(true),
  );
});

describe('시점 표현', () => {
  it('04:12를 댓글에서 쓸 법한 표현으로 바꾼다', () => {
    expect(timeVariants('04:12')).toEqual(['04:12', '4:12', '4분']);
  });
});

/** 다른 채널 영상: 맨 앞 광고 표시 */
describe('광고 표시 검사', () => {
  const topic = {
    minLength: 40,
    maxLength: 120,
    brandWord: '운명원',
    bannedWords: [],
  };
  const analysis = {
    sceneKeywords: ['확신', '텀', '읽씹'],
    scenes: [{ time: '04:12', quote: '', source: 'video' as const }],
  };
  /** 검사 결과를 [코드, 통과] 목록으로 */
  const codes = (text: string, disclosure: string | null) =>
    runner
      .run(checkContextOf(text, topic, analysis, disclosure))
      .results.map((r) => [r.code, r.passed]);

  it('내 채널 영상이면 광고 표시 검사를 하지 않는다', () => {
    expect(codes(GOOD, null).some(([c]) => c === 'ad_disclosure')).toBe(false);
  });

  it('다른 채널 영상: 맨 앞에 표시가 있으면 모두 통과하고, 표시는 길이에 세지 않는다', () => {
    const text = withDisclosure(GOOD, '#광고');
    expect(codes(text, '#광고')).toEqual([
      ['length', true],
      ['scene_mention', true],
      ['brand_mention', true],
      // 표시가 해시태그여도 본문만 보므로 해시태그 검사에 걸리지 않는다
      ['no_link_hashtag', true],
      ['no_fake_review', true],
      ['ad_disclosure', true],
    ]);
  });

  it('다른 채널 영상: 표시가 없거나 맨 앞이 아니면 걸린다', () => {
    expect(codes(GOOD, '[광고]').at(-1)).toEqual(['ad_disclosure', false]);
    expect(codes(`${GOOD} [광고]`, '[광고]').at(-1)).toEqual([
      'ad_disclosure',
      false,
    ]);
  });

  it('붙일 때 글 안에 있던 표시는 빼고 맨 앞에 한 번만 둔다', () => {
    expect(withDisclosure('좋아요 [광고] 운명원', '[광고]')).toBe(
      '[광고] 좋아요 운명원',
    );
  });
});
