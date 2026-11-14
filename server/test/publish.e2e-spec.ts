import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { DraftQueueService } from '../src/drafts/draft-queue.service.js';
import { PostAttempt, PostStatus } from '../src/posting/post-attempt.entity.js';
import { PublishService } from '../src/publish/publish.service.js';
import {
  createTestApp,
  MY_CHANNEL,
  type FakeBrowser,
  type TestContext,
} from './support/test-app.js';

/** 영상 카드 일부 */
interface Card {
  id: number;
  youtubeId: string;
}

/** 두 번째 계정의 채널 */
const SECOND_CHANNEL = 'UC_SECOND_CHANNEL_00000';

describe('로그인 확인과 댓글 게시 (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let browser: FakeBrowser;
  let ai: TestContext['ai'];
  let publish: PublishService;
  let topicId: number;
  let p1: { id: number; folderPath: string };
  let p2: { id: number };
  let cards: Record<string, Card>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, ds, browser, ai } = await createTestApp());
    publish = app.get(PublishService);
    p1 = (
      await http().post('/api/profiles').send({ name: '유튜브1' }).expect(201)
    ).body;
    p2 = (
      await http().post('/api/profiles').send({ name: '유튜브2' }).expect(201)
    ).body;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('로그인: 일반 크롬을 열고, [로그인 확인]으로 채널을 내 채널 목록에 넣는다', async () => {
    const open = await http().post(`/api/profiles/${p1.id}/login`).expect(201);
    expect(open.body.message).toContain('[연결 확인]');
    expect(browser.manualLogins).toEqual([p1.folderPath]);

    // 로그인 안 됨 → 다시 로그인 필요
    browser.login = {
      loggedIn: false,
      channelId: null,
      channelTitle: null,
      uiLanguage: 'ko-KR',
    };
    const out = await http().post(`/api/profiles/${p1.id}/check`).expect(201);
    expect(out.body).toMatchObject({
      warning: true,
      profile: { loginStatus: 'needs_login' },
    });

    // 로그인됨 → 연결 완료
    browser.login = {
      loggedIn: true,
      channelId: MY_CHANNEL,
      channelTitle: '내 채널',
      uiLanguage: 'ko-KR',
    };
    const ok = await http().post(`/api/profiles/${p1.id}/check`).expect(201);
    expect(ok.body).toMatchObject({
      warning: false,
      message: '연결 완료 · 내 채널 채널이 내 채널 목록에 들어갔어요',
      profile: {
        loginStatus: 'ok',
        channelId: MY_CHANNEL,
        uiLanguage: 'ko-KR',
      },
    });

    // 다른 프로필이 같은 채널로 로그인하면 막는다
    const dup = await http().post(`/api/profiles/${p2.id}/check`).expect(409);
    expect(dup.body.message).toContain('유튜브1 프로필에 연결돼 있어요');

    // 화면 언어가 한국어가 아니면 연결은 하되 경고
    browser.login = {
      loggedIn: true,
      channelId: SECOND_CHANNEL,
      channelTitle: '둘째',
      uiLanguage: 'en',
    };
    const en = await http().post(`/api/profiles/${p2.id}/check`).expect(201);
    expect(en.body).toMatchObject({
      warning: true,
      profile: { loginStatus: 'ok' },
    });
    expect(en.body.message).toContain('한국어가 아니에요');
  });

  it('준비: 주제를 만들고 초안을 쓴다', async () => {
    const topic = await http()
      .post('/api/topics')
      .send({
        name: '운명원 연애 사주',
        brandTarget: '운명원 · 연애 사주 잘 보는 곳',
        brandWord: '운명원',
        keywords: ['연애'],
        profileIds: [p1.id, p2.id],
      })
      .expect(201);
    topicId = topic.body.id;
    const loaded = await http().post(`/api/topics/${topicId}/load`).expect(201);
    // 불러오기는 초안을 쓰지 않는다 · 게시해 볼 영상만 [초안 작성]
    for (const v of loaded.body.videos as Card[]) {
      await http()
        .post(`/api/topics/${topicId}/videos/${v.id}/draft`)
        .send({})
        .expect(201);
    }
    const manual = await http()
      .post(`/api/topics/${topicId}/videos`)
      .send({ url: 'manual00001' })
      .expect(201);
    await http()
      .post(`/api/topics/${topicId}/videos/${manual.body.id}/draft`)
      .send({})
      .expect(201);
    await app.get(DraftQueueService).whenIdle();

    const list = await http().get(`/api/topics/${topicId}/videos`).expect(200);
    cards = Object.fromEntries(list.body.map((v: Card) => [v.youtubeId, v]));
  });

  it('[댓글 달기]: 자동 배정 프로필로 5단계를 돌고 게시 완료를 남긴다', async () => {
    const res = await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/post`)
      .send({})
      .expect(201);
    // 가짜 크롬은 빨라서 응답 전에 끝났을 수도 있다
    expect(['running', 'success']).toContain(res.body.status);
    expect(res.body.profileName).toBe('유튜브1');
    await publish.whenIdle();

    const done = await http()
      .get(`/api/posting/attempts/${res.body.id}`)
      .expect(200);
    expect(done.body).toMatchObject({
      status: 'success',
      commentUrl: 'https://www.youtube.com/watch?v=demo00000v2&lc=fake',
      failureReason: null,
      hasPreview: true,
      // 게시된 댓글이 보이는 화면을 로컬에 저장한다 (댓글 게시 목록의 캡처)
      hasCapture: true,
    });
    const successCapture = await http()
      .get(`/api/posting/attempts/${res.body.id}/capture`)
      .expect(200);
    expect(successCapture.headers['content-type']).toBe('image/png');
    expect(
      done.body.steps.map(
        (s: { label: string; state: string }) => `${s.label}:${s.state}`,
      ),
    ).toEqual([
      '프로필 여는 중:done',
      '댓글 창 찾는 중:done',
      '한 글자씩 입력 중:done',
      '게시:done',
      '내 댓글 확인:done',
    ]);
    expect(done.body.typing.typed).toBe(done.body.typing.total);
    // 시연용 기본값: 크롬 창을 띄운다
    expect(browser.opened.at(-1)).toEqual({
      dir: p1.folderPath,
      headless: false,
    });

    const preview = await http()
      .get(`/api/posting/attempts/${res.body.id}/preview`)
      .expect(200);
    expect(preview.headers['content-type']).toBe('image/png');

    // 기록·오늘 현황·초안 목록에 반영
    expect(
      (await http().get('/api/posting/today').expect(200)).body.posted,
    ).toBe(1);
    const drafts = await http()
      .get(`/api/drafts?topicId=${topicId}&status=posted`)
      .expect(200);
    expect(
      drafts.body.rows.map((r: { video: Card }) => r.video.youtubeId),
    ).toEqual(['demo00000v2']);
    // 작업 목록에 더 보이는 정보: 유튜브 주소·조회수·올린 날짜·길이, 쓴 AI, 댓글 주소
    expect(drafts.body.rows[0]).toMatchObject({
      video: {
        url: 'https://www.youtube.com/watch?v=demo00000v2',
        viewCount: expect.any(Number),
        publishedAt: expect.any(String),
        durationSec: expect.any(Number),
      },
      provider: expect.any(String),
      model: expect.any(String),
      commentUrl: 'https://www.youtube.com/watch?v=demo00000v2&lc=fake',
    });
  });

  it('막힐 때는 409와 차단 사유 한 줄', async () => {
    const again = await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/post`)
      .send({})
      .expect(409);
    // 기본은 영상당 1개: 설정 켜는 곳을 알려 준다 (RD-27)
    expect(again.body).toMatchObject({
      code: 'already_commented',
      message: expect.stringContaining('같은 영상에 댓글 더 달기'),
    });

    // 다른 채널 영상: 사람이 광고 표시를 지워도 막지 않는다 (RD-28)
    const { body: o } = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .expect(200);
    expect(o.draft.text.startsWith('[광고] ')).toBe(true);
    await http()
      .patch(`/api/drafts/${o.draft.id}`)
      .send({ text: o.draft.text.replace('[광고] ', '') })
      .expect(200);
    const other = await http()
      .get(`/api/topics/${topicId}/post-check?videoId=${cards.demo00000v1.id}`)
      .expect(200);
    expect(other.body.block?.code).not.toBe('ad_disclosure_missing');
    await http()
      .patch(`/api/drafts/${o.draft.id}`)
      .send({ text: o.draft.aiText })
      .expect(200);
  });

  it('같은 영상에 한 번 더 (RD-27): 기본은 막고, 설정을 켜면 새 초안은 이미 단 댓글을 받아 다른 글로 쓰고, 다시 게시하면 기록이 둘 남는다', async () => {
    const v = cards.demo00000v2.id;
    const first = await http()
      .get(`/api/topics/${topicId}/videos/${v}/draft`)
      .expect(200);
    expect(first.body.status.code).toBe('posted');
    expect(first.body.morePerVideo).toBe(false);
    const firstText = first.body.draft.text as string;

    // 기본(영상당 1개)이면 이미 단 영상에는 새 초안도 쓰지 않는다
    const refused = await http()
      .post(`/api/topics/${topicId}/videos/${v}/draft`)
      .send({})
      .expect(409);
    expect(refused.body.message).toContain('같은 영상에 댓글 더 달기');

    // 설정 → 게시 → '같은 영상에 댓글 더 달기' 켜기
    await http()
      .put('/api/settings/posting.morePerVideo')
      .send({ value: true })
      .expect(200);
    const opened = await http()
      .get(`/api/topics/${topicId}/videos/${v}/draft`)
      .expect(200);
    expect(opened.body).toMatchObject({
      morePerVideo: true,
      status: { code: 'posted' },
    });

    // [새 초안 쓰고 한 번 더 달기] = 다시 생성
    await http()
      .post(`/api/topics/${topicId}/videos/${v}/draft`)
      .send({})
      .expect(201);
    await app.get(DraftQueueService).whenIdle();
    const fresh = await http()
      .get(`/api/topics/${topicId}/videos/${v}/draft`)
      .expect(200);
    expect(fresh.body.status.code).toBe('pending');
    expect(fresh.body.video).toMatchObject({
      commented: false,
      commentCount: 1,
    });
    expect(fresh.body.draft.text).not.toBe(firstText);
    // AI에게 이미 단 댓글을 넘겼다 (설정에서 쓰는 모델이 무엇이든 마지막 작성 요청)
    const draftCalls = Object.values(ai)
      .flatMap((a) => a.calls)
      .filter((c) => c.prompt.includes('[근거 장면]'));
    expect(draftCalls.at(-1)!.prompt).toContain(
      `[이미 이 영상에 단 댓글]\n- ${firstText}`,
    );
    expect(
      fresh.body.draft.checkResults.find(
        (r: { code: string }) => r.code === 'not_duplicate',
      ),
    ).toMatchObject({ passed: true });

    // 이미 단 댓글과 같은 글로 고치면 검사에 걸린다
    const same = await http()
      .patch(`/api/drafts/${fresh.body.draft.id}`)
      .send({ text: firstText })
      .expect(200);
    expect(same.body.checkPassed).toBe(false);
    await http()
      .patch(`/api/drafts/${fresh.body.draft.id}`)
      .send({ text: fresh.body.draft.aiText })
      .expect(200);

    const res = await http()
      .post(`/api/topics/${topicId}/videos/${v}/post`)
      .send({})
      .expect(201);
    await publish.whenIdle();
    expect(
      (await http().get(`/api/posting/attempts/${res.body.id}`).expect(200))
        .body.status,
    ).toBe('success');

    const after = await http()
      .get(`/api/topics/${topicId}/videos/${v}/draft`)
      .expect(200);
    expect(after.body.status.code).toBe('posted');
    expect(after.body.video).toMatchObject({
      commented: true,
      commentCount: 2,
    });
    expect(
      after.body.attempts
        .filter((a: { status: string }) => a.status === 'success')
        .map((a: { commentText: string }) => a.commentText),
    ).toEqual([fresh.body.draft.aiText, firstText]);

    // 다시 끄면 이 영상은 영상당 1개 규칙으로 막힌다 (다음 시험을 위해 기본값으로 되돌린다)
    await http().delete('/api/settings/posting.morePerVideo').expect(200);
    const off = await http()
      .get(`/api/topics/${topicId}/post-check?videoId=${v}`)
      .expect(200);
    expect(off.body.block.code).toBe('already_commented');
  });

  it('실패: 로그인이 풀렸으면 그 단계에서 멈추고, 캡처를 남기고, 프로필을 다시 로그인 필요로 바꾼다', async () => {
    browser.commentBox.set('manual00001', 'login_required');
    const res = await http()
      .post(`/api/topics/${topicId}/videos/${cards.manual00001.id}/post`)
      .send({ profileId: p2.id })
      .expect(201);
    expect(res.body.profileName).toBe('유튜브2');
    await publish.whenIdle();

    const failed = await http()
      .get(`/api/posting/attempts/${res.body.id}`)
      .expect(200);
    expect(failed.body).toMatchObject({
      status: 'failed',
      failureReason: '로그인이 풀렸어요 · [계정 관리]에서 다시 로그인해 주세요',
      hasCapture: true,
    });
    expect(failed.body.steps.map((s: { state: string }) => s.state)).toEqual([
      'done',
      'failed',
      'waiting',
      'waiting',
      'waiting',
    ]);

    const capture = await http()
      .get(`/api/posting/attempts/${res.body.id}/capture`)
      .expect(200);
    expect(capture.headers['content-type']).toBe('image/png');
    expect(
      (await http().get(`/api/profiles/${p2.id}`).expect(200)).body.loginStatus,
    ).toBe('needs_login');

    // 실패한 영상은 초안 목록에서 '실패'([다시 게시])로 보이고, 기록에 원인이 남는다
    const drafts = await http()
      .get(`/api/drafts?topicId=${topicId}&status=failed`)
      .expect(200);
    expect(
      drafts.body.rows.map((r: { video: Card }) => r.video.youtubeId),
    ).toEqual(['manual00001']);
    const logs = await http()
      .get(`/api/posting/logs?topicId=${topicId}`)
      .expect(200);
    expect(logs.body[0]).toMatchObject({
      status: 'failed',
      failedStep: 'find_comment_box',
      hasScreenshot: true,
    });

    // 로그인이 풀린 프로필로는 다시 못 단다
    const blocked = await http()
      .post(`/api/topics/${topicId}/videos/${cards.manual00001.id}/post`)
      .send({ profileId: p2.id })
      .expect(409);
    expect(blocked.body.code).toBe('profile_unavailable');

    // 다른 프로필로 [다시 게시]하면 된다
    browser.commentBox.delete('manual00001');
    const retry = await http()
      .post(`/api/topics/${topicId}/videos/${cards.manual00001.id}/post`)
      .send({ profileId: p1.id })
      .expect(201);
    await publish.whenIdle();
    expect(
      (await http().get(`/api/posting/attempts/${retry.body.id}`).expect(200))
        .body.status,
    ).toBe('success');
  });

  it('없는 게시 기록·캡처는 404, 서버가 다시 뜨면 게시 중 행을 실패로 바꾼다', async () => {
    await http().get('/api/posting/attempts/9999').expect(404);
    await http().get('/api/posting/attempts/9999/preview').expect(404);

    const repo = ds.getRepository(PostAttempt);
    const row = await repo.save(
      repo.create({
        topicId,
        videoId: cards.demo00000v1.id,
        profileId: p1.id,
        commentText: 'x',
        status: PostStatus.Running,
      }),
    );
    await publish.onModuleInit();
    const after = await repo.findOneByOrFail({ id: row.id });
    expect(after.status).toBe('failed');
    expect(after.failureReason).toContain('직접 확인해 주세요');
  });
});
