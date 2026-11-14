import { Controller, Get } from '@nestjs/common';
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
  /** AI에게 함께 보내는 답의 모양 (코드가 정해 읽기만) */
  response: ResponseField[];
}

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
        response: responseFields(analysisSchema),
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
        response: responseFields(draftSchema),
      },
    ];
  }
}
