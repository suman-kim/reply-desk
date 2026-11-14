import type { VideoItem } from '../api/types';
import { videoBadges } from './badges';

const v = (over: Partial<VideoItem>) => ({ isMine: false, commented: false, draftState: 'none', checkPassed: false, ...over }) as VideoItem;
const labels = (x: VideoItem) => videoBadges(x).map((b) => b.label);

describe('영상 카드 배지', () => {
  it.each<[Partial<VideoItem>, string[]]>([
    [{ draftState: 'writing' }, ['초안 작성 중']],
    [{ draftState: 'ready', checkPassed: true, isMine: true }, ['초안 준비됨', '내 채널']],
    [{ draftState: 'ready', checkPassed: false }, ['검사 미통과']],
    [{ draftState: 'error' }, ['작성 실패']],
    [{ draftState: 'ready', checkPassed: true, commented: true, isMine: true }, ['댓글 완료', '내 채널']],
  ])('%o → %o', (over, expected) => {
    expect(labels(v(over))).toEqual(expected);
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
