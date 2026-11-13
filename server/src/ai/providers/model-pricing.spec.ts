import { pricingOf } from './model-pricing.js';

describe('모델 가격표', () => {
  it('Gemini 무료 등급 모델은 무료, Pro는 유료', () => {
    expect(pricingOf('gemini', 'gemini-3.8-flash')).toMatchObject({
      free: true,
      inputPerM: 0.75,
      outputPerM: 3.75,
    });
    expect(pricingOf('gemini', 'gemini-3.1-pro-preview')?.free).toBe(false);
  });

  it('Claude·OpenAI는 무료가 없고, 날짜가 붙은 고정판은 대표 이름으로 찾는다', () => {
    expect(pricingOf('claude', 'claude-haiku-4-5-20251001')).toMatchObject({
      free: false,
      inputPerM: 1,
      outputPerM: 5,
    });
    expect(pricingOf('openai', 'gpt-6-luna')).toMatchObject({
      free: false,
      inputPerM: 0.1,
    });
  });

  it('Ollama는 늘 무료, 표에 없는 모델은 null (지어내지 않는다)', () => {
    expect(pricingOf('ollama', 'gemma4:12b')).toMatchObject({
      free: true,
      inputPerM: 0,
    });
    expect(pricingOf('gemini', 'gemini-99-unknown')).toBeNull();
  });
});
