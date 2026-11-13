import { AiError } from '../ai-provider.js';
import {
  claudeModelsFrom,
  fetchOllamaModels,
  geminiModelsFrom,
  ollamaModelsFrom,
  openAiModelsFrom,
} from './model-catalog.js';

/** 제공자 응답에서 글쓰기 모델만 고르는지 (실제 API 응답 모양을 줄여 씀) */
describe('모델 목록 고르기', () => {
  it('Gemini: generateContent를 받는 gemini-*만, 임베딩·음성·이미지는 뺀다', () => {
    const r = geminiModelsFrom({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-3.8-flash',
          displayName: 'Gemini 3.8 Flash',
          supportedGenerationMethods: ['generateContent', 'countTokens'],
        },
        {
          name: 'models/gemini-embedding-001',
          supportedGenerationMethods: ['embedContent'],
        },
        {
          name: 'models/gemini-2.5-flash-preview-tts',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-2.5-flash-image',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemma-3-27b-it',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    });
    expect(r).toEqual([
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ]);
  });

  it('Claude: 받은 순서(최신이 앞) 그대로, 이름은 display_name', () => {
    expect(
      claudeModelsFrom({
        data: [
          { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' },
          { id: 'claude-haiku-5-5' },
        ],
      }),
    ).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      { id: 'claude-haiku-5-5', label: 'claude-haiku-5-5' },
    ]);
  });

  it('OpenAI: gpt-*·o 추론 모델만, 최신이 앞. 임베딩·음성·이미지·실시간은 뺀다', () => {
    const r = openAiModelsFrom({
      data: [
        { id: 'gpt-5.5', created: 200 },
        { id: 'text-embedding-3-large', created: 300 },
        { id: 'gpt-6-luna', created: 400 },
        { id: 'o4-mini', created: 100 },
        { id: 'gpt-realtime', created: 500 },
        { id: 'gpt-image-1', created: 500 },
        { id: 'gpt-4o-mini-tts', created: 500 },
        { id: 'whisper-1', created: 50 },
      ],
    });
    expect(r.map((m) => m.id)).toEqual(['gpt-6-luna', 'gpt-5.5', 'o4-mini']);
  });

  it('Ollama: 받아 둔 모델 중 임베딩은 빼고, 크기를 이름에 붙인다', () => {
    expect(
      ollamaModelsFrom({
        models: [
          {
            name: 'gemma4:12b',
            details: { family: 'gemma3', parameter_size: '12.2B' },
          },
          {
            name: 'bge-m3:latest',
            details: { family: 'bert', parameter_size: '566M' },
          },
          { name: 'qwen3.5:9b', details: {} },
        ],
      }),
    ).toEqual([
      { id: 'gemma4:12b', label: 'gemma4:12b (12.2B)' },
      { id: 'qwen3.5:9b', label: 'qwen3.5:9b' },
    ]);
  });

  it('목록 API가 실패하면 화면용 한 줄로 바꾼다', async () => {
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await expect(fetchOllamaModels('http://x', down)).rejects.toBeInstanceOf(
      AiError,
    );
    const unauthorized = (async () =>
      new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(fetchOllamaModels('http://x', unauthorized)).rejects.toThrow(
      'API 키가 맞지 않아',
    );
  });
});
