import type { MessageEvent } from '@nestjs/common';
import { firstValueFrom, take, toArray } from 'rxjs';
import { PostStatus, PostStep } from '../posting/post-attempt.entity.js';
import { ProfileLoginStatus } from '../profiles/profile.entity.js';
import { buildStepViews } from '../publish/post-steps.js';
import { EventsService } from './events.service.js';

describe('EventsService', () => {
  it('보는 주제의 이벤트와 주제 없는 이벤트만 보내고, 번호를 붙인다', async () => {
    const events = new EventsService();
    const received = firstValueFrom(
      events.stream(1, 60_000).pipe(take(2), toArray()),
    );

    events.emit({ type: 'post.preview', attemptId: 9, topicId: 2, seq: 1 }); // 다른 주제: 안 감
    events.emit({ type: 'post.preview', attemptId: 7, topicId: 1, seq: 1 });
    events.emit({
      type: 'profile.updated',
      profileId: 3,
      name: '유튜브2',
      loginStatus: ProfileLoginStatus.NeedsLogin,
    });

    const list = (await received) as MessageEvent[];
    expect(list.map((m) => m.type)).toEqual([
      'post.preview',
      'profile.updated',
    ]);
    expect((list[0].data as { attemptId: number }).attemptId).toBe(7);
    expect(Number(list[1].id)).toBeGreaterThan(Number(list[0].id));
  });

  it('주제를 정하지 않으면 모든 주제의 이벤트를 보낸다', async () => {
    const events = new EventsService();
    const received = firstValueFrom(
      events.stream(null, 60_000).pipe(take(2), toArray()),
    );
    events.emit({ type: 'post.preview', attemptId: 1, topicId: 1, seq: 1 });
    events.emit({ type: 'post.preview', attemptId: 2, topicId: 2, seq: 1 });
    expect((await received).length).toBe(2);
  });

  it('서버가 꺼지면 흐름이 끝난다 (열린 연결이 남지 않게)', async () => {
    const events = new EventsService();
    const all = firstValueFrom(events.stream(null, 10).pipe(toArray()));
    events.onModuleDestroy();
    await expect(all).resolves.toEqual([]);
  });

  it('조용할 때는 주석 줄(ping)로 연결을 살려 둔다', async () => {
    const events = new EventsService();
    const first = await firstValueFrom(events.stream(null, 20));
    expect(first).toEqual({ comment: 'ping' });
  });
});

describe('buildStepViews', () => {
  const states = (status: PostStatus, step: PostStep | null) =>
    buildStepViews(status, step).map((s) => s.state);

  it('진행 중이면 앞 단계는 끝남, 지금 단계는 하는 중', () => {
    expect(states(PostStatus.Running, PostStep.Type)).toEqual([
      'done',
      'done',
      'running',
      'waiting',
      'waiting',
    ]);
  });

  it('실패면 그 단계에 실패 표시, 성공이면 모두 끝남', () => {
    expect(states(PostStatus.Failed, PostStep.Submit)).toEqual([
      'done',
      'done',
      'done',
      'failed',
      'waiting',
    ]);
    expect(states(PostStatus.Success, null)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
    ]);
  });

  it('화면 이름을 붙인다', () => {
    expect(
      buildStepViews(PostStatus.Running, null).map((s) => s.label),
    ).toEqual([
      '프로필 여는 중',
      '댓글 창 찾는 중',
      '한 글자씩 입력 중',
      '게시',
      '내 댓글 확인',
    ]);
  });
});
