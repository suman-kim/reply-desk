import { VideoSortBy } from '../topics/topic.entity.js';
import { rankVideos } from './videos.service.js';
import type { YoutubeVideoInfo } from './youtube/youtube-client.js';

/** 테스트용 영상 */
function v(id: string, views: number, publishedAt: string): YoutubeVideoInfo {
  return {
    youtubeId: id,
    title: id,
    channelId: 'UC',
    channelTitle: 'ch',
    publishedAt: new Date(publishedAt),
    viewCount: views,
    durationSec: 60,
    thumbnailUrl: null,
  };
}

const after = new Date('2026-11-06T00:00:00Z');
const infos = [
  v('a', 2340, '2026-11-13T00:00:00Z'),
  v('b', 12400, '2026-11-11T00:00:00Z'),
  v('c', 4870, '2026-11-12T00:00:00Z'),
  v('old', 99999, '2026-10-01T00:00:00Z'),
  v('b', 12400, '2026-11-11T00:00:00Z'),
];

describe('rankVideos', () => {
  it('기간 밖 영상과 중복을 빼고 조회수 높은 순으로 고른다', () => {
    const r = rankVideos(
      infos,
      { videoSortBy: VideoSortBy.ViewCount, fetchLimit: 5 },
      after,
    );
    expect(r.map((x) => x.youtubeId)).toEqual(['b', 'c', 'a']);
  });

  it('최신순과 개수 제한을 따른다', () => {
    const r = rankVideos(
      infos,
      { videoSortBy: VideoSortBy.Date, fetchLimit: 2 },
      after,
    );
    expect(r.map((x) => x.youtubeId)).toEqual(['a', 'c']);
  });
});
