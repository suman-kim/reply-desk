import { z } from 'zod';
import { aiChoiceSchema } from '../ai/ai-provider.js';

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

/** 영상 분석에 쓸 AI */
export const AI_ANALYSIS = define({
  key: 'ai.analysis',
  label: '영상 분석 AI',
  help: '영상을 보고 고민 한 줄, 근거 장면, 고른 이유를 뽑는 AI예요. Gemini는 유튜브 영상을 직접 볼 수 있어요.',
  schema: aiChoiceSchema,
  defaultValue: { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
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
  help: '이 맥에서 돌리는 로컬 AI(Ollama) 주소예요. 보통 바꿀 필요가 없어요.',
  schema: z.url({
    message: '주소 형식이 아니에요 (예: http://127.0.0.1:11434)',
  }),
  defaultValue: 'http://127.0.0.1:11434',
});

/** 모든 설정 정의 (화면에 보일 순서) */
export const SETTING_DEFINITIONS: SettingDefinition<unknown>[] = [
  DAILY_CAP_TOTAL,
  AI_ANALYSIS,
  AI_DRAFTING,
  OLLAMA_BASE_URL,
] as SettingDefinition<unknown>[];
