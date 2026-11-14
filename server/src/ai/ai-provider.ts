import { z } from 'zod';
import type { ModelPricing } from './providers/model-pricing.js';

/**
 * AI 제공자 공통 정의.
 * 영상 분석과 댓글 작성은 각각 설정에서 제공자와 모델을 고른다(settings: ai.analysis, ai.drafting).
 * 제공자마다 AiProvider를 구현하는 어댑터를 두고(어댑터 패턴), AiService가 설정을 읽어 골라 쓴다(전략 패턴).
 */

/** 쓸 수 있는 AI 제공자 */
export const AI_PROVIDER_IDS = [
  'gemini',
  'claude',
  'openai',
  'ollama',
] as const;

/** AI 제공자 ID */
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** AI가 맡는 일 */
export type AiRole = 'analysis' | 'drafting';

/** 역할별 AI 선택 값 (설정 값의 모양) */
export const aiChoiceSchema = z.object({
  /** 제공자 */
  provider: z.enum(AI_PROVIDER_IDS),
  /** 모델 이름 (예: claude-sonnet-5-5, gemini-3.8-flash, gpt-6-luna, gemma4:12b) */
  model: z.string().trim().min(1, '모델 이름을 적어 주세요').max(100),
});

/** 역할별 AI 선택 값 */
export type AiChoice = z.infer<typeof aiChoiceSchema>;

/** 제공자 안내 정보 (설정 화면용) */
export interface AiProviderInfo {
  /** 제공자 ID */
  id: AiProviderId;
  /** 화면에 보일 이름 */
  label: string;
  /** 지금 쓸 수 있는지 (키가 있는지 등) */
  ready: boolean;
  /** 쓸 수 없을 때 원인과 할 일, 쓸 수 있을 때 짧은 안내 */
  note: string;
  /** 영상을 직접 볼 수 있는지 (유튜브 주소로 영상 분석) */
  canWatchVideo: boolean;
  /** 모델 이름 예시 (설정 화면의 자리 표시) */
  modelExamples: string[];
}

/** 고를 수 있는 모델 하나 (제공자 API에서 받은 것) */
export interface AiModelOption {
  /** 모델 ID (설정에 저장하는 값. 예: gemini-3.8-flash) */
  id: string;
  /** 화면에 보일 이름 (제공자가 주는 이름, 없으면 ID) */
  label: string;
}

/** 제공자의 모델 목록 (설정 화면의 모델 고르기) */
export interface AiModelList {
  /** 제공자 ID */
  provider: AiProviderId;
  /** 어디서 받았는지: live = 제공자 API에서 받음, recommended = 키가 없거나 받지 못해 추천 목록 */
  source: 'live' | 'recommended';
  /** 모델 목록 (추천 모델이 앞) */
  models: (AiModelOption & {
    /** 추천 모델인지 (이 앱에서 써 본 것) */
    recommended: boolean;
    /** 가격·무료 여부·한 줄 설명 (가격표에 없으면 null) */
    pricing: ModelPricing | null;
  })[];
  /** 가격표 출처와 확인한 날 (Ollama는 null) */
  pricingSource: { url: string; checkedAt: string } | null;
  /** 추천 목록을 보이는 이유 같은 안내 한 줄. 없으면 null */
  note: string | null;
}

/** AI에 보내는 요청 */
export interface AiRequest<T> {
  /** 모델 이름 */
  model: string;
  /** 시스템 지시 (역할·규칙) */
  system: string;
  /** 사용자 프롬프트 (이번 일의 자료) */
  prompt: string;
  /** 답의 모양. 어댑터가 이 모양으로 받고 검증까지 한다 */
  schema: z.ZodType<T>;
  /** 영상을 직접 볼 수 있는 제공자에게 넘길 유튜브 주소 */
  videoUrl?: string;
  /** 제한 시간 (밀리초) */
  timeoutMs: number;
  /**
   * 생성 성향 (RD-33). precise: 사실을 정확히(분석), creative: 매번 다르게(초안 작성). 없으면 제공자 기본값.
   * 지금은 Ollama만 반영한다 (Gemini 3은 기본 온도를 권하고, OpenAI 추론 모델은 온도를 받지 않는다).
   */
  creativity?: 'precise' | 'creative';
}

/** 모든 제공자가 구현할 기능 */
export interface AiProvider {
  /** 제공자 ID */
  readonly id: AiProviderId;
  /** 화면에 보일 이름 */
  readonly label: string;
  /** 유튜브 주소를 받아 영상을 직접 볼 수 있는지 */
  readonly canWatchVideo: boolean;
  /**
   * 지금 쓸 수 있는지와 안내 문구
   */
  status(): Promise<{ ready: boolean; note: string }>;
  /**
   * JSON 모양이 정해진 답을 받는다. 실패하면 AiError를 던진다.
   * @param req 요청
   */
  generateJson<T>(req: AiRequest<T>): Promise<T>;
  /**
   * 지금 쓸 수 있는 글쓰기 모델 목록을 제공자 API에서 받는다.
   * 키가 없거나 받지 못하면 AiError를 던진다(설정 화면은 추천 목록으로 대신한다).
   */
  listModels(): Promise<AiModelOption[]>;
}

/** DI 토큰: 등록된 제공자 목록 */
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');

/**
 * AI 호출 실패. message는 화면에 그대로 보일 한 줄(원인 · 할 일)이다.
 */
export class AiError extends Error {
  /**
   * @param message 화면에 보일 한 줄
   * @param retryable 잠시 뒤 다시 하면 될 수 있는지
   * @param cause 원래 오류 (로그용)
   */
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
