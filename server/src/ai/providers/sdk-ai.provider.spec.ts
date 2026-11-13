import { APICallError, RetryError } from 'ai';
import { isTransient, toAiError, withRetry } from './sdk-ai.provider.js';

/**
 * 제공자 오류를 흉내 낸다
 * @param statusCode HTTP 상태
 * @param message 오류 글
 */
function apiError(statusCode: number, message: string): APICallError {
  return new APICallError({
    message,
    url: 'https://example.test',
    requestBodyValues: {},
    statusCode,
    responseBody: JSON.stringify({ error: { message } }),
  });
}

/** 실제로 받은 오류 글 (2026-11-13) */
const GEMINI_BUSY = apiError(
  503,
  'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
);
const OPENAI_NO_CREDIT = apiError(
  429,
  'You have no credits remaining. Please add credits to continue.',
);

describe('AI 오류를 화면 한 줄로', () => {
  it('SDK가 감싼 재시도 오류(RetryError)도 속의 원인으로 판단한다: 과부하', () => {
    const wrapped = new RetryError({
      message: 'Failed after 2 attempts. Last error: ...',
      reason: 'maxRetriesExceeded',
      errors: [GEMINI_BUSY, GEMINI_BUSY],
    });
    const e = toAiError('Gemini', 'gemini-3.8-flash', wrapped, 4);
    expect(e.message).toBe(
      'Gemini의 "gemini-3.8-flash" 모델이 지금 붐벼요 (Gemini 서버 과부하, 4번 시도) · 보통 잠깐이에요. 잠시 뒤 [다시 생성]을 누르거나 설정에서 다른 모델로 바꿔 주세요',
    );
    expect(e.retryable).toBe(true);
  });

  it('크레딧이 없으면 충전·다른 AI를 안내하고, 다시 해도 안 되는 오류로 둔다', () => {
    const e = toAiError('OpenAI', 'gpt-6-luna', OPENAI_NO_CREDIT);
    expect(e.message).toContain('OpenAI 크레딧(잔액)이 없어요');
    expect(e.retryable).toBe(false);
    expect(
      toAiError(
        'Claude',
        'm',
        apiError(
          400,
          'Your credit balance is too low to access the Anthropic API.',
        ),
      ).message,
    ).toContain('Claude 크레딧(잔액)이 없어요');
  });

  it('사용 한도(429 quota)는 한도 안내', () => {
    expect(
      toAiError(
        'Gemini',
        'm',
        apiError(
          429,
          'You exceeded your current quota, please check your plan and billing details.',
        ),
      ).message,
    ).toContain('사용 한도(분당·하루)를 넘었어요');
  });
});

describe('다시 부를 만한 오류', () => {
  it('서버 과부하·5xx만 다시 부른다', () => {
    expect(isTransient(GEMINI_BUSY)).toBe(true);
    expect(isTransient(apiError(500, 'internal'))).toBe(true);
    expect(isTransient(OPENAI_NO_CREDIT)).toBe(false);
    expect(isTransient(apiError(429, 'quota exceeded'))).toBe(false);
    expect(isTransient(apiError(400, 'bad request'))).toBe(false);
    expect(isTransient(new Error('x'))).toBe(false);
  });

  it('과부하면 쉬었다 다시 불러 성공하고, 다른 오류는 바로 던진다', async () => {
    let calls = 0;
    const ok = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw GEMINI_BUSY;
        return '초안';
      },
      isTransient,
      [1, 1, 1],
    );
    expect([ok, calls]).toEqual(['초안', 3]);

    calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw OPENAI_NO_CREDIT;
        },
        isTransient,
        [1, 1, 1],
      ),
    ).rejects.toBe(OPENAI_NO_CREDIT);
    expect(calls).toBe(1);
  });

  it('쉴 횟수를 다 쓰면 마지막 오류를 던진다', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw GEMINI_BUSY;
        },
        isTransient,
        [1, 1],
      ),
    ).rejects.toBe(GEMINI_BUSY);
    expect(calls).toBe(3);
  });
});
