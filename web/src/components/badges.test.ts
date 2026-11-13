import type { VideoItem } from '../api/types';
import { videoBadges } from './badges';

const v = (over: Partial<VideoItem>) => ({ isMine: false, commented: false, draftState: 'none', checkPassed: false, ...over }) as VideoItem;
const labels = (x: VideoItem) => videoBadges(x).map((b) => b.label);

describe('영상 카드 배지', () => {
  it.each<[Partial<VideoItem>, string[]]>([
    [{ draftState: 'writing' }, ['초안 작성 중']],
    [{ draftState: 'ready', checkPassed: true, isMine: true }, ['게시 대기', '내 채널']],
    [{ draftState: 'ready', checkPassed: false }, ['검사 미통과']],
    [{ draftState: 'error' }, ['작성 실패']],
    [{ draftState: 'ready', checkPassed: true, commented: true, isMine: true }, ['게시 완료', '내 채널']],
    [{ draftState: 'none' }, []],
  ])('%o → %o', (over, expected) => {
    expect(labels(v(over))).toEqual(expected);
  });
});

describe('영상 목록 거르기와 게시 대기', () => {
  const m = (percent: number) => ({ percent, matched: percent >= 50, threshold: 50 });
  it('초안 없음 · 초안 있음 · 게시 완료 · 매칭 낮음', async () => {
    const { inVideoFilter, isReadyToPost } = await import('./badges');
    const none = v({ draftState: 'none', topicMatch: null });
    const failed = v({ draftState: 'error', topicMatch: null });
    const ready = v({ draftState: 'ready', checkPassed: true, topicMatch: m(85) });
    const low = v({ draftState: 'ready', checkPassed: false, topicMatch: m(32) });
    const done = v({ draftState: 'ready', checkPassed: true, commented: true, topicMatch: m(72) });
    expect([none, failed, ready, low, done].filter((x) => inVideoFilter(x, 'none'))).toEqual([none, failed]);
    expect([none, failed, ready, low, done].filter((x) => inVideoFilter(x, 'has'))).toEqual([ready, low]);
    expect([none, failed, ready, low, done].filter((x) => inVideoFilter(x, 'done'))).toEqual([done]);
    expect([none, failed, ready, low, done].filter((x) => inVideoFilter(x, 'low'))).toEqual([low]);
    expect([none, failed, ready, low, done].filter(isReadyToPost)).toEqual([ready]);
  });
});

describe('주제 매칭 배지 (작업 목록 행)', () => {
  it('기준 이상은 매칭 %, 미만은 매칭 낮음 %, 판단 전은 없음', async () => {
    const { topicMatchBadge } = await import('./badges');
    expect(topicMatchBadge({ percent: 82, matched: true, threshold: 50 })).toEqual({ tone: 'success', label: '매칭 82%' });
    expect(topicMatchBadge({ percent: 32, matched: false, threshold: 50 })).toEqual({ tone: 'warning', label: '매칭 낮음 32%' });
    expect(topicMatchBadge(null)).toBeNull();
  });
});
