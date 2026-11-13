import { AiError, type AiModelOption } from '../ai-provider.js';

/**
 * 제공자별 모델 목록 API를 부르고, 글쓰기(대화)에 쓸 수 있는 모델만 남긴다.
 * 응답을 고르는 부분(…From)은 따로 두어 실제 API 없이 테스트한다.
 */

/** 목록 API 제한 시간 */
const LIST_TIMEOUT_MS = 10_000;

/**
 * 목록 API를 부른다. 실패하면 화면용 한 줄로 바꾼다.
 * @param label 제공자 이름
 * @param url 주소
 * @param headers 인증 헤더
 * @param fetchFn fetch (테스트에서 바꿔 넣는다)
 */
async function getJson(
  label: string,
  url: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      headers,
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new AiError(
      `${label} 모델 목록을 받지 못했어요 (연결 실패) · 추천 목록을 보여 드려요`,
      true,
      err,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiError(
      `${label} API 키가 맞지 않아 모델 목록을 못 받았어요 · 키를 확인해 주세요`,
      false,
    );
  }
  if (!res.ok) {
    throw new AiError(
      `${label} 모델 목록을 받지 못했어요 (${res.status}) · 추천 목록을 보여 드려요`,
      true,
    );
  }
  return res.json();
}

/** Gemini 모델 중 글쓰기가 아닌 것 (임베딩·음성·받아쓰기·이미지 생성(nano-banana)·실시간 등) */
const GEMINI_SKIP =
  /embedding|tts|transcribe|image|banana|live|audio|aqa|robotics|computer-use/i;

/**
 * Gemini 목록 응답에서 글쓰기 모델만 고른다 (generateContent를 받는 gemini-*)
 * @param body GET /v1beta/models 응답
 */
export function geminiModelsFrom(body: unknown): AiModelOption[] {
  const models =
    (
      body as {
        models?: {
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }[];
      }
    ).models ?? [];
  return models
    .map((m) => ({ ...m, id: m.name.replace(/^models\//, '') }))
    .filter(
      (m) =>
        m.id.startsWith('gemini') &&
        !GEMINI_SKIP.test(m.id) &&
        (m.supportedGenerationMethods ?? []).includes('generateContent'),
    )
    .map((m) => ({ id: m.id, label: m.displayName || m.id }))
    .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));
}

/**
 * Claude 목록 응답 (최신이 앞)
 * @param body GET /v1/models 응답
 */
export function claudeModelsFrom(body: unknown): AiModelOption[] {
  const data =
    (body as { data?: { id: string; display_name?: string }[] }).data ?? [];
  return data
    .filter((m) => m.id.startsWith('claude'))
    .map((m) => ({ id: m.id, label: m.display_name || m.id }));
}

/** OpenAI 모델 중 글쓰기가 아닌 것 (임베딩·음성·이미지·실시간(live)·검색 등) */
const OPENAI_SKIP =
  /embedding|tts|whisper|dall-e|image|audio|realtime|live|transcribe|search|moderation|instruct|davinci|babbage/i;

/** 날짜가 붙은 고정판 이름 (예: gpt-5.5-2026-04-23) */
const DATED = /-\d{4}-\d{2}-\d{2}$/;

/**
 * OpenAI 목록 응답에서 글쓰기 모델만 고른다 (gpt-*, o1·o3 같은 추론 모델). 최신이 앞.
 * 날짜가 붙은 고정판은 같은 이름의 대표 모델이 있으면 뺀다 (목록이 두 배로 길어지지 않게).
 * @param body GET /v1/models 응답
 */
export function openAiModelsFrom(body: unknown): AiModelOption[] {
  const data =
    (body as { data?: { id: string; created?: number }[] }).data ?? [];
  const ids = new Set(data.map((m) => m.id));
  return data
    .filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !OPENAI_SKIP.test(m.id))
    .filter((m) => !(DATED.test(m.id) && ids.has(m.id.replace(DATED, ''))))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((m) => ({ id: m.id, label: m.id }));
}

/** Ollama 모델 중 글쓰기가 아닌 것 (임베딩) */
const OLLAMA_SKIP = /embed|bge|minilm/i;

/**
 * Ollama에 받아 둔 모델 목록에서 글쓰기 모델만 고른다 (이름 순)
 * @param body GET /api/tags 응답
 */
export function ollamaModelsFrom(body: unknown): AiModelOption[] {
  const models =
    (
      body as {
        models?: {
          name: string;
          details?: { family?: string; parameter_size?: string };
        }[];
      }
    ).models ?? [];
  return models
    .filter(
      (m) =>
        !OLLAMA_SKIP.test(m.name) && !/bert/i.test(m.details?.family ?? ''),
    )
    .map((m) => ({
      id: m.name,
      label: m.details?.parameter_size
        ? `${m.name} (${m.details.parameter_size})`
        : m.name,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Gemini 모델 목록
 * @param apiKey GEMINI_API_KEY
 * @param fetchFn fetch
 */
export async function fetchGeminiModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AiModelOption[]> {
  return geminiModelsFrom(
    await getJson(
      'Gemini',
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      { 'x-goog-api-key': apiKey },
      fetchFn,
    ),
  );
}

/**
 * Claude 모델 목록
 * @param apiKey ANTHROPIC_API_KEY
 * @param fetchFn fetch
 */
export async function fetchClaudeModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AiModelOption[]> {
  return claudeModelsFrom(
    await getJson(
      'Claude',
      'https://api.anthropic.com/v1/models?limit=1000',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      fetchFn,
    ),
  );
}

/**
 * OpenAI 모델 목록
 * @param apiKey OPENAI_API_KEY
 * @param fetchFn fetch
 */
export async function fetchOpenAiModels(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AiModelOption[]> {
  return openAiModelsFrom(
    await getJson(
      'OpenAI',
      'https://api.openai.com/v1/models',
      { authorization: `Bearer ${apiKey}` },
      fetchFn,
    ),
  );
}

/**
 * Ollama에 받아 둔 모델 목록
 * @param baseUrl Ollama 주소
 * @param fetchFn fetch
 */
export async function fetchOllamaModels(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<AiModelOption[]> {
  return ollamaModelsFrom(
    await getJson(
      'Ollama',
      `${baseUrl.replace(/\/$/, '')}/api/tags`,
      {},
      fetchFn,
    ),
  );
}
