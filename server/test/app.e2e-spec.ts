import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { Draft, DraftState } from '../src/drafts/draft.entity.js';
import { PostAttempt, PostStatus } from '../src/posting/post-attempt.entity.js';
import { Profile, ProfileLoginStatus } from '../src/profiles/profile.entity.js';
import {
  createTestApp,
  MY_CHANNEL,
  type FakeYoutube,
} from './support/test-app.js';

describe('reply-desk API (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let youtube: FakeYoutube;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, ds, youtube } = await createTestApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('서버와 DB가 살아 있다', async () => {
    await http().get('/api/health').expect(200, { ok: true, db: true });
  });

  it('DB 테이블과 컬럼에 comment가 모두 있다', async () => {
    const missing: { table_name: string; column_name: string }[] =
      await ds.query(`
      SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN pg_class t ON t.relname = c.table_name
      WHERE c.table_schema = 'public' AND c.table_name <> 'migrations'
        AND col_description(t.oid, c.ordinal_position) IS NULL`);
    expect(missing).toEqual([]);
    const noTableComment: { relname: string }[] = await ds.query(`
      SELECT relname FROM pg_class
      WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relname <> 'migrations'
        AND obj_description(oid) IS NULL`);
    expect(noTableComment).toEqual([]);
  });

  it('흐름: 프로필 → 주제 → 영상 불러오기 → 게시 판단 → 게시 기록', async () => {
    // 1. 프로필을 만들고, 로그인 확인을 마친 것처럼 채널을 넣는다 (Playwright 확인은 다음 작업)
    const profile = await http()
      .post('/api/profiles')
      .send({ name: '유튜브1' })
      .expect(201);
    expect(profile.body).toMatchObject({
      slug: 'youtube1',
      loginStatus: 'unknown',
      postedToday: 0,
    });
    await ds.getRepository(Profile).update(profile.body.id, {
      channelId: MY_CHANNEL,
      loginStatus: ProfileLoginStatus.Ok,
    });

    // 2. 주제를 만든다 (키워드 공백·중복은 정리된다)
    const topic = await http()
      .post('/api/topics')
      .send({
        name: '운명원 연애 사주',
        brandTarget: '운명원 · 연애 사주 잘 보는 곳',
        brandWord: '운명원',
        keywords: ['연애', ' 썸', '재회', '연애'],
        profileIds: [profile.body.id],
      })
      .expect(201);
    expect(topic.body).toMatchObject({
      keywords: ['연애', '썸', '재회'],
      dailyCap: 5,
      fetchLimit: 5,
    });
    const t = topic.body.id as number;

    // 3. 영상 불러오기: 기간 밖 영상은 빠지고 조회수 높은 순, 내 채널 표시
    const list = await http().post(`/api/topics/${t}/videos/fetch`).expect(201);
    expect(youtube.lastSearch?.keywords).toEqual(['연애', '썸', '재회']);
    expect(list.body.map((v: { youtubeId: string }) => v.youtubeId)).toEqual([
      'demo00000v3',
      'demo00000v2',
      'demo00000v1',
    ]);
    expect(list.body.map((v: { rank: number }) => v.rank)).toEqual([1, 2, 3]);
    const mine = list.body.find(
      (v: { youtubeId: string }) => v.youtubeId === 'demo00000v2',
    );
    expect(mine).toMatchObject({
      isMine: true,
      commented: false,
      draftState: 'none',
    });

    // 다시 불러와도 같은 영상이 겹쳐 쌓이지 않는다
    const again = await http()
      .post(`/api/topics/${t}/videos/fetch`)
      .expect(201);
    expect(again.body).toHaveLength(3);

    // 4. 게시 판단: 초안이 없으면 막힘
    const noDraft = await http()
      .get(`/api/topics/${t}/post-check?videoId=${mine.id}`)
      .expect(200);
    expect(noDraft.body.block.code).toBe('draft_not_ready');

    // 다른 채널 영상: 맨 앞에 광고 표시가 없으면 막고, 있으면 연다
    // (검사 결과가 낡았어도 게시 직전에 글을 다시 본다)
    const other = list.body.find(
      (v: { youtubeId: string }) => v.youtubeId === 'demo00000v3',
    );
    const otherDraft = await ds.getRepository(Draft).insert({
      topicId: t,
      videoId: other.id,
      state: DraftState.Ready,
      text: 'x',
      checkPassed: true,
    });
    const otherCheck = await http()
      .get(`/api/topics/${t}/post-check?videoId=${other.id}`)
      .expect(200);
    expect(otherCheck.body.block).toEqual({
      code: 'ad_disclosure_missing',
      message:
        '다른 채널 영상에는 맨 앞에 광고 표시("[광고]")가 있어야 게시돼요 · 초안 맨 앞에 넣어 주세요',
    });
    await ds
      .getRepository(Draft)
      .update(otherDraft.identifiers[0].id, { text: '[광고] x' });
    const otherOk = await http()
      .get(`/api/topics/${t}/post-check?videoId=${other.id}`)
      .expect(200);
    expect(otherOk.body).toMatchObject({ allowed: true, block: null });

    // 5. 검사를 통과한 초안이 생기면 열리고, 자동 배정으로 유튜브1이 이번 차례
    await ds.getRepository(Draft).insert({
      topicId: t,
      videoId: mine.id,
      state: DraftState.Ready,
      text: '댓글',
      checkPassed: true,
    });
    const ok = await http()
      .get(`/api/topics/${t}/post-check?videoId=${mine.id}`)
      .expect(200);
    expect(ok.body).toMatchObject({
      allowed: true,
      block: null,
      profile: { name: '유튜브1' },
      autoAssigned: true,
    });
    // 게시 대기: 내 채널 영상 1 + 광고 표시가 있는 다른 채널 영상 1
    expect(
      (await http().get(`/api/topics/${t}`).expect(200)).body.pendingDrafts,
    ).toBe(2);

    // 6. 게시 성공 기록이 생기면 영상당 1개 규칙으로 막히고, 오늘 게시 수가 오른다
    await ds.getRepository(PostAttempt).insert({
      topicId: t,
      videoId: mine.id,
      profileId: profile.body.id,
      commentText: '댓글',
      status: PostStatus.Success,
      finishedAt: new Date(),
    });
    const done = await http()
      .get(`/api/topics/${t}/post-check?videoId=${mine.id}`)
      .expect(200);
    expect(done.body.block.code).toBe('already_commented');
    expect(done.body.today).toMatchObject({
      posted: 1,
      cap: 10,
      topicPosted: 1,
      topicCap: 5,
    });
    expect(
      (await http().get(`/api/topics/${t}`).expect(200)).body,
    ).toMatchObject({ postedToday: 1, pendingDrafts: 1 }); // 남은 것: 다른 채널 영상
    expect(
      (await http().get(`/api/topics/${t}/videos/${mine.id}`).expect(200)).body
        .commented,
    ).toBe(true);

    // DB가 같은 영상의 두 번째 성공을 직접 막는다
    await expect(
      ds.getRepository(PostAttempt).insert({
        videoId: mine.id,
        commentText: '두 번째',
        status: PostStatus.Success,
      }),
    ).rejects.toThrow(/uq_post_attempt_video_success/);

    // 7. 게시 기록과 오늘 현황
    const logs = await http().get(`/api/posting/logs?topicId=${t}`).expect(200);
    expect(logs.body).toHaveLength(1);
    expect(logs.body[0]).toMatchObject({
      profileName: '유튜브1',
      status: 'success',
      // 댓글 게시 목록에 더 보이는 정보: 채널·유튜브 주소 (캡처는 publish e2e가 실제 게시로 본다)
      video: {
        youtubeId: 'demo00000v2',
        url: 'https://www.youtube.com/watch?v=demo00000v2',
        channelTitle: expect.any(String),
      },
    });
    expect(logs.body[0].finishedAt).toEqual(expect.any(String));
    expect(
      (await http().get('/api/posting/today').expect(200)).body,
    ).toMatchObject({ posted: 1, cap: 10 });
  });

  it('링크 직접 추가: 새 영상은 manual로, 이미 있는 영상은 그대로 둔다', async () => {
    const [topic] = (await http().get('/api/topics').expect(200)).body;
    const added = await http()
      .post(`/api/topics/${topic.id}/videos`)
      .send({ url: 'https://youtu.be/manual00001?si=x' })
      .expect(201);
    expect(added.body).toMatchObject({
      source: 'manual',
      rank: null,
      isMine: true,
    });

    const existing = await http()
      .post(`/api/topics/${topic.id}/videos`)
      .send({ url: 'https://www.youtube.com/watch?v=demo00000v1' })
      .expect(201);
    expect(existing.body).toMatchObject({ source: 'search', rank: 3 });

    const notFound = await http()
      .post(`/api/topics/${topic.id}/videos`)
      .send({ url: 'zzzzzzzzzzz' })
      .expect(404);
    expect(notFound.body.message).toContain('영상을 찾을 수 없어요');
  });

  it('잘못된 입력은 400과 한국어 원인을 돌려준다', async () => {
    const bad = await http()
      .post('/api/topics')
      .send({
        name: '',
        brandTarget: 'b',
        brandWord: 'w',
        keywords: ['k'],
        minLength: 200,
        maxLength: 100,
      })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'name: 주제 이름을 적어 주세요',
        'minLength: 최소 글자 수가 최대 글자 수보다 클 수 없어요',
      ]),
    );

    const overCap = await http()
      .post('/api/topics')
      .send({
        name: 'n',
        brandTarget: 'b',
        brandWord: 'w',
        keywords: ['k'],
        dailyCap: 11,
      })
      .expect(400);
    expect(overCap.body.message).toEqual([
      'dailyCap: 주제 하루 상한은 전체 하루 상한(10)보다 클 수 없어요',
    ]);

    // 브랜드 이름 없이 만들 수 있고(빈 값), 기간 0은 무제한이다
    const noBrand = await http()
      .post('/api/topics')
      .send({
        name: '브랜드 없는 주제',
        brandTarget: '운명원 · 연애 사주 잘 보는 곳',
        keywords: ['연애'],
        videoWindowDays: 0,
      })
      .expect(201);
    expect(noBrand.body).toMatchObject({ brandWord: '', videoWindowDays: 0 });
    await http().delete(`/api/topics/${noBrand.body.id}`).expect(200);

    await http().get('/api/topics/abc').expect(400);
    await http().get('/api/topics/9999').expect(404);

    const setting = await http()
      .put('/api/settings/posting.dailyCapTotal')
      .send({ value: 0 })
      .expect(400);
    expect(setting.body.message[0]).toMatch(/^전체 하루 게시 상한: .*1 이상/);
  });

  it('AI 선택 설정: 역할마다 제공자와 모델을 따로 고르고 되돌릴 수 있다', async () => {
    await http()
      .put('/api/settings/ai.analysis')
      .send({ value: { provider: 'ollama', model: 'qwen3:14b' } })
      .expect(200);
    const bad = await http()
      .put('/api/settings/ai.drafting')
      .send({ value: { provider: 'mistral', model: 'x' } })
      .expect(400);
    expect(bad.body.message[0]).toContain('댓글 작성 AI');

    const list = (await http().get('/api/settings').expect(200)).body as {
      key: string;
      value: unknown;
    }[];
    expect(list.find((s) => s.key === 'ai.analysis')?.value).toEqual({
      provider: 'ollama',
      model: 'qwen3:14b',
    });

    const reset = await http().delete('/api/settings/ai.analysis').expect(200);
    expect(reset.body).toMatchObject({
      isDefault: true,
      value: { provider: 'gemini' },
    });

    const providers = (
      await http().get('/api/settings/ai/providers').expect(200)
    ).body as { id: string; ready: boolean }[];
    expect(providers.map((p) => p.id)).toEqual([
      'gemini',
      'claude',
      'openai',
      'ollama',
    ]);

    // 모델 목록: 받은 목록에서 추천 모델을 앞에 두고 표시한다
    const gemini = await http()
      .get('/api/settings/ai/providers/gemini/models')
      .expect(200);
    expect(gemini.body).toMatchObject({
      provider: 'gemini',
      source: 'live',
      note: null,
      pricingSource: {
        url: 'https://aistudio.google.com/docs/pricing',
        checkedAt: '2026-11-13',
      },
      models: [
        {
          id: 'gemini-3.8-flash',
          label: 'Gemini 3.8 Flash',
          recommended: true,
          // 가격표에서: 무료 등급 있음, 입력 $0.75 · 출력 $3.75
          pricing: { free: true, inputPerM: 0.75, outputPerM: 3.75 },
        },
        // 가격표에 없는 모델은 가격을 지어내지 않는다
        { id: 'gemini-9-new', recommended: false, pricing: null },
      ],
    });
    // 키가 없으면 추천 목록과 이유
    const claude = await http()
      .get('/api/settings/ai/providers/claude/models?refresh=1')
      .expect(200);
    expect(claude.body).toMatchObject({
      source: 'recommended',
      note: expect.stringContaining('ANTHROPIC_API_KEY'),
    });
    expect(claude.body.models[0]).toMatchObject({
      id: 'claude-sonnet-5-5',
      label: 'claude-sonnet-5-5',
      recommended: true,
      // 추천 목록에도 가격을 붙인다 (Claude는 무료 없음)
      pricing: { free: false, inputPerM: 2, outputPerM: 10 },
    });
    await http().get('/api/settings/ai/providers/nope/models').expect(400);
  });
});
