import { z } from 'zod';

/**
 * AI 제공자 공통 정의.
 * 영상 분석과 댓글 작성은 각각 설정에서 제공자와 모델을 고른다(settings: ai.analysis, ai.drafting).
 * 실제 호출 구현은 제공자마다 AiProvider를 구현하는 어댑터로 둔다(다음 작업: 분석·작성).
 */

/** 쓸 수 있는 AI 제공자 */
export const AI_PROVIDER_IDS = ['gemini', 'claude', 'ollama'] as const;

/** AI 제공자 ID */
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** AI가 맡는 일 */
export type AiRole = 'analysis' | 'drafting';

/** 역할별 AI 선택 값 (설정 값의 모양) */
export const aiChoiceSchema = z.object({
  /** 제공자 */
  provider: z.enum(AI_PROVIDER_IDS),
  /** 모델 이름 (예: claude-sonnet-5-5, gemini-2.5-flash, qwen3:14b) */
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
}

/** 모든 제공자가 구현할 기능 (어댑터 패턴). 분석·작성 작업에서 구현한다 */
export interface AiProvider {
  /** 제공자 ID */
  readonly id: AiProviderId;
  /**
   * JSON 모양이 정해진 답을 받는다.
   * @param args.model 모델 이름
   * @param args.system 시스템 지시
   * @param args.prompt 사용자 프롬프트
   * @param args.schema 답의 모양 (zod). 어댑터가 검증까지 한다
   * @param args.videoUrl 영상을 직접 볼 수 있는 제공자에게 넘길 유튜브 주소
   */
  generateJson<T>(args: {
    model: string;
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    videoUrl?: string;
  }): Promise<T>;
}
