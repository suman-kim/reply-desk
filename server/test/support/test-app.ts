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
  type AiProvider,
  type AiRequest,
} from '../../src/ai/ai-provider.js';
import { AppModule } from '../../src/app.module.js';
import { envSchema } from '../../src/config/env.schema.js';
import { buildDataSourceOptions } from '../../src/database/typeorm-options.js';
import {
  YOUTUBE_CLIENT,
  type YoutubeClient,
  type YoutubeSearchParams,
  type YoutubeVideoContext,
  type YoutubeVideoInfo,
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
export interface TestContext {
  app: INestApplication<App>;
  ds: DataSource;
  youtube: FakeYoutube;
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
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  await app.init();
  return { app, ds: app.get(getDataSourceToken()), youtube, ai };
}
