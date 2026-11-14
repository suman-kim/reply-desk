import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  Output,
  RetryError,
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

    // 제한 시간은 다시 부르는 것까지 합쳐서 센다
    const signal = AbortSignal.timeout(req.timeoutMs);
    let attempts = 0;
    try {
      // 서버가 붐빌 때(503 등)만 잠깐 쉬고 다시 부른다. 크레딧·키·모델 문제는 바로 알린다
      return await withRetry(
        async () => {
          attempts += 1;
          const { output } = await generateText({
            model: this.config.createModel(key, req.model),
            system: req.system,
            messages,
            output: Output.object({ schema: req.schema }),
            maxRetries: 0,
            abortSignal: signal,
            providerOptions: this.config.providerOptions,
          });
          return output as T;
        },
        isTransient,
        RETRY_DELAYS_MS,
        signal,
      );
    } catch (err) {
      throw toAiError(this.label, req.model, err, attempts);
    }
  }
}

/** 서버가 붐빌 때 다시 부르기 전 쉬는 시간 (처음 한 번 + 최대 3번 더, 모두 약 17초) */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

/**
 * 잠깐 지나가는 오류면 쉬었다가 다시 부른다.
 * @param fn 부를 일
 * @param transient 다시 부를 만한 오류인지
 * @param delays 시도 사이에 쉴 시간 목록 (길이만큼 더 부른다)
 * @param signal 제한 시간 (끝나면 더 부르지 않는다)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  transient: (err: unknown) => boolean,
  delays: number[],
  signal?: AbortSignal,
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const wait = delays[i];
      if (wait === undefined || signal?.aborted || !transient(err)) throw err;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, wait);
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      if (signal?.aborted) throw err;
    }
  }
}

/** SDK가 재시도 끝에 감싼 오류(RetryError)면 마지막 오류를 꺼낸다 */
function unwrap(err: unknown): unknown {
  return RetryError.isInstance(err) ? err.lastError : err;
}

/** 응답 본문까지 합친 오류 글 (원인 단어를 찾는 데 쓴다) */
function errorText(err: APICallError): string {
  return `${err.message} ${err.responseBody ?? ''}`;
}

/**
 * 크레딧(잔액)이 없다는 응답 (OpenAI: no credits·코드 insufficient_quota, Claude: credit balance is too low).
 * 'billing'만으로는 고르지 않는다: Gemini의 분당 한도 초과 글에도 billing이 들어간다
 */
const NO_CREDIT = /no credits|credit balance is too low|insufficient_quota/i;
/** 사용 한도(분당·하루)를 넘었다는 응답 */
const QUOTA = /quota|resource.?exhausted|rate.?limit/i;
/** 서버 과부하 응답 (Gemini: This model is currently experiencing high demand) */
const OVERLOADED = /high demand|overloaded|unavailable/i;

/**
 * 잠깐 기다렸다 다시 부르면 될 오류인지 (서버 과부하·일시 오류).
 * 크레딧·사용 한도·키·모델 문제는 다시 불러도 같으므로 아니다.
 * @param err 원래 오류
 */
export function isTransient(err: unknown): boolean {
  const e = unwrap(err);
  if (!APICallError.isInstance(e)) return false;
  const text = errorText(e);
  if (NO_CREDIT.test(text) || QUOTA.test(text)) return false;
  const status = e.statusCode ?? 0;
  return status >= 500 || OVERLOADED.test(text);
}

/**
 * SDK 오류를 화면용 한 줄로 바꾼다 (원인 · 할 일).
 * @param label 제공자 이름
 * @param model 모델 이름
 * @param raw 원래 오류
 * @param attempts 몇 번 불렀는지 (과부하 안내에 쓴다)
 */
export function toAiError(
  label: string,
  model: string,
  raw: unknown,
  attempts = 1,
): AiError {
  if (raw instanceof AiError) return raw;
  // SDK가 재시도 끝에 감싼 오류면 마지막 오류로 판단한다 (감싼 글만 보면 원인이 잘려 보인다)
  const err = unwrap(raw);
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
    const text = errorText(err);
    if (NO_CREDIT.test(text)) {
      return new AiError(
        `${label} 크레딧(잔액)이 없어요 · ${label} 결제 화면에서 충전하거나 설정에서 다른 AI를 골라 주세요`,
        false,
        err,
      );
    }
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
    if (status === 429 || QUOTA.test(text)) {
      return new AiError(
        `${label} 사용 한도(분당·하루)를 넘었어요 · 잠시 뒤 다시 하거나 ${label} 결제·한도 설정을 확인해 주세요`,
        true,
        err,
      );
    }
    if (status >= 500 || OVERLOADED.test(text)) {
      return new AiError(
        `${label}의 "${model}" 모델이 지금 붐벼요 (${label} 서버 과부하, ${attempts}번 시도) · 보통 잠깐이에요. 잠시 뒤 [다시 생성]을 누르거나 설정에서 다른 모델로 바꿔 주세요`,
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
    raw,
  );
}

/** 긴 오류 메시지의 첫 줄만 (160자까지) */
function firstLine(text: string): string {
  return text.split('\n')[0].slice(0, 160);
}
