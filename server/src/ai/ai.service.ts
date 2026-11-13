import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_ANALYSIS, AI_DRAFTING } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  AI_PROVIDERS,
  AiError,
  type AiChoice,
  type AiProvider,
  type AiProviderInfo,
  type AiRequest,
  type AiRole,
} from './ai-provider.js';

/** 모델 이름 예시 (설정 화면 자리 표시) */
const MODEL_EXAMPLES: Record<string, string[]> = {
  gemini: ['gemini-3.8-flash', 'gemini-3.1-pro-preview'],
  claude: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
  openai: ['gpt-6-luna', 'gpt-5.5', 'gpt-5.4-mini'],
  ollama: ['gemma4:12b', 'qwen3.5:9b'],
};

/** 역할별로 지금 쓸 AI */
export interface ResolvedAi {
  /** 제공자 어댑터 */
  provider: AiProvider;
  /** 모델 이름 */
  model: string;
}

/**
 * AI 호출 창구. 역할(분석·작성)마다 설정에서 고른 제공자와 모델로 부른다.
 * 서비스들은 제공자를 직접 알지 않고 이 창구만 쓴다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * @param providers 등록된 제공자 어댑터 목록 (ai.module.ts)
   * @param settings 공용 설정 (역할별 선택)
   */
  constructor(
    @Inject(AI_PROVIDERS) private readonly providers: AiProvider[],
    private readonly settings: SettingsService,
  ) {}

  /**
   * 역할에 고른 AI를 찾는다.
   * @param role 분석 또는 작성
   */
  async resolve(role: AiRole): Promise<ResolvedAi> {
    const choice: AiChoice = await this.settings.get(
      role === 'analysis' ? AI_ANALYSIS : AI_DRAFTING,
    );
    const provider = this.providers.find((p) => p.id === choice.provider);
    if (!provider) {
      throw new AiError(
        `"${choice.provider}" AI는 지원하지 않아요 · 설정에서 다시 골라 주세요`,
        false,
      );
    }
    return { provider, model: choice.model };
  }

  /**
   * 고른 AI로 JSON 답을 받는다.
   * @param ai resolve()로 찾은 AI
   * @param req 요청 (model은 ai.model로 채운다)
   * @param label 로그에 남길 일 이름 (예: analysis#12)
   */
  async generate<T>(
    ai: ResolvedAi,
    req: Omit<AiRequest<T>, 'model'>,
    label: string,
  ): Promise<T> {
    const started = Date.now();
    try {
      const data = await ai.provider.generateJson({ ...req, model: ai.model });
      this.logger.log(
        `${label} ${ai.provider.id}/${ai.model} ${Date.now() - started}ms`,
      );
      return data;
    } catch (err) {
      const e =
        err instanceof AiError
          ? err
          : new AiError(
              `AI 호출에 실패했어요 · 잠시 뒤 다시 시도해 주세요`,
              true,
              err,
            );
      this.logger.warn(
        `${label} ${ai.provider.id}/${ai.model} 실패: ${e.message}`,
      );
      throw e;
    }
  }

  /** 제공자마다 지금 쓸 수 있는지 (설정 화면) */
  async providerInfos(): Promise<AiProviderInfo[]> {
    return Promise.all(
      this.providers.map(async (p) => ({
        id: p.id,
        label: p.label,
        canWatchVideo: p.canWatchVideo,
        modelExamples: MODEL_EXAMPLES[p.id] ?? [],
        ...(await p.status()),
      })),
    );
  }
}
