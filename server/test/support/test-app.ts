import '../../src/config/zod-locale.js';
import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import {
  AI_PROVIDERS,
  AiError,
  type AiModelOption,
  type AiProvider,
  type AiRequest,
} from '../../src/ai/ai-provider.js';
import { AppModule } from '../../src/app.module.js';
import {
  YOUTUBE_BROWSER,
  type CommentBoxResult,
  type LoginCheckResult,
  type YoutubeBrowser,
  type YoutubePage,
} from '../../src/browser/youtube-browser.js';
import { envSchema } from '../../src/config/env.schema.js';
import { buildDataSourceOptions } from '../../src/database/typeorm-options.js';
import {
  YOUTUBE_CLIENT,
  type YoutubeClient,
  type YoutubeSearchParams,
  type YoutubeVideoContext,
  type YoutubeVideoInfo,
  type YoutubeComments,
} from '../../src/videos/youtube/youtube-client.js';

/** 내 채널 ID (유튜브1 프로필이 로그인된 채널) */
export const MY_CHANNEL = 'UC_MY_CHANNEL_000000000';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

/** 테스트용 영상 정보 */
export function info(
  id: string,
  title: string,
  channelId: string,
  views: number,
  publishedAt: number,
): YoutubeVideoInfo {
  return {
    youtubeId: id,
    title,
    channelId,
    channelTitle: channelId,
    publishedAt: new Date(publishedAt),
    viewCount: views,
    durationSec: 600,
    thumbnailUrl: null,
  };
}

/** 검색에 나오는 영상 (프로토타입의 v1~v3 + 기간 밖 영상) */
export const VIDEOS: YoutubeVideoInfo[] = [
  info(
    'demo00000v1',
    '썸 탈 때 남자가 연락 텀을 늘리는 진짜 이유 3가지',
    'UC_OTHER_A',
    2340,
    now - 0.2 * day,
  ),
  info(
    'demo00000v2',
    '헤어진 연인에게 다시 연락 오는 시기, 이 신호를 보세요',
    MY_CHANNEL,
    4870,
    now - 1 * day,
  ),
  info(
    'demo00000v3',
    "남자들이 '진지한 연애' 앞에서 망설이는 순간",
    'UC_OTHER_B',
    12400,
    now - 2 * day,
  ),
  info('demo000old1', '오래된 영상', 'UC_OTHER_C', 999999, now - 30 * day),
];

/** 링크 직접 추가로만 들어오는 영상 */
export const MANUAL = info(
  'manual00001',
  '직접 넣은 내 테스트 영상',
  MY_CHANNEL,
  10,
  now,
);

/** 가짜 YouTube 클라이언트: 실제 API를 부르지 않는다 */
export class FakeYoutube implements YoutubeClient {
  /** 마지막 검색 조건 (검증용) */
  lastSearch: YoutubeSearchParams | null = null;

  async searchVideoIds(params: YoutubeSearchParams): Promise<string[]> {
    this.lastSearch = params;
    return VIDEOS.map((v) => v.youtubeId);
  }

  async getVideos(ids: string[]): Promise<YoutubeVideoInfo[]> {
    return [...VIDEOS, MANUAL].filter((v) => ids.includes(v.youtubeId));
  }

  /** 댓글: demo00000v3은 댓글이 막힌 영상, 나머지는 두 개 */
  async getComments(youtubeId: string): Promise<YoutubeComments> {
    if (youtubeId === 'demo00000v3') return { disabled: true, comments: [] };
    return {
      disabled: false,
      comments: [
        {
          id: `${youtubeId}-c1`,
          author: '@시청자1',
          authorImageUrl: null,
          text: '읽씹 3일째인데 이거 보고 위로받고 갑니다',
          likeCount: 120,
          replyCount: 3,
          publishedAt: new Date('2026-11-12T00:00:00Z'),
        },
        {
          id: `${youtubeId}-c2`,
          author: '@시청자2',
          authorImageUrl: null,
          text: '저도 스토리만 보고 있어요',
          likeCount: 8,
          replyCount: 0,
          publishedAt: new Date('2026-11-12T01:00:00Z'),
        },
      ],
    };
  }

  async getVideoContext(youtubeId: string): Promise<YoutubeVideoContext> {
    return {
      description: `${youtubeId} 영상 설명. 스토리를 계속 확인한다면 아직 미련이 남았다는 신호예요.`,
      comments: [
        { text: '읽씹 3일째인데 이거 보고 위로받고 갑니다', likeCount: 120 },
      ],
    };
  }
}

/**
 * 가짜 AI. 프롬프트를 보고 분석인지 작성인지 가려 정해진 답을 준다.
 * - demo00000v3 영상의 분석은 실패한다 (실패 표시 확인용)
 * - 분석 답에는 원문에 없는 인용을 하나 섞는다 (코드가 버리는지 확인용)
 */
export class FakeAi implements AiProvider {
  /** 받은 요청 (검증용) */
  readonly calls: { model: string; videoUrl?: string; prompt: string }[] = [];

  /**
   * @param id 제공자 ID
   * @param canWatchVideo 영상을 볼 수 있는지
   */
  constructor(
    readonly id: AiProvider['id'],
    readonly canWatchVideo: boolean,
  ) {}

  get label() {
    return `Fake-${this.id}`;
  }

  async status() {
    return { ready: true, note: '테스트용' };
  }

