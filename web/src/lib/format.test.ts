import { countChars, formatDuration, formatLogTime, formatViews, relativeTime } from './format';

describe('화면 숫자·시각', () => {
  const now = new Date('2026-11-13T05:00:00Z'); // 한국 시간 14:00

  it('조회수와 길이', () => {
    expect(formatViews(12400)).toBe('조회수 12,400회');
    expect(formatDuration(768)).toBe('12:48');
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('올린 때를 사람 말로', () => {
    expect(relativeTime('2026-11-13T04:59:40Z', now)).toBe('방금 전');
    expect(relativeTime('2026-11-13T02:00:00Z', now)).toBe('3시간 전');
    expect(relativeTime('2026-11-12T03:00:00Z', now)).toBe('어제');
    expect(relativeTime(null, now)).toBe('확인 전');
  });

  it('기록 시각: 오늘이면 시각만, 아니면 날짜도 (한국 시간)', () => {
    expect(formatLogTime('2026-11-13T01:05:00Z', now)).toBe('10:05');
    expect(formatLogTime('2026-11-11T01:05:00Z', now)).toBe('11/11 10:05');
  });

  it('글자 수는 서버 자동 검사처럼 앞뒤 공백을 빼고 사람이 보는 글자로 센다', () => {
    expect(countChars('  운명원ㅠ  ')).toBe(4);
    expect(countChars('👍🏽좋아요')).toBe(4);
  });
});
