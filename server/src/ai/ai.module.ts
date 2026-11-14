import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import {
  OLLAMA_BASE_URL,
  OLLAMA_NUM_CTX,
} from '../settings/setting-definitions.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SettingsService } from '../settings/settings.service.js';
import { AI_PROVIDERS, type AiProvider } from './ai-provider.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import {
  fetchClaudeModels,
  fetchGeminiModels,
  fetchOpenAiModels,
} from './providers/model-catalog.js';
import { OllamaAiProvider } from './providers/ollama.provider.js';
import { SdkAiProvider } from './providers/sdk-ai.provider.js';

/**
 * 제공자 어댑터 목록을 만든다. 새 제공자는 여기 한 줄을 더하고 AI_PROVIDER_IDS에 이름을 넣는다.
 * @param config 환경 변수 (키)
 * @param settings 공용 설정 (Ollama 주소·문맥 길이)
 */
function createProviders(
  config: ConfigService<Env, true>,
  settings: SettingsService,
): AiProvider[] {
  return [
    new SdkAiProvider({
      id: 'gemini',
      label: 'Gemini',
      canWatchVideo: true,
      keyName: 'GEMINI_API_KEY',
      apiKey: () => config.get('GEMINI_API_KEY', { infer: true }),
      createModel: (apiKey, model) => createGoogle({ apiKey })(model),
      listModels: (apiKey) => fetchGeminiModels(apiKey),
      readyNote: '유튜브 영상을 직접 보고 분석해요',
    }),
    new SdkAiProvider({
      id: 'claude',
      label: 'Claude',
      canWatchVideo: false,
      keyName: 'ANTHROPIC_API_KEY',
      apiKey: () => config.get('ANTHROPIC_API_KEY', { infer: true }),
      createModel: (apiKey, model) => createAnthropic({ apiKey })(model),
      listModels: (apiKey) => fetchClaudeModels(apiKey),
      readyNote: '영상 설명과 인기 댓글로 분석하고, 댓글을 자연스럽게 써요',
    }),
    new SdkAiProvider({
      id: 'openai',
      label: 'OpenAI',
      canWatchVideo: false,
      keyName: 'OPENAI_API_KEY',
      apiKey: () => config.get('OPENAI_API_KEY', { infer: true }),
      createModel: (apiKey, model) => createOpenAI({ apiKey })(model),
      listModels: (apiKey) => fetchOpenAiModels(apiKey),
      readyNote: '영상 설명과 인기 댓글로 분석하고, 댓글을 써요',
    }),
    new OllamaAiProvider(async () => ({
      baseUrl: await settings.get(OLLAMA_BASE_URL),
      numCtx: await settings.get(OLLAMA_NUM_CTX),
    })),
  ];
}

/** AI 제공자 모듈. AI_PROVIDERS를 바꾸면 테스트용 가짜 AI를 넣을 수 있다 */
@Module({
  imports: [SettingsModule],
  controllers: [AiController],
  providers: [
    {
      provide: AI_PROVIDERS,
      inject: [ConfigService, SettingsService],
      useFactory: createProviders,
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