  /** 모델 목록: claude는 키가 없는 것처럼 실패하고, 나머지는 새 모델 + 추천 모델 하나 */
  async listModels(): Promise<AiModelOption[]> {
    if (this.id === 'claude')
      throw new AiError(
        'ANTHROPIC_API_KEY가 없어 추천 목록을 보여 드려요 · 키를 넣으면 쓸 수 있는 모델이 모두 보여요',
        false,
      );
    if (this.id === 'gemini')
      return [
        { id: 'gemini-9-new', label: 'Gemini 9 New' },
        { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      ];
    return [{ id: `${this.id}-model`, label: `${this.id}-model` }];
  }

  async generateJson<T>(req: AiRequest<T>): Promise<T> {
    this.calls.push({
      model: req.model,
      videoUrl: req.videoUrl,
      prompt: req.prompt,
    });
    if (req.prompt.includes('[시청자 고민]')) {
      return req.schema.parse({
        text: '스토리 계속 본다는 게 미련 신호라니 저도 매일 확인하는데… 운명원 연애사주로 재회운 본다던데 저도 궁금해지네요.',
        reasons: [
          '영상 속 "스토리" 장면을 짚음',
          '재회 궁금증으로 운명원을 연결',
        ],
      });
    }
    if (req.prompt.includes('진지한 연애')) {
      throw new AiError('테스트용 분석 실패 · [다시 생성]을 눌러 주세요', true);
    }
    return req.schema.parse({
      worry: '이별 후 상대에게 다시 연락이 올지 궁금함',
      pickReasons: [
        '{올린때} 올라와 조회수가 오르는 중 ({조회수})',
        '재회 고민이 분명해 사주 관심으로 이어지기 쉬움',
      ],
      scenes: [
        {
          time: null,
          quote: '스토리를 계속 확인한다면 아직 미련이 남았다는 신호예요',
          source: 'video',
        },
        {
          time: null,
          quote: '읽씹 3일째인데 이거 보고 위로받고 갑니다',
          source: 'comment',
        },
        { time: null, quote: '원문에 없는 지어낸 인용', source: 'comment' },
      ],
      sceneKeywords: ['스토리', '미련', '없는단어'],
    });
  }
}

/** 테스트 앱과 가짜들 */
/** PNG 파일 머리 (가짜 화면 캡처) */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * 가짜 크롬: 실제 YouTube에 댓글을 달지 않는다.
 * - commentBox: 영상 ID별 댓글 창 찾기 결과 (기본 ok)
 * - login: 로그인 확인 결과
 */
export class FakeBrowser implements YoutubeBrowser {
  /** 영상 ID별 댓글 창 찾기 결과 */
  readonly commentBox = new Map<string, CommentBoxResult>();
  /** 로그인 확인 결과 */
  login: LoginCheckResult = {
    loggedIn: true,
    channelId: MY_CHANNEL,
    channelTitle: '내 채널',
    uiLanguage: 'ko-KR',
  };
  /** 연 프로필 폴더 (검증용) */
  readonly opened: { dir: string; headless: boolean }[] = [];
  /** 사람이 로그인하라고 연 폴더 */
  readonly manualLogins: string[] = [];
  /** 단 댓글 */
  readonly posted: { youtubeId: string; text: string }[] = [];

  async openPage(
    dir: string,
    opts: { headless: boolean },
  ): Promise<YoutubePage> {
    this.opened.push({ dir, ...opts });
    let youtubeId = '';
    let typed = '';
    return {
      openVideo: async (id) => void (youtubeId = id),
      findCommentBox: async () => this.commentBox.get(youtubeId) ?? 'ok',
      typeComment: async (text, onProgress) => {
        const chars = [...text];
        chars.forEach(
          (c, i) => ((typed += c), onProgress(i + 1, chars.length)),
        );
      },
      submit: async () => (this.posted.push({ youtubeId, text: typed }), true),
      findOwnComment: async (text) =>
        this.posted.some((p) => p.youtubeId === youtubeId && p.text === text)
          ? { url: `https://www.youtube.com/watch?v=${youtubeId}&lc=fake` }
          : null,
      screenshot: async () => PNG,
      close: async () => undefined,
    };
  }

  async checkLogin(): Promise<LoginCheckResult> {
    return this.login;
  }

  async openForManualLogin(dir: string): Promise<{ restarted: boolean }> {
    this.manualLogins.push(dir);
    return { restarted: false };
  }
}

export interface TestContext {
  app: INestApplication<App>;
  ds: DataSource;
  youtube: FakeYoutube;
  browser: FakeBrowser;
  ai: { gemini: FakeAi; claude: FakeAi; openai: FakeAi; ollama: FakeAi };
}

/**
 * 테스트 DB를 비우고 앱을 띄운다 (마이그레이션은 앱이 처음부터 다시 적용한다).
 */
export async function createTestApp(): Promise<TestContext> {
  const reset = new DataSource({
    ...buildDataSourceOptions(envSchema.parse(process.env)),
    dropSchema: true,
  });
  await reset.initialize();
  await reset.destroy();

  const youtube = new FakeYoutube();
  const browser = new FakeBrowser();
  const ai = {
    gemini: new FakeAi('gemini', true),
    claude: new FakeAi('claude', false),
    openai: new FakeAi('openai', false),
    ollama: new FakeAi('ollama', false),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(YOUTUBE_CLIENT)
    .useValue(youtube)
    .overrideProvider(AI_PROVIDERS)
    .useValue(Object.values(ai))
    .overrideProvider(YOUTUBE_BROWSER)
    .useValue(browser)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  await app.init();
  return { app, ds: app.get(getDataSourceToken()), youtube, browser, ai };
}
