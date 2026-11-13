import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Subscription } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DraftQueueService } from '../src/drafts/draft-queue.service.js';
import type { AppEvent } from '../src/events/app-events.js';
import { EventsService } from '../src/events/events.service.js';
import { PublishService } from '../src/publish/publish.service.js';
import { createTestApp, type FakeBrowser } from './support/test-app.js';

/** 영상 카드 일부 */
interface Card {
  id: number;
  youtubeId: string;
}

/**
 * SSE 연결을 열어 원하는 이벤트가 올 때까지 읽는다.
 * @param url 이벤트 주소
 * @param until 이 이벤트 이름이 나오면 멈춘다
 * @param trigger 연결이 열린 뒤 할 일
 * @returns 받은 SSE 원문
 */
async function readSse(
  url: string,
  until: string,
  trigger: () => Promise<void>,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const res = await fetch(url, {
    signal: ctrl.signal,
    headers: { accept: 'text/event-stream' },
  });
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  await trigger();
  try {
    while (!text.includes(`event: ${until}`)) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    // 그 이벤트의 data 줄까지 마저 읽는다
    while (!text.endsWith('\n\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
  return text;
}

describe('실시간 이벤트 (e2e)', () => {
  let app: INestApplication<App>;
  let browser: FakeBrowser;
  let base: string;
  let topicId: number;
  let otherTopicId: number;
  let profileId: number;
  let cards: Record<string, Card>;
  const seen: AppEvent[] = [];
  let sub: Subscription;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, browser } = await createTestApp());
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as unknown as Server;
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    sub = app
      .get(EventsService)
      .asObservable()
      .subscribe((e) => seen.push(e));

    const profile = await http()
      .post('/api/profiles')
      .send({ name: '유튜브1' })
      .expect(201);
    profileId = profile.body.id;
    await http().post(`/api/profiles/${profileId}/check`).expect(201);
    const make = (name: string) =>
      http()
        .post('/api/topics')
        .send({
          name,
          brandTarget: '운명원 · 연애 사주',
          brandWord: '운명원',
          keywords: ['연애'],
          profileIds: [profileId],
        })
        .expect(201);
    topicId = (await make('운명원 연애 사주')).body.id;
    otherTopicId = (await make('다른 주제')).body.id;
  });

  afterAll(async () => {
    sub?.unsubscribe();
    await app?.close();
  });

  it('로그인 확인 결과를 profile.updated로 알린다', () => {
    expect(seen).toContainEqual({
      type: 'profile.updated',
      profileId,
      name: '유튜브1',
      loginStatus: 'ok',
    });
  });

  it('[초안 작성]: 카드 배지(draft.updated)를 작성 중 → 준비됨·실패로 차례로 보낸다', async () => {
    const loaded = await http().post(`/api/topics/${topicId}/load`).expect(201);
    seen.length = 0;
    for (const v of loaded.body.videos as Card[]) {
      await http()
        .post(`/api/topics/${topicId}/videos/${v.id}/draft`)
        .send({})
        .expect(201);
    }
    await app.get(DraftQueueService).whenIdle();

    const updates = seen.filter((e) => e.type === 'draft.updated');
    expect(
      updates.filter(
        (u) => u.type === 'draft.updated' && u.state === 'writing',
      ),
    ).toHaveLength(3);
    expect(
      updates.filter((u) => u.type === 'draft.updated' && u.state === 'ready'),
    ).toHaveLength(2);
    expect(
      updates.find((u) => u.type === 'draft.updated' && u.state === 'error'),
    ).toMatchObject({
      errorMessage: '테스트용 분석 실패 · [다시 생성]을 눌러 주세요',
    });

    const list = await http().get(`/api/topics/${topicId}/videos`).expect(200);
    cards = Object.fromEntries(list.body.map((v: Card) => [v.youtubeId, v]));
  });

  it('[댓글 달기]: 5단계 진행·입력 글자 수·미리보기·끝·오늘 게시 수를 보낸다', async () => {
    seen.length = 0;
    await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/post`)
      .send({})
      .expect(201);
    await app.get(PublishService).whenIdle();

    const progress = seen.filter((e) => e.type === 'post.progress');
    const runningSteps = progress.map((p) =>
      p.type === 'post.progress'
        ? p.steps.find((s) => s.state === 'running')?.step
        : null,
    );
    expect([...new Set(runningSteps)]).toEqual([
      'open_profile',
      'find_comment_box',
      'type',
      'submit',
      'verify',
    ]);
    const typing = progress
      .map((p) => (p.type === 'post.progress' ? p.typing : null))
      .filter((t) => t && t.typed > 0);
    expect(typing.at(-1)!.typed).toBe(typing.at(-1)!.total);

    expect(seen.some((e) => e.type === 'post.preview' && e.seq >= 1)).toBe(
      true,
    );
    expect(seen.find((e) => e.type === 'post.finished')).toMatchObject({
      status: 'success',
      videoId: cards.demo00000v2.id,
      commentUrl: 'https://www.youtube.com/watch?v=demo00000v2&lc=fake',
    });
    expect(seen.find((e) => e.type === 'quota.updated')).toMatchObject({
      posted: 1,
      cap: 10,
      byTopic: { [topicId]: 1 },
    });
  });

  it('로그인이 풀리면 실패와 프로필 상태를 함께 알린다', async () => {
    seen.length = 0;
    await http()
      .post(`/api/topics/${topicId}/videos`)
      .send({ url: 'manual00001' })
      .expect(201);
    const manual = (
      await http().get(`/api/topics/${topicId}/videos`).expect(200)
    ).body.find((v: Card) => v.youtubeId === 'manual00001');
    await http()
      .post(`/api/topics/${topicId}/videos/${manual.id}/draft`)
      .send({})
      .expect(201);
    await app.get(DraftQueueService).whenIdle();

    browser.commentBox.set('manual00001', 'login_required');
    await http()
      .post(`/api/topics/${topicId}/videos/${manual.id}/post`)
      .send({})
      .expect(201);
    await app.get(PublishService).whenIdle();

    expect(seen.find((e) => e.type === 'post.finished')).toMatchObject({
      status: 'failed',
      failureReason: '로그인이 풀렸어요 · [계정 관리]에서 다시 로그인해 주세요',
      hasCapture: true,
    });
    expect(seen).toContainEqual({
      type: 'profile.updated',
      profileId,
      name: '유튜브1',
      loginStatus: 'needs_login',
    });
  });

  it('사람이 초안을 고치면 draft.updated로 알린다', async () => {
    seen.length = 0;
    const d = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .expect(200);
    await http()
      .patch(`/api/drafts/${d.body.draft.id}`)
      .send({ text: '짧은 글' })
      .expect(200);
    expect(seen).toContainEqual(
      expect.objectContaining({
        type: 'draft.updated',
        draftId: d.body.draft.id,
        checkPassed: false,
        state: 'ready',
      }),
    );
  });

  it('GET /api/events: SSE로 보내고, 보고 있는 주제의 이벤트만 보낸다', async () => {
    const events = app.get(EventsService);
    const raw = await readSse(
      `${base}/events?topicId=${topicId}`,
      'post.preview',
      async () => {
        events.emit({
          type: 'post.preview',
          attemptId: 99,
          topicId: otherTopicId,
          seq: 1,
        });
        events.emit({ type: 'post.preview', attemptId: 42, topicId, seq: 7 });
      },
    );
    expect(raw).toContain('event: post.preview');
    expect(raw).toContain('"attemptId":42');
    expect(raw).not.toContain('"attemptId":99');
    expect(raw).toMatch(/^id: \d+$/m);

    await request(base).get('/events?topicId=abc').expect(400);
  });
});
