/**
 * 서버 API 호출. 주소는 늘 /api 로 시작하고, 개발 중에는 Vite가 서버(4100)로 넘긴다.
 */

/** API 실패. message는 서버가 준 한국어 한 줄(여러 줄이면 줄바꿈으로 이음) */
export class ApiError extends Error {
  /** HTTP 상태 (서버에 못 닿았으면 0) */
  readonly status: number;
  /** 차단 사유 코드 등 (409 { code }) */
  readonly code: string | null;
  /** "필드: 원인" 목록을 필드별로 나눈 것 */
  readonly fieldErrors: Record<string, string>;

  /**
   * @param status HTTP 상태
   * @param message 화면에 보일 문구
   * @param code 차단 사유 코드
   * @param fieldErrors 필드별 원인
   */
  constructor(status: number, message: string, code: string | null = null, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * 서버 오류 응답을 ApiError로 바꾼다.
 * 검증 실패는 message가 ["name: 주제 이름을 적어 주세요", …] 모양이라 필드별로도 나눈다.
 * @param status HTTP 상태
 * @param body 응답 본문
 */
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { message?: unknown; code?: unknown };
  const messages = Array.isArray(b.message)
    ? b.message.map(String)
    : typeof b.message === 'string'
      ? [b.message]
      : [];
  const fieldErrors: Record<string, string> = {};
  for (const m of messages) {
    const hit = /^([a-zA-Z]+): (.+)$/.exec(m);
    if (hit && !(hit[1] in fieldErrors)) fieldErrors[hit[1]] = hit[2];
  }
  const text =
    messages.length > 0
      ? messages.map((m) => m.replace(/^[a-zA-Z]+: /, '')).join('\n')
      : status === 0
        ? '서버에 연결하지 못했어요 · server에서 npm run start:dev가 돌고 있는지 확인해 주세요'
        : `요청이 실패했어요 (${status}) · 잠시 뒤 다시 시도해 주세요`;
  return new ApiError(status, text, typeof b.code === 'string' ? b.code : null, fieldErrors);
}

/**
 * JSON API를 부른다.
 * @param method HTTP 메서드
 * @param path /api 뒤의 경로 (예: /topics)
 * @param body 보낼 값
 */
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw toApiError(0, null);
  }
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw toApiError(res.status, json);
  return json as T;
}
