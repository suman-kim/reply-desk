import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, type TestContext } from './support/test-app.js';

/** 불러오기 결과의 검색 정보 */
interface SearchRun {
  mode: 'cached' | 'incremental' | 'full';
  lastSearchedAt: string | null;
  nextSearchAt: string | null;
  quotaUsed: number;
  newVideos: number;
}

describe('유튜브 할당량 줄이기: 최근 검색 재사용 + 새 영상만 검색 (e2e)', () => {
  let ctx: TestContext;
  let app: INestApplication<App>;
  let topicId: number;
  const http = () => request(app.getHttpServer());
  /** [영상 불러오기] (force면 [새로 검색]) */
  const load = async (force = false) =>
    (
      await http()
        .post(`/api/topics/${topicId}/load`)
        .send(force ? { force: true } : {})
        .expect(201)
    ).body as { videos: { youtubeId: string }[]; search: SearchRun };

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    const topic = await http()
      .post('/api/topics')
      .send({
        name: '캐시 시험',
        brandTarget: '운명원',
        keywords: ['연애', '재회'],
        videoWindowDays: 7,
        fetchLimit: 0,
      })
      .expect(201);
    topicId = topic.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('처음: 기간 전체를 검색하고, 쓴 할당량(검색 한 쪽 100 + 정보 1)을 알려 준다', async () => {
    const before = ctx.youtube.searches;
    const res = await load();
    expect(ctx.youtube.searches).toBe(before + 1);
    expect(res.search).toMatchObject({ mode: 'full', quotaUsed: 101 });
    expect(res.search.newVideos).toBeGreaterThan(0);
    expect(res.videos.length).toBeGreaterThan(0);
    expect(res.search.lastSearchedAt).toEqual(expect.any(String));
    expect(res.search.nextSearchAt).toEqual(expect.any(String));
  });

  it('기준 시간(기본 60분) 안에 다시 누르면 검색하지 않고 저장된 목록 (할당량 0)', async () => {
    const before = ctx.youtube.searches;
    const res = await load();
    expect(ctx.youtube.searches).toBe(before);
    expect(res.search).toMatchObject({
      mode: 'cached',
      quotaUsed: 0,
      newVideos: 0,
    });
    expect(res.videos.length).toBeGreaterThan(0);

    // 누르기 전에 화면이 보는 상태
    const status = await http()
      .get(`/api/topics/${topicId}/videos/search-status`)
      .expect(200);
    expect(status.body).toMatchObject({
      cacheMinutes: 60,
      lastSearchedAt: res.search.lastSearchedAt,
      nextSearchAt: res.search.nextSearchAt,
    });
  });

  it('[새로 검색]: 지난 검색 뒤 올라온 영상만 찾고, 이미 있는 영상은 정보만 다시 받는다', async () => {
    const res = await load(true);
    expect(res.search.mode).toBe('incremental');
    // 지난 검색 2시간 전부터만 검색한다 (기간 7일 전체가 아니라)
    const after = ctx.youtube.lastSearch!.publishedAfter!.getTime();
    expect(Date.now() - after).toBeLessThan(3 * 60 * 60 * 1000);
    expect(res.search.quotaUsed).toBe(101);
    // 가짜 검색은 늘 같은 영상을 주니 새로 들어온 영상은 없다
    expect(res.search.newVideos).toBe(0);
  });

  it('검색과 상관없는 칸(말투)만 바꾸면 저장된 목록을 그대로 쓴다', async () => {
    await http()
      .patch(`/api/topics/${topicId}`)
      .send({ tone: '차분한 말투' })
      .expect(200);
    const before = ctx.youtube.searches;
    const res = await load();
    expect(res.search.mode).toBe('cached');
    expect(ctx.youtube.searches).toBe(before);
  });

  it('주제 설정(키워드)을 바꾸면 다음 불러오기는 기간 전체를 다시 검색한다', async () => {
    await http()
      .patch(`/api/topics/${topicId}`)
      .send({ keywords: ['연애', '썸'] })
      .expect(200);
    const res = await load();
    expect(res.search.mode).toBe('full');
    const after = ctx.youtube.lastSearch!.publishedAfter!.getTime();
    expect(Date.now() - after).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it('기준 시간을 0으로 두면 매번 검색한다', async () => {
    await http()
      .put('/api/settings/youtube.searchCacheMinutes')
      .send({ value: 0 })
      .expect(200);
    const before = ctx.youtube.searches;
    const res = await load();
    expect(ctx.youtube.searches).toBe(before + 1);
    expect(res.search.mode).toBe('incremental');
    await http().delete('/api/settings/youtube.searchCacheMinutes').expect(200);
  });
});
