import { z } from 'zod';
import { AiError, type AiProvider, type AiRequest } from '../ai-provider.js';

/** Ollama 연결 설정 (매번 설정에서 읽는다) */
export interface OllamaSettings {
  /** Ollama 주소 (예: http://127.0.0.1:11435, SSH 터널) */
  baseUrl: string;
  /** 문맥 길이. 같은 PC의 다른 앱과 같은 값이어야 모델을 다시 올리지 않는다 */
  numCtx: number;
}

/** /api/chat 응답 중 쓰는 부분 */
interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

/**
 * Ollama 어댑터. AI SDK 대신 /api/chat을 직접 부른다.
 * - think: false — 생각을 켜면 첫 글자가 수 초 늦어진다
 * - options.num_ctx — 같은 GPU를 쓰는 다른 앱(animation-chat)과 같은 값을 써야 모델을 다시 올리지 않는다
 * - format — JSON 스키마를 넘겨 그 모양으로만 답하게 한다
 */
export class OllamaAiProvider implements AiProvider {
  readonly id = 'ollama' as const;
  readonly label = 'Ollama';
  readonly canWatchVideo = false;

  /**
   * @param settings 지금 설정을 읽는 함수
   * @param fetchFn fetch (테스트에서 바꿔 넣는다)
   */
  constructor(
    private readonly settings: () => Promise<OllamaSettings>,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async status() {
    const { baseUrl } = await this.settings();
    return {
      ready: true,
      note: `${baseUrl}에서 돌아요 · 키가 필요 없고, 모델은 미리 받아 두세요 (ollama pull)`,
    };
  }

  async generateJson<T>(req: AiRequest<T>): Promise<T> {
    const { baseUrl, numCtx } = await this.settings();
    let res: Response;
    try {
      res = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(req.timeoutMs),
        body: JSON.stringify({
          model: req.model,
          stream: false,
          think: false,
          format: z.toJSONSchema(req.schema, { io: 'input' }),
          options: { num_ctx: numCtx, temperature: 0.7 },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt },
          ],
        }),
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === 'TimeoutError' || err.name === 'AbortError')
      ) {
        throw new AiError(
          'Ollama가 제한 시간 안에 답하지 않았어요 · AI PC가 다른 작업(이미지·영상) 중인지 확인해 주세요',
          true,
          err,
        );
      }
      throw new AiError(
        `Ollama(${baseUrl})에 연결하지 못했어요 · AI PC가 켜져 있는지, SSH 터널이 열려 있는지 확인해 주세요`,
        true,
        err,
      );
    }

    const body = (await res.json().catch(() => ({}))) as OllamaChatResponse;
    if (!res.ok) {
      if (res.status === 404 || /not found/i.test(body.error ?? '')) {
        throw new AiError(
          `Ollama에 "${req.model}" 모델이 없어요 · AI PC에서 ollama pull ${req.model}을 실행해 주세요`,
          false,
        );
      }
      throw new AiError(
        `Ollama가 오류를 냈어요 (${body.error ?? res.status}) · 잠시 뒤 다시 시도해 주세요`,
        true,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(body.message?.content ?? '');
    } catch {
      throw new AiError(
        'Ollama의 답이 JSON이 아니었어요 · [다시 생성]을 눌러 주세요',
        true,
      );
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) {
      throw new AiError(
        'Ollama의 답이 정해진 모양이 아니었어요 · [다시 생성]을 눌러 주세요',
        true,
        parsed.error,
      );
    }
    return parsed.data;
  }
}
