import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { DraftQueueService } from '../src/drafts/draft-queue.service.js';
import { Draft, DraftState } from '../src/drafts/draft.entity.js';
import { Profile, ProfileLoginStatus } from '../src/profiles/profile.entity.js';
import {
  createTestApp,
  MY_CHANNEL,
  type TestContext,
} from './support/test-app.js';

/** 영상 카드 일부 */
interface Card {
  id: number;
  youtubeId: string;
  draftState: string;
}

describe('영상 분석·초안 작성 (e2e)', () => {
  let ctx: TestContext;
  let app: INestApplication<App>;
  let ds: DataSource;
  let queue: DraftQueueService;
  let topicId: number;
  let cards: Record<string, Card>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ app, ds } = ctx);
    queue = app.get(DraftQueueService);

    const profile = await http()
      .post('/api/profiles')
      .send({ name: '유튜브1' })
      .expect(201);
    await ds.getRepository(Profile).update(profile.body.id, {
      channelId: MY_CHANNEL,
      loginStatus: ProfileLoginStatus.Ok,
    });
    const topic = await http()
      .post('/api/topics')
      .send({
        name: '운명원 연애 사주',
        brandTarget: '운명원 · 연애 사주 잘 보는 곳',
        brandWord: '운명원',
        keywords: ['연애', '재회'],
        profileIds: [profile.body.id],
      })
      .expect(201);
    topicId = topic.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('[영상 불러오기]는 영상만 불러오고 초안은 쓰지 않는다 · ②의 [초안 작성]을 누른 영상만 쓴다', async () => {
    const res = await http().post(`/api/topics/${topicId}/load`).expect(201);
    expect(res.body.videos).toHaveLength(3);
    expect(res.body.videos.every((v: Card) => v.draftState === 'none')).toBe(
      true,
    );
    expect(ctx.ai.gemini.calls).toHaveLength(0);
    cards = Object.fromEntries(
      res.body.videos.map((v: Card) => [v.youtubeId, v]),
    );

    // ② 영상 선택에서 [초안 작성]: 누른 영상마다 쓴다 (차례로 하나씩)
    for (const id of ['demo00000v1', 'demo00000v2', 'demo00000v3']) {
      await http()
        .post(`/api/topics/${topicId}/videos/${cards[id].id}/draft`)
        .send({})
        .expect(201);
    }
    await queue.whenIdle();

    const list = await http().get(`/api/topics/${topicId}/videos`).expect(200);
    cards = Object.fromEntries(list.body.map((v: Card) => [v.youtubeId, v]));
    expect(cards.demo00000v2.draftState).toBe('ready');
    expect(cards.demo00000v3.draftState).toBe('error');
  });

  it('분석: 영상을 보는 AI(Gemini)에게 유튜브 주소를 넘기고, 원문에 없는 인용은 코드가 버린다', async () => {
    const d = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/draft`)
      .expect(200);
    const { analysis, draft, status } = d.body;

    expect(
      ctx.ai.gemini.calls.some(
        (c) => c.videoUrl === 'https://www.youtube.com/watch?v=demo00000v2',
      ),
    ).toBe(true);
    expect(analysis.provider).toBe('gemini');
    expect(analysis.scenes.map((s: { quote: string }) => s.quote)).toEqual([
      '스토리를 계속 확인한다면 아직 미련이 남았다는 신호예요',
      '읽씹 3일째인데 이거 보고 위로받고 갑니다',
    ]);
    expect(analysis.sceneKeywords).toEqual(['스토리', '미련']);
    // 주제와 매칭: AI가 매긴 퍼센트와 이유, 기준(기본 50%) 이상이면 매칭됨
    expect(analysis).toMatchObject({
      topicMatch: 82,
      topicMatchReason: '재회 연락을 기다리는 이야기라 연애 사주 주제와 가까움',
    });
    expect(analysis).not.toHaveProperty('worry');
    expect(d.body.topicMatch).toEqual({
      percent: 82,
      reason: '재회 연락을 기다리는 이야기라 연애 사주 주제와 가까움',
      matched: true,
      threshold: 50,
    });
    // 숫자는 코드가 채운다
    expect(analysis.pickReasons[0]).toMatch(
      /^(어제|\d+(시간|분) 전) 올라와 조회수가 오르는 중 \(4,870회\)$/,
    );

    // 작성: 기본 설정은 Claude, 검사를 통과해 게시 대기
    expect(draft).toMatchObject({
      state: 'ready',
      checkPassed: true,
      edited: false,
      provider: 'claude',
    });
    expect(draft.checkResults.map((r: { code: string }) => r.code)).toEqual([
      'length',
      'scene_mention',
      'brand_mention',
      'no_link_hashtag',
      'no_fake_review',
    ]);
    expect(status).toEqual({ code: 'pending', label: '게시 대기' });

    // 작업 목록 행에도 매칭 퍼센트
    const rows = (
      await http().get(`/api/drafts?topicId=${topicId}`).expect(200)
    ).body.rows;
    expect(
      rows.find((r: { video: Card }) => r.video.id === cards.demo00000v2.id)
        .topicMatch,
    ).toEqual({ percent: 82, matched: true, threshold: 50 });

    // 기준을 올리면 '매칭 낮음'으로 보인다 (초안·게시는 막지 않는다)
    await http()
      .put('/api/settings/analysis.topicMatchThreshold')
      .send({ value: 90 })
      .expect(200);
    const strict = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/draft`)
      .expect(200);
    expect(strict.body.topicMatch).toMatchObject({
      matched: false,
      threshold: 90,
    });
    expect(strict.body.status.code).toBe('pending');
    await http()
      .delete('/api/settings/analysis.topicMatchThreshold')
      .expect(200);

    // 게시 판단도 열린다
    const check = await http()
      .get(`/api/topics/${topicId}/post-check?videoId=${cards.demo00000v2.id}`)
      .expect(200);
    expect(check.body.allowed).toBe(true);
  });

  it('상태: 다른 채널 영상은 광고 표시를 붙여 게시 대기, 분석에 실패한 영상은 원인과 함께 작성 실패', async () => {
    const other = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .expect(200);
    expect(other.body.status.code).toBe('pending');
    expect(other.body.draft.text.startsWith('[광고] ')).toBe(true);
    expect(other.body.draft.checkResults.at(-1)).toMatchObject({
      code: 'ad_disclosure',
      passed: true,
    });

    // 사람이 광고 표시를 지우면 검사에 걸리고, 되돌리면 다시 통과
    const removed = await http()
      .patch(`/api/drafts/${other.body.draft.id}`)
      .send({ text: other.body.draft.text.replace('[광고] ', '') })
      .expect(200);
    expect(removed.body.checkPassed).toBe(false);
    const restored = await http()
      .patch(`/api/drafts/${other.body.draft.id}`)
      .send({ text: other.body.draft.aiText })
      .expect(200);
    expect(restored.body.checkPassed).toBe(true);

    const failed = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v3.id}/draft`)
      .expect(200);
    expect(failed.body.status.code).toBe('error');
    expect(failed.body.draft.errorMessage).toBe(
      '테스트용 분석 실패 · [다시 생성]을 눌러 주세요',
    );
  });

  it('고치기: 사람이 고치면 바로 다시 검사하고, 목록 상태와 개수가 바뀐다', async () => {
    const { body } = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/draft`)
      .expect(200);
    const edited = await http()
      .patch(`/api/drafts/${body.draft.id}`)
      .send({ text: '운명원 좋아요 www.unmyeong.kr' })
      .expect(200);
    expect(edited.body).toMatchObject({ edited: true, checkPassed: false });

    const list = await http().get(`/api/drafts?topicId=${topicId}`).expect(200);
    expect(list.body.counts).toMatchObject({
      check_failed: 1,
      error: 1,
      pending: 1, // 다른 채널 영상 (광고 표시)
    });
    const onlyFailed = await http()
      .get('/api/drafts?status=check_failed')
      .expect(200);
    expect(onlyFailed.body.rows).toHaveLength(1);
    expect(onlyFailed.body.rows[0]).toMatchObject({
      statusLabel: '검사 미통과',
      edited: true,
    });

    const search = await http()
      .get(`/api/drafts?q=${encodeURIComponent('연락 텀')}`)
      .expect(200);
    expect(
      search.body.rows.map(
        (r: { video: { youtubeId: string } }) => r.video.youtubeId,
      ),
    ).toEqual(['demo00000v1']);

    // 원래 글로 돌리면 edited가 풀리고 다시 통과
    const back = await http()
      .patch(`/api/drafts/${body.draft.id}`)
      .send({ text: body.draft.aiText })
      .expect(200);
    expect(back.body).toMatchObject({ edited: false, checkPassed: true });

    await http().patch('/api/drafts/9999').send({ text: 'x' }).expect(404);
    await http()
      .patch(`/api/drafts/${body.draft.id}`)
      .send({ text: '   ' })
      .expect(400);
  });

  it('[다시 생성]: 설정에서 고른 AI(Ollama·OpenAI)로 다시 쓴다', async () => {
    await http()
      .put('/api/settings/ai.drafting')
      .send({ value: { provider: 'ollama', model: 'gemma4:12b' } })
      .expect(200);
    await http()
      .put('/api/settings/ai.analysis')
      .send({ value: { provider: 'openai', model: 'gpt-6-luna' } })
      .expect(200);

    const res = await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .send({ reanalyze: true })
      .expect(201);
    expect(res.body.draft.state).toBe('writing');
    await queue.whenIdle();

    const d = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .expect(200);
    expect(d.body.analysis).toMatchObject({
      provider: 'openai',
      model: 'gpt-6-luna',
    });
    expect(d.body.draft).toMatchObject({
      state: 'ready',
      provider: 'ollama',
      model: 'gemma4:12b',
    });
    // 영상을 못 보는 AI에게는 주소를 넘기지 않고 설명·댓글로 분석하게 한다
    const openaiCall = ctx.ai.openai.calls.at(-1)!;
    expect(openaiCall.videoUrl).toBeUndefined();
    expect(openaiCall.prompt).toContain('영상은 볼 수 없어');
  });

  it('다시 불러와도 초안은 새로 쓰지 않는다 (있던 초안·실패 표시는 그대로)', async () => {
    const res = await http().post(`/api/topics/${topicId}/load`).expect(201);
    const byId = Object.fromEntries(
      res.body.videos.map((v: Card) => [v.youtubeId, v]),
    ) as Record<string, Card>;
    expect(byId.demo00000v2.draftState).toBe('ready');
    expect(byId.demo00000v3.draftState).toBe('error');
    expect(Object.values(byId).some((v) => v.draftState === 'writing')).toBe(
      false,
    );
  });

  it('영상 보기 창: 인기 댓글을 주고, 댓글이 막힌 영상은 막혔다고 알린다', async () => {
    const ok = await http()
      .get(
        `/api/topics/${topicId}/videos/${cards.demo00000v2.id}/comments?limit=10`,
      )
      .expect(200);
    expect(ok.body).toMatchObject({
      disabled: false,
      comments: [
        { author: '@시청자1', likeCount: 120, replyCount: 3 },
        { author: '@시청자2' },
      ],
    });
    const off = await http()
      .get(`/api/topics/${topicId}/videos/${cards.demo00000v3.id}/comments`)
      .expect(200);
    expect(off.body).toEqual({ disabled: true, comments: [] });
    await http()
      .get(
        `/api/topics/${topicId}/videos/${cards.demo00000v2.id}/comments?limit=500`,
      )
      .expect(400);
  });

  it('쓰는 중이면 [다시 생성]을 막고, 서버가 다시 뜨면 쓰다 멈춘 초안을 실패로 바꾼다', async () => {
    const repo = ds.getRepository(Draft);
    const row = await repo.save(
      repo.create({
        topicId,
        videoId: cards.demo00000v1.id,
        state: DraftState.Writing,
      }),
    );
    const busy = await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v1.id}/draft`)
      .send({})
      .expect(409);
    expect(busy.body.message).toBe(
      '이 영상의 초안을 쓰는 중이에요 · 잠시만 기다려 주세요',
    );

    await queue.onModuleInit();
    const after = await repo.findOneByOrFail({ id: row.id });
    expect(after.state).toBe('error');
    expect(after.errorMessage).toContain('서버가 다시 시작돼');
  });

  it('설정에서 고친 작성 프롬프트로 쓰고, 모르는 자리는 막고, 기본값으로 되돌린다', async () => {
    const info = await http().get('/api/settings/prompts').expect(200);
    expect(info.body.map((p: { key: string }) => p.key)).toEqual([
      'prompt.analysis',
      'prompt.drafting',
    ]);
    expect(info.body[1].response.map((f: { name: string }) => f.name)).toEqual([
      'text',
      'reasons',
    ]);
    // 분석 답에는 고민 대신 주제 매칭 퍼센트와 이유
    expect(info.body[0].response.map((f: { name: string }) => f.name)).toEqual([
      'topicMatch',
      'topicMatchReason',
      'pickReasons',
      'scenes',
      'scenes.time',
      'scenes.quote',
      'scenes.source',
      'sceneKeywords',
    ]);

    const current = (await http().get('/api/settings').expect(200)).body.find(
      (s: { key: string }) => s.key === 'prompt.drafting',
    ).value;
    const bad = await http()
      .put('/api/settings/prompt.drafting')
      .send({ value: { ...current, user: '{{없는 자리}} 로 써 줘 (테스트)' } })
      .expect(400);
    expect(JSON.stringify(bad.body)).toContain('{{없는 자리}}');

    await http()
      .put('/api/settings/prompt.drafting')
      .send({
        value: { ...current, user: `[고친 틀] {{영상 제목}}\n${current.user}` },
      })
      .expect(200);
    await http()
      .post(`/api/topics/${topicId}/videos/${cards.demo00000v2.id}/draft`)
      .send({})
      .expect(201);
    await queue.whenIdle();
    // 앞선 시험이 작성 AI를 바꿔 두었을 수 있어 모든 가짜 AI의 요청에서 찾는다
    const prompts = Object.values(ctx.ai).flatMap((a) =>
      a.calls.map((c) => c.prompt),
    );
    expect(prompts.some((p) => p.startsWith('[고친 틀] '))).toBe(true);

    await http().delete('/api/settings/prompt.drafting').expect(200);

    // 예시 보기: 고치는 중인 값을 실제 주제 값으로 채운다 (저장하지 않음)
    const preview = await http()
      .post('/api/settings/prompts/preview')
      .send({
        key: 'prompt.analysis',
        value: { system: '지시', user: '[대상] {{홍보 대상}}' },
      })
      .expect(201);
    expect(preview.body.user).toEqual([
      { text: '[대상] ', slot: null },
      { text: '운명원 · 연애 사주 잘 보는 곳', slot: '홍보 대상' },
    ]);
  });
});
