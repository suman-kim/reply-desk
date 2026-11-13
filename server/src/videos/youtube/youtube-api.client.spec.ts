import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import { YoutubeApiClient } from './youtube-api.client.js';

/** 키만 주는 설정 */
const config = { get: () => 'test-key' } as unknown as ConfigService<Env, true>;

/**
 * fetch를 바꿔 넣는다. 받은 주소를 남기고, 주소마다 정한 답을 준다.
 * @param answer 주소 → 응답 본문과 상태
 */
function stubFetch(answer: (url: URL) => { status?: number; body: unknown }) {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input);
      urls.push(url);
      const { status = 200, body } = answer(url);
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe('YoutubeApiClient', () => {
  it('검색: 50개를 넘게 원하면 다음 쪽을 이어 받고, 원하는 수에서 멈춘다', async () => {
    let page = 0;
    const urls = stubFetch(() => {
      page += 1;
      return {
        body: {
          items: Array.from({ length: 50 }, (_, i) => ({
            id: { videoId: `p${page}-${i}` },
          })),
          nextPageToken: `t${page}`,
        },
      };
    });
    const { ids, pages } = await new YoutubeApiClient(config).searchVideoIds({
      keywords: ['연애', '썸'],
      publishedAfter: null,
      order: 'viewCount',
      maxResults: 120,
    });
    expect(ids).toHaveLength(120);
    // 받은 쪽 수 = 쓴 검색 할당량 300
    expect(pages).toBe(3);
    expect(urls.map((u) => u.searchParams.get('maxResults'))).toEqual([
      '50',
      '50',
      '20',
    ]);
    expect(urls.map((u) => u.searchParams.get('pageToken'))).toEqual([
      null,
      't1',
      't2',
    ]);
    // 기간 무제한이면 publishedAfter를 넣지 않는다
    expect(urls[0].searchParams.has('publishedAfter')).toBe(false);
    expect(urls[0].searchParams.get('q')).toBe('연애|썸');
  });

  it('검색: 다음 쪽이 없으면 거기서 끝난다', async () => {
    stubFetch(() => ({ body: { items: [{ id: { videoId: 'a' } }] } }));
    const result = await new YoutubeApiClient(config).searchVideoIds({
      keywords: ['k'],
      publishedAfter: null,
      order: 'date',
      maxResults: 500,
    });
    expect(result).toEqual({ ids: ['a'], pages: 1 });
  });

  it('영상 정보: 50개씩 나눠 받는다', async () => {
    const urls = stubFetch(() => ({ body: { items: [] } }));
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    await new YoutubeApiClient(config).getVideos(ids);
    expect(
      urls.map((u) => u.searchParams.get('id')!.split(',').length),
    ).toEqual([50, 50, 20]);
  });

  it('댓글: 쓴 사람·좋아요·답글 수를 읽고, 막힌 영상은 막혔다고 준다', async () => {
    stubFetch(() => ({
      body: {
        items: [
          {
            id: 'c1',
            snippet: {
              totalReplyCount: 2,
              topLevelComment: {
                snippet: {
                  textDisplay: '좋아요',
                  likeCount: 5,
                  authorDisplayName: '@a',
                  publishedAt: '2026-11-12T00:00:00Z',
                },
              },
            },
          },
        ],
      },
    }));
    const client = new YoutubeApiClient(config);
    expect(await client.getComments('x', 30)).toMatchObject({
      disabled: false,
      comments: [
        { id: 'c1', author: '@a', text: '좋아요', likeCount: 5, replyCount: 2 },
      ],
    });

    stubFetch(() => ({
      status: 403,
      body: { error: { code: 403, errors: [{ reason: 'commentsDisabled' }] } },
    }));
    expect(await client.getComments('x', 30)).toEqual({
      disabled: true,
      comments: [],
    });
  });
});
