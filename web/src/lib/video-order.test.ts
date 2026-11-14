import type { VideoItem } from '../api/types';
import { readyNeighbors, sortVideos } from './video-order';

/** 시험용 영상 */
function v(id: number, over: Partial<VideoItem> = {}): VideoItem {
  return {
    id, youtubeId: `y${id}`, url: '', title: `영상 ${id}`, channelTitle: '', publishedAt: `2026-11-0${id}T00:00:00Z`,
    viewCount: id * 100, durationSec: 60, thumbnailUrl: null, rank: null, source: 'search', isMine: false,
    commented: false, commentCount: 0, draftState: 'none', checkPassed: false, searchPosition: id, matchedKeywords: [], topicMatch: null,
    ...over,
  };
}
const ready = { draftState: 'ready', checkPassed: true } as const;

describe('영상 정렬 (관련도 · 조회수 · 최신)', () => {
  const list = [v(1, { searchPosition: 3 }), v(2, { searchPosition: null, source: 'manual' }), v(3, { searchPosition: 1 })];

  it('관련도: 검색 순위대로, 링크로 넣은 영상은 뒤에', () => {
    expect(sortVideos(list, 'rel').map((x) => x.id)).toEqual([3, 1, 2]);
  });

  it('조회수 · 최신', () => {
    expect(sortVideos(list, 'views').map((x) => x.id)).toEqual([3, 2, 1]);
    expect(sortVideos(list, 'new').map((x) => x.id)).toEqual([3, 2, 1]);
  });

  it('원본은 그대로 둔다', () => {
    sortVideos(list, 'rel');
    expect(list.map((x) => x.id)).toEqual([1, 2, 3]);
  });
});

describe('작업 상세 앞뒤 게시 대기', () => {
  const list = [v(1, ready), v(2), v(3, ready), v(4, { ...ready, commented: true }), v(5, ready)];

  it('게시 대기 안에서 몇 번째인지와 앞뒤', () => {
    const n = readyNeighbors(list, 3);
    expect(n.index).toBe(2);
    expect(n.total).toBe(3);
    expect(n.prev?.id).toBe(1);
    expect(n.next?.id).toBe(5);
  });

  it('방금 게시해 게시 대기에서 빠져도 그 자리 다음 영상으로 간다', () => {
    const posted = list.map((x) => (x.id === 3 ? { ...x, commented: true } : x));
    const n = readyNeighbors(posted, 3);
    expect(n.index).toBeNull();
    expect(n.total).toBe(2);
    expect(n.next?.id).toBe(5);
    expect(n.prev?.id).toBe(1);
  });

  it('마지막이면 처음부터 남은 영상, 남은 게 없으면 null', () => {
    expect(readyNeighbors(list, 5).next?.id).toBe(1);
    expect(readyNeighbors([v(1, ready)], 1).next).toBeNull();
  });
});
