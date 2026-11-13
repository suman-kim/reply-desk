import { z } from 'zod';
import { AiError } from '../ai-provider.js';
import { OllamaAiProvider } from './ollama.provider.js';

const schema = z.object({ text: z.string() });
const settings = async () => ({
  baseUrl: 'http://127.0.0.1:11435/',
  numCtx: 16384,
});
const req = {
  model: 'gemma4:12b',
  system: 'sys',
  prompt: 'hi',
  schema,
  timeoutMs: 5000,
};

/** 가짜 fetch: 받은 요청을 남기고 정한 응답을 준다 */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify(body), { status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('OllamaAiProvider', () => {
  it('생각 끄기·문맥 길이·JSON 스키마를 넣어 /api/chat을 부른다', async () => {
    const { fn, calls } = fakeFetch(200, {
      message: { content: '{"text":"안녕"}' },
    });
    const out = await new OllamaAiProvider(settings, fn).generateJson(req);
    expect(out).toEqual({ text: '안녕' });
    expect(calls[0].url).toBe('http://127.0.0.1:11435/api/chat');
    expect(calls[0].body).toMatchObject({
      model: 'gemma4:12b',
      stream: false,
      think: false,
      options: { num_ctx: 16384 },
      format: { type: 'object', required: ['text'] },
    });
  });

  it('모델이 없으면 받을 명령까지 알려 준다', async () => {
    const { fn } = fakeFetch(404, {
      error: 'model "x" not found, try pulling it first',
    });
    await expect(
      new OllamaAiProvider(settings, fn).generateJson({ ...req, model: 'x' }),
    ).rejects.toThrow('ollama pull x');
  });

  it('답이 모양에 맞지 않으면 다시 생성하라고 한다', async () => {
    const { fn } = fakeFetch(200, { message: { content: '{"other":1}' } });
    await expect(
      new OllamaAiProvider(settings, fn).generateJson(req),
    ).rejects.toBeInstanceOf(AiError);
  });

  it('연결이 안 되면 AI PC와 터널을 확인하라고 한다', async () => {
    const fn = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(
      new OllamaAiProvider(settings, fn).generateJson(req),
    ).rejects.toThrow('SSH 터널');
  });

  it('상태: 실제로 연결해 보고, 안 되면 터널 안내와 함께 쓸 수 없다고 한다', async () => {
    const up = new OllamaAiProvider(
      async () => ({ baseUrl: 'http://x', numCtx: 1 }),
      (async () => new Response('{"models":[]}')) as unknown as typeof fetch,
    );
    expect((await up.status()).ready).toBe(true);
    const down = new OllamaAiProvider(
      async () => ({ baseUrl: 'http://x', numCtx: 1 }),
      (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    );
    expect(await down.status()).toMatchObject({
      ready: false,
      note: expect.stringContaining('SSH 터널'),
    });
  });
});
