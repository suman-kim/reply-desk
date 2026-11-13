import { z } from 'zod';
import { aiChoiceSchema } from '../ai/ai-provider.js';
import {
  ANALYSIS_PROMPT_VARS,
  DEFAULT_ANALYSIS_PROMPT,
} from '../drafts/analysis-prompt.js';
import {
  DEFAULT_DRAFT_PROMPT,
  DRAFT_PROMPT_VARS,
  DRAFT_RETRY_VARS,
} from '../drafts/draft-prompt.js';
import { promptText } from '../prompts/prompt-template.js';

/**
 * 설정 정의 하나. 키마다 값의 모양(스키마)과 기본값, 화면 안내를 함께 둔다.
 * 새 설정은 SETTING_DEFINITIONS에 한 줄 추가하면 API와 검증이 함께 생긴다.
 */
export interface SettingDefinition<T> {
  /** 설정 키 */
  key: string;
  /** 화면에 보일 이름 */
  label: string;
  /** 쉬운 말 도움말 */
  help: string;
  /** 값의 모양 */
  schema: z.ZodType<T>;
  /** 행이 없을 때 쓰는 값 */
  defaultValue: T;
}

/** 정의를 타입을 지키며 만드는 도우미 */
function define<T>(def: SettingDefinition<T>): SettingDefinition<T> {
  return def;
}

/** 전체 하루 게시 상한 */
export const DAILY_CAP_TOTAL = define({
  key: 'posting.dailyCapTotal',
  label: '전체 하루 게시 상한',
  help: '모든 주제를 합쳐 하루(한국 시간)에 달 수 있는 댓글 수예요. 주제별 상한은 이 안에서 나눠 써요.',
  schema: z.number().int().min(1).max(50),
  defaultValue: 10,
});

/** 게시할 때 크롬 창을 숨길지 */
export const POSTING_HEADLESS = define({
  key: 'posting.headless',
  label: '게시할 때 크롬 창 숨기기',
  help: '끄면 게시할 때 크롬 창이 떠서 한 글자씩 입력하는 모습을 볼 수 있어요(시연용). 켜면 창 없이 게시해요.',
  schema: z.boolean(),
  defaultValue: false,
});

/** 영상 분석에 쓸 AI */
export const AI_ANALYSIS = define({
  key: 'ai.analysis',
  label: '영상 분석 AI',
  help: '영상을 보고 고민 한 줄, 근거 장면, 고른 이유를 뽑는 AI예요. Gemini는 유튜브 영상을 직접 보고, 다른 AI는 영상 설명과 인기 댓글로 분석해요.',
  schema: aiChoiceSchema,
  defaultValue: { provider: 'gemini' as const, model: 'gemini-3.8-flash' },
});

/** 댓글 작성에 쓸 AI */
export const AI_DRAFTING = define({
  key: 'ai.drafting',
  label: '댓글 작성 AI',
  help: '분석 결과로 댓글 초안과 "이렇게 쓴 이유"를 쓰는 AI예요.',
  schema: aiChoiceSchema,
  defaultValue: { provider: 'claude' as const, model: 'claude-sonnet-5-5' },
});

/** Ollama 주소 */
export const OLLAMA_BASE_URL = define({
  key: 'ai.ollamaBaseUrl',
  label: 'Ollama 주소',
  help: 'Ollama 주소예요. 집 AI PC를 쓰면 SSH 터널 주소(예: http://127.0.0.1:11435)를 넣어요.',
  schema: z.url({
    message: '주소 형식이 아니에요 (예: http://127.0.0.1:11434)',
  }),
  defaultValue: 'http://127.0.0.1:11434',
});

/** Ollama 문맥 길이 */
export const OLLAMA_NUM_CTX = define({
  key: 'ai.ollamaNumCtx',
  label: 'Ollama 문맥 길이',
  help: '같은 AI PC를 쓰는 다른 앱(animation-chat)과 같은 값이어야 해요. 다르면 부를 때마다 모델을 다시 올려 느려져요.',
  schema: z.number().int().min(2048).max(131072),
  defaultValue: 16384,
});

/** 영상 분석 프롬프트 (시스템 지시 + 자료 틀) */
export const PROMPT_ANALYSIS = define({
  key: 'prompt.analysis',
  label: '영상 분석 프롬프트',
  help: '영상 분석 AI에게 보내는 글 전체예요. 지시는 AI의 역할과 규칙, 자료 틀은 {{자리}}에 영상·주제 값을 채워 보내요. 답의 모양(JSON 칸)은 코드가 검증에 쓰므로 바꾸지 않아요.',
  schema: z.object({
    system: promptText('지시'),
    user: promptText('자료 틀', ANALYSIS_PROMPT_VARS),
  }),
  defaultValue: DEFAULT_ANALYSIS_PROMPT,
});

/** 댓글 작성 프롬프트 (시스템 지시 + 자료 틀 + 다시 쓸 때 덧붙이는 틀) */
export const PROMPT_DRAFTING = define({
  key: 'prompt.drafting',
  label: '댓글 작성 프롬프트',
  help: '댓글 작성 AI에게 보내는 글 전체예요. 자동 검사에 걸려 다시 쓸 때는 자료 뒤에 "다시 쓸 때" 글을 덧붙여요. 광고 표시([광고])는 AI가 아니라 코드가 붙여요.',
  schema: z.object({
    system: promptText('지시'),
    user: promptText('자료 틀', DRAFT_PROMPT_VARS),
    retry: promptText('다시 쓸 때 덧붙이는 글', DRAFT_RETRY_VARS),
  }),
  defaultValue: DEFAULT_DRAFT_PROMPT,
});

/** 모든 설정 정의 (화면에 보일 순서) */
export const SETTING_DEFINITIONS: SettingDefinition<unknown>[] = [
  DAILY_CAP_TOTAL,
  POSTING_HEADLESS,
  AI_ANALYSIS,
  AI_DRAFTING,
  OLLAMA_BASE_URL,
  OLLAMA_NUM_CTX,
  PROMPT_ANALYSIS,
  PROMPT_DRAFTING,
] as SettingDefinition<unknown>[];
