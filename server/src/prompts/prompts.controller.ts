import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { AiService } from '../ai/ai.service.js';
import { TopicsService } from '../topics/topics.service.js';
import { previewPrompt, type PromptPreview } from './prompt-preview.js';
import {
  ANALYSIS_PROMPT_VARS,
  analysisSchema,
} from '../drafts/analysis-prompt.js';
import {
  DRAFT_PROMPT_VARS,
  DRAFT_RETRY_VARS,
  draftSchema,
} from '../drafts/draft-prompt.js';
import {
  PROMPT_ANALYSIS,
  PROMPT_DRAFTING,
} from '../settings/setting-definitions.js';
import {
  responseFields,
  type PromptVar,
  type ResponseField,
} from './prompt-template.js';

/** 프롬프트 한 덩이 (지시·자료 틀·다시 쓸 때) */
export interface PromptPartInfo {
  /** 설정 값 안의 칸 이름 */
  field: string;
  /** 화면 이름 */
  label: string;
  /** 무엇을 쓰는 칸인지 */
  help: string;
  /** 쓸 수 있는 {{자리}} */
  vars: PromptVar[];
}

/** 역할별 프롬프트 안내 */
export interface PromptInfo {
  /** 설정 키 (값은 /api/settings에서 읽고 고친다) */
  key: string;
  /** 덩이들 */
  parts: PromptPartInfo[];
  /** AI에게 함께 보내는 답의 모양 (코드가 정해 읽기만, label은 우리말 이름) */
  response: (ResponseField & { label: string })[];
}

/** 답의 칸 우리말 이름 (설정 화면) */
const FIELD_LABELS: Record<string, string> = {
  topicMatch: '주제와 매칭 (%)',
  topicMatchReason: '매칭 이유',
  pickReasons: '이 영상을 고른 이유',
  scenes: '근거 장면',
  'scenes.time': '근거 장면 · 시점',
  'scenes.quote': '근거 장면 · 인용',
  'scenes.source': '근거 장면 · 출처(영상/댓글)',
  sceneKeywords: '장면 검사용 단어',
  worry: '시청자 고민 한 줄',
  text: '댓글',
  reasons: '이렇게 쓴 이유',
};

/**
 * 답의 칸에 우리말 이름을 붙인다
 * @param fields 칸 이름·설명
 */
function labeled(fields: ResponseField[]) {
  return fields.map((f) => ({ ...f, label: FIELD_LABELS[f.name] ?? f.name }));
}

/** 예시 보기 요청 */
const previewSchema = z.object({
  /** 어느 프롬프트 */
  key: z.enum(['prompt.analysis', 'prompt.drafting']),
  /** 고치는 중인 값 (저장 전) */
  value: z.object({
    system: z.string().max(8000),
    user: z.string().max(8000),
    retry: z.string().max(8000).optional(),
  }),
  /** 값을 채울 주제 (없으면 첫 주제, 주제가 없으면 예시 주제) */
  topicId: z.number().int().positive().optional(),
});

/** 지시 덩이 (자리 없음) */
const SYSTEM_PART: PromptPartInfo = {
  field: 'system',
  label: '지시 (시스템)',
  help: 'AI의 역할과 꼭 지킬 규칙이에요. 모든 영상에 똑같이 보내요.',
  vars: [],
};

/**
 * 설정 화면의 프롬프트 안내 (값은 설정 API로 읽고 고친다).
 * - GET /api/settings/prompts  역할별 덩이·쓸 수 있는 자리·답의 모양
 */
@Controller('settings/prompts')
export class PromptsController {
  /**
   * @param topics 주제 (예시 보기에 채울 값)
   * @param ai AI 창구 (분석 AI가 영상을 직접 보는지)
   */
  constructor(
    private readonly topics: TopicsService,
    private readonly ai: AiService,
  ) {}

  /**
   * 예시 보기: 고치는 중인 프롬프트를 예시 영상과 주제 값으로 채운 글 (저장하지 않는다)
   * @param body 프롬프트 키·값·주제
   */
  @Post('preview')
  async preview(
    @Body({ schema: previewSchema }) body: z.infer<typeof previewSchema>,
  ): Promise<PromptPreview> {
    const list = await this.topics.list();
    const topic = list.find((t) => t.id === body.topicId) ?? list[0] ?? null;
    const watchesVideo = await this.ai
      .resolve('analysis')
      .then((r) => r.provider.canWatchVideo)
      .catch(() => false);
    return previewPrompt(body.key, body.value, topic, watchesVideo);
  }

  /** 역할별 프롬프트 안내 */
  @Get()
  list(): PromptInfo[] {
    return [
      {
        key: PROMPT_ANALYSIS.key,
        parts: [
          SYSTEM_PART,
          {
            field: 'user',
            label: '자료 틀',
            help: '영상마다 {{자리}}를 채워 보내는 글이에요. 자리가 있는 줄인데 값이 비면 그 줄은 빠져요.',
            vars: ANALYSIS_PROMPT_VARS,
          },
        ],
        response: labeled(responseFields(analysisSchema)),
      },
      {
        key: PROMPT_DRAFTING.key,
        parts: [
          SYSTEM_PART,
          {
            field: 'user',
            label: '자료 틀',
            help: '영상마다 {{자리}}를 채워 보내는 글이에요. 자리가 있는 줄인데 값이 비면 그 줄은 빠져요.',
            vars: DRAFT_PROMPT_VARS,
          },
          {
            field: 'retry',
            label: '다시 쓸 때 덧붙이는 글',
            help: '자동 검사에 걸려 한 번 더 쓸 때 자료 틀 뒤에 붙여요.',
            vars: DRAFT_RETRY_VARS,
          },
        ],
        response: labeled(responseFields(draftSchema)),
      },
    ];
  }
}
