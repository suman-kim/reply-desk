import { kstDayRange } from './kst.js';

describe('kstDayRange', () => {
  it('UTC 15:00 이후는 한국 시간으로 다음 날이다', () => {
    const { start, end } = kstDayRange(new Date('2026-11-13T15:30:00Z'));
    expect(start.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-14T15:00:00.000Z');
  });

  it('한국 시간 오전 8시는 그날 0시부터 센다', () => {
    const { start } = kstDayRange(new Date('2026-11-12T23:00:00Z'));
    expect(start.toISOString()).toBe('2026-11-12T15:00:00.000Z');
  });
});
