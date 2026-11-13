import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_ANALYSIS, AI_DRAFTING } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  AI_PROVIDERS,
  AiError,
  type AiChoice,
  type AiModelList,
  type AiProvider,
  type AiProviderId,
  type AiProviderInfo,
  type AiRequest,
  type AiRole,
} from './ai-provider.js';

/** 제공자 API에서 받은 모델 목록을 다시 받기 전까지 쓰는 시간 (10분) */
const MODEL_LIST_TTL_MS = 10 * 60 * 1000;

/** 모델 이름 예시 = 추천 모델 (설정 화면에서 앞에 두고, 목록을 못 받을 때 대신 보인다) */
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
  /** 제공자별로 받아 둔 모델 목록과 받은 시각 (API를 매번 부르지 않게) */
  private readonly modelCache = new Map<
    AiProviderId,
    { at: number; list: AiModelList }
  >();

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

  /**
   * 설정 화면의 모델 고르기 목록.
   * 제공자 API에서 받은 목록에 추천 모델 표시를 붙여 앞에 두고, 키가 없거나 받지 못하면 추천 목록만 보인다.
   * 받은 목록은 10분 동안 다시 쓴다.
   * @param providerId 제공자 ID
   * @param refresh 받아 둔 목록을 버리고 다시 받을지
   */
  async modelList(
    providerId: AiProviderId,
    refresh = false,
  ): Promise<AiModelList> {
    const cached = this.modelCache.get(providerId);
    if (!refresh && cached && Date.now() - cached.at < MODEL_LIST_TTL_MS)
      return cached.list;

    const recommended = MODEL_EXAMPLES[providerId] ?? [];
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new AiError(`"${providerId}" AI는 지원하지 않아요`, false);
    }
    try {
      const live = await provider.listModels();
      // 추천 모델이 실제 목록에 있으면 그 순서대로 앞에 둔다
      const rank = (id: string) => {
        const i = recommended.indexOf(id);
        return i === -1 ? recommended.length : i;
      };
      const models = live
        .map((m, i) => ({ ...m, recommended: recommended.includes(m.id), i }))
        .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
        .map(({ i: _i, ...m }) => m);
      const list: AiModelList = {
        provider: providerId,
        source: 'live',
        models,
        note:
          models.length === 0
            ? `${provider.label}에서 쓸 수 있는 글쓰기 모델이 없어요${providerId === 'ollama' ? ' · AI PC에서 ollama pull로 받아 주세요' : ''}`
            : null,
      };
      this.modelCache.set(providerId, { at: Date.now(), list });
      return list;
    } catch (err) {
      const note =
        err instanceof AiError
          ? err.message
          : `${provider.label} 모델 목록을 받지 못했어요 · 추천 목록을 보여 드려요`;
      if (!(err instanceof AiError))
        this.logger.warn(`모델 목록 실패: ${String(err)}`);
      // 실패는 받아 두지 않는다 (키를 넣고 다시 열면 바로 받도록)
      return {
        provider: providerId,
        source: 'recommended',
        models: recommended.map((id) => ({ id, label: id, recommended: true })),
        note,
      };
    }
  }
}
