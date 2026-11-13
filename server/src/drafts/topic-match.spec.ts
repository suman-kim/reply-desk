import { toTopicMatch } from './topic-match.js';

describe('주제와 매칭 (화면에 보일 값)', () => {
  it('기준 이상이면 매칭됨, 미만이면 매칭 낮음', () => {
    expect(
      toTopicMatch({ topicMatch: 82, topicMatchReason: '이유' }, 50),
    ).toEqual({
      percent: 82,
      reason: '이유',
      matched: true,
      threshold: 50,
    });
    expect(
      toTopicMatch({ topicMatch: 50, topicMatchReason: '이유' }, 50)?.matched,
    ).toBe(true);
    expect(
      toTopicMatch({ topicMatch: 49, topicMatchReason: '이유' }, 50)?.matched,
    ).toBe(false);
  });

  it('분석이 없거나 매칭 전 분석(이 기능 전에 한 분석)이면 null', () => {
    expect(toTopicMatch(null, 50)).toBeNull();
    expect(
      toTopicMatch({ topicMatch: null, topicMatchReason: null }, 50),
    ).toBeNull();
  });
});

describe('AI가 준 매칭 퍼센트 다듬기', () => {
  it('0~100 정수로 맞춘다', async () => {
    const { clampPercent } = await import('./topic-match.js');
    expect(clampPercent(82.6)).toBe(83);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
  });
});
