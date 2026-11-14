import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
  type ModelMessage,
} from 'ai';
import {
  AiError,
  type AiModelOption,
  type AiProvider,
  type AiProviderId,
  type AiRequest,
} from '../ai-provider.js';

/** SDK 어댑터를 만드는 값 */
export interface SdkProviderConfig {
  /** 제공자 ID */
  id: AiProviderId;
  /** 화면에 보일 이름 */
  label: string;
  /** 유튜브 주소로 영상을 볼 수 있는지 */
  canWatchVideo: boolean;
  /** API 키 환경 변수 이름 (안내 문구용) */
  keyName: string;
  /** API 키를 읽는다 (비어 있으면 쓸 수 없음) */
  apiKey: () => string;
  /** 키로 모델 객체를 만든다 */
  createModel: (apiKey: string, model: string) => LanguageModel;
  /** 키로 모델 목록을 받는다 (model-catalog.ts) */
  listModels: (apiKey: string) => Promise<AiModelOption[]>;
  /** 쓸 수 있을 때 안내 */
  readyNote: string;
  /** 제공자별 추가 옵션 (예: 추론 강도) */
  providerOptions?: Record<string, Record<string, string | number | boolean>>;
}

/**
 * Vercel AI SDK로 부르는 제공자 어댑터 (Gemini, Claude, OpenAI 공통).
 * 구조화 출력은 generateText + Output.object로 받고, 실패는 화면용 한 줄로 바꾼다.
 */
export class SdkAiProvider implements AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  readonly canWatchVideo: boolean;

  /**
   * @param config 제공자별 설정
   */
  constructor(private readonly config: SdkProviderConfig) {
    this.id = config.id;
    this.label = config.label;
    this.canWatchVideo = config.canWatchVideo;
  }

  async status() {
    const ready = this.config.apiKey().length > 0;
    return {
      ready,
      note: ready
        ? this.config.readyNote
        : `${this.config.keyName}가 없어요 · server/.env.development에 넣어 주세요`,
    };
  }

  async listModels(): Promise<AiModelOption[]> {
    const key = this.config.apiKey();
    if (!key) {
      throw new AiError(
        `${this.config.keyName}가 없어 추천 목록을 보여 드려요 · 키를 넣으면 쓸 수 있는 모델이 모두 보여요`,
        false,
      );
    }
    return this.config.listModels(key);
  }

  async generateJson<T>(req: AiRequest<T>): Promise<T> {
    const key = this.config.apiKey();
    if (!key) {
      throw new AiError(
        `${this.config.keyName}가 없어요 · server/.env.development에 넣거나 설정에서 다른 AI를 골라 주세요`,
        false,
      );
    }

    // 영상은 파일 조각으로 넘긴다 (Gemini는 유튜브 주소를 직접 읽는다)
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          ...(req.videoUrl && this.canWatchVideo
            ? [
                {
                  type: 'file' as const,
                  data: req.videoUrl,
                  mediaType: 'video/mp4',
                },
              ]
            : []),
          { type: 'text' as const, text: req.prompt },
        ],
      },
    ];

    try {
      const { output } = await generateText({
        model: this.config.createModel(key, req.model),
        system: req.system,
        messages,
        output: Output.object({ schema: req.schema }),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(req.timeoutMs),
        providerOptions: this.config.providerOptions,
      });
      return output as T;
    } catch (err) {
      throw toAiError(this.label, req.model, err);
    }
  }
}

/**
 * SDK 오류를 화면용 한 줄로 바꾼다.
 * @param label 제공자 이름
 * @param model 모델 이름
 * @param err 원래 오류
 */
export function toAiError(label: string, model: string, err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  ) {
    return new AiError(
      `${label}가 제한 시간 안에 답하지 않았어요 · 잠시 뒤 다시 시도해 주세요`,
      true,
      err,
    );
  }
  if (NoObjectGeneratedError.isInstance(err)) {
    return new AiError(
      `${label}의 답이 정해진 모양이 아니었어요 · [다시 생성]을 눌러 주세요`,
      true,
      err,
    );
  }
  if (APICallError.isInstance(err)) {
    const status = err.statusCode ?? 0;
    if (status === 401 || status === 403) {
      return new AiError(
        `${label} API 키가 맞지 않아요 · server/.env.development의 키를 확인해 주세요`,
        false,
        err,
      );
    }
    if (status === 404) {
      return new AiError(
        `${label}에 "${model}" 모델이 없어요 · 설정에서 모델 이름을 확인해 주세요`,
        false,
        err,
      );
    }
    if (status === 429) {
      return new AiError(
        `${label} 사용량 한도에 걸렸어요 · 잠시 뒤 다시 시도해 주세요`,
        true,
        err,
      );
    }
    if (status === 400) {
      return new AiError(
        `${label}가 요청을 받지 않았어요 (${firstLine(err.message)}) · 모델이 영상·구조화 답을 지원하는지 확인해 주세요`,
        false,
        err,
      );
    }
    return new AiError(
      `${label}가 응답하지 않아요 (${status || '연결 실패'}) · 잠시 뒤 다시 시도해 주세요`,
      true,
      err,
    );
  }
  return new AiError(
    `${label} 호출에 실패했어요 (${firstLine(String((err as Error)?.message ?? err))}) · 잠시 뒤 다시 시도해 주세요`,
    true,
    err,
  );
}

/** 긴 오류 메시지의 첫 줄만 (80자까지) */
function firstLine(text: string): string {
  return text.split('\n')[0].slice(0, 80);
}
