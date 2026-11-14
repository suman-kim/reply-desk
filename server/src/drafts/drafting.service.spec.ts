import type { SettingsService } from '../settings/settings.service.js';
import { DEFAULT_DRAFT_PROMPT } from './draft-prompt.js';
import type { AiService, ResolvedAi } from '../ai/ai.service.js';
import { CheckRunnerService } from '../checks/check-runner.service.js';
import { DEFAULT_CHECKS } from '../checks/draft-checks.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import { DraftingService } from './drafting.service.js';
import { pickStyle } from './variety/draft-style.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

const topic = {
  id: 1,
  brandTarget: '운명원 · 연애 사주 잘 보는 곳',
  brandWord: '운명원',
  tone: '',
  minLength: 40,
  maxLength: 120,
  bannedWords: [],
} as unknown as Topic;
const video = { id: 2, title: '썸 탈 때 연락 텀' } as Video;
const analysis = {
  scenes: [{ time: '04:12', quote: '확신이 없어서예요', source: 'video' }],
  sceneKeywords: ['확신', '텀'],
} as unknown as VideoAnalysis;

const GOOD =
  '4분쯤 확신이 없어서 텀이 길어진다는 말 듣고 뜨끔했어요. 저도 딱 그 상태라ㅠ 운명원 연애사주가 잘 본다던데 한번 물어보고 싶네요.';
const BAD =
  '운명원 최고예요 운명원 꼭 가 보세요 #연애 추천해요 정말 정말 좋아요 강추 강추 강추';

/** 순서대로 답하는 가짜 AI */
function fakeAi(answers: string[]) {
  const prompts: string[] = [];
  const ai = {
    resolve: vi.fn(
      async () =>
        ({ provider: { id: 'claude' }, model: 'm' }) as unknown as ResolvedAi,
    ),
    generate: vi.fn(async (_ai: ResolvedAi, req: { prompt: string }) => {
      prompts.push(req.prompt);
      return {
        worry: `  썸만 몇 달째인데 이 사람이 인연인지 모르겠어요 (${prompts.length})  `,
        text: answers.shift()!,
        reasons: ['이유 하나입니다', '이유 둘입니다'],
      };
    }),
  };
  return { ai: ai as unknown as AiService, prompts, generate: ai.generate };
}

/** 설정: 프롬프트는 기본값 (설정에서 고친 프롬프트는 e2e에서 본다) */
const settings = {
  get: async () => DEFAULT_DRAFT_PROMPT,
} as unknown as SettingsService;

describe('DraftingService', () => {
  const checks = new CheckRunnerService(DEFAULT_CHECKS);

  it('첫 초안이 검사를 통과하면 한 번에 끝난다', async () => {
    const { ai, generate } = fakeAi([GOOD]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
    );
    expect(r).toMatchObject({
      text: GOOD,
      attempts: 1,
      provider: 'claude',
      model: 'm',
    });
    expect(r.report.passed).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    // 시청자 고민 한 줄은 앞뒤 공백을 지워 함께 준다 (RD-32)
    expect(r.worry).toBe('썸만 몇 달째인데 이 사람이 인연인지 모르겠어요 (1)');
  });

  it('글 모양과 최근 초안에서 피할 말을 프롬프트에 붙이고, 초안은 creative로 부른다 (RD-33)', async () => {
    const { ai, prompts, generate } = fakeAi([GOOD]);
    const recentTexts = [
      '아 진짜 공감돼요 운명원 같은 데서 봐야겠네요',
      '진짜 뼈 때리네요 운명원 같은 곳에서 확인해보고 싶네요',
      '진짜 내 얘기 같아요 운명원 같은 데서 알아봐야지',
      '진짜 설레요 운명원 한번 볼까 싶네요',
    ];
    const style = pickStyle([], { hasSceneTime: true }, () => 0);
    await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
      { style, recentTexts },
    );
    expect(prompts[0]).toContain('[이번 글 모양] 이 모양대로 쓴다');
    expect(prompts[0]).toContain('- 쓰는 사람: 20대 초반 대학생');
    expect(prompts[0]).toContain(
      '[최근 초안에 자주 나온 말] 이번엔 쓰지 않는다',
    );
    expect(prompts[0]).toContain('- 운명원 같은');
    expect(prompts[0]).toContain('- 진짜');
    expect(generate.mock.calls[0][1]).toMatchObject({ creativity: 'creative' });
  });

  it('최근 초안 대부분에 나온 말을 쓰면 다양성 검사에 걸려 한 번 더 쓴다', async () => {
    const WITH_HABIT =
      '4분쯤 확신이 없어서 텀이 길어진다는 말 진짜 뜨끔했어요. 저도 딱 그 상태라ㅠ 운명원 연애사주가 잘 본다던데 한번 물어보고 싶네요.';
    const { ai, prompts } = fakeAi([WITH_HABIT, GOOD]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
      {
        recentTexts: [
          '진짜 공감돼요 하나',
          '진짜 공감돼요 둘이요',
          '진짜 공감돼요 셋입니다',
          '진짜 공감돼요 넷이에요',
        ],
      },
    );
    expect(prompts[1]).toContain('최근 초안과 다름');
    expect(r).toMatchObject({ text: GOOD, attempts: 2 });
  });

  it('같은 영상에 이미 단 댓글을 프롬프트로 넘기고, 같은 글을 쓰면 한 번 더 쓴다 (RD-27)', async () => {
    const OTHER =
      '4분쯤 확신이 없어서라는 말이 남 얘기 같지 않았어요. 운명원에서 둘 궁합 보면 답이 좀 나올까 싶네요 진짜로요.';
    const { ai, prompts } = fakeAi([GOOD, OTHER]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
      { posted: [GOOD] },
    );
    expect(prompts[0]).toContain(`[이미 이 영상에 단 댓글]\n- ${GOOD}`);
    expect(prompts[0]).toContain('겹치지 않게');
    expect(prompts[1]).toContain('이미 단 댓글과 다름');
    expect(r).toMatchObject({ text: OTHER, attempts: 2 });
    expect(r.report.passed).toBe(true);
  });

  it('이미 단 댓글이 없으면 그 안내를 붙이지 않는다', async () => {
    const { ai, prompts } = fakeAi([GOOD]);
    await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
    );
    expect(prompts[0]).not.toContain('[이미 이 영상에 단 댓글]');
  });

  it('검사에 걸리면 걸린 이유를 붙여 한 번 더 쓴다', async () => {
    const { ai, prompts } = fakeAi([BAD, GOOD]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
    );
    expect(r.attempts).toBe(2);
    expect(r.report.passed).toBe(true);
    // 다시 쓰면 고민도 마지막으로 쓴 댓글의 것
    expect(r.worry).toContain('(2)');
    expect(prompts[1]).toContain('[앞서 쓴 글]');
    expect(prompts[1]).toContain('링크·해시태그 없음');
  });

  it('두 번 다 걸리면 마지막 결과와 검사 결과를 그대로 준다 (사람이 고친다)', async () => {
    const { ai } = fakeAi([BAD, BAD]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      null,
    );
    expect(r.attempts).toBe(2);
    expect(r.report.passed).toBe(false);
    expect(r.text).toBe(BAD);
  });

  it('다른 채널 영상이면 광고 표시를 코드가 맨 앞에 붙이고 검사도 통과한다 (표시는 검사하지 않는다)', async () => {
    const { ai } = fakeAi([GOOD]);
    const r = await new DraftingService(ai, checks, settings).write(
      topic,
      video,
      analysis,
      '[광고]',
    );
    expect(r.text).toBe(`[광고] ${GOOD}`);
    expect(r.report.passed).toBe(true);
    expect(r.report.results.some((x) => x.code === 'ad_disclosure')).toBe(
      false,
    );
  });
});
