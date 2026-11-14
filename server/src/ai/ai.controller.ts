import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { AI_PROVIDER_IDS, type AiProviderId } from './ai-provider.js';
import { AiService } from './ai.service.js';

/** 제공자 ID 경로 값 */
const providerParam = z.enum(AI_PROVIDER_IDS, {
  error: '제공자는 gemini, claude, openai, ollama 중 하나예요',
});
/** ?refresh=1 이면 받아 둔 목록을 버리고 다시 받는다 */
const refreshQuery = z
  .enum(['0', '1'])
  .optional()
  .transform((v) => v === '1');

/**
 * AI 제공자 안내 API (설정 화면에서 고를 때).
 * - GET /api/settings/ai/providers  제공자별 사용 가능 여부, 안내, 영상 직접 보기 여부, 모델 예시
 * - GET /api/settings/ai/providers/:id/models?refresh=1  모델 고르기 목록 (제공자 API에서 받음, 못 받으면 추천 목록)
 */
@Controller('settings/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** 제공자별 사용 가능 여부 */
  @Get('providers')
  providers() {
    return this.ai.providerInfos();
  }

  /**
   * 모델 고르기 목록
   * @param id 제공자 ID
   * @param refresh 다시 받을지
   */
  @Get('providers/:id/models')
  models(
    @Param('id', { schema: providerParam }) id: AiProviderId,
    @Query('refresh', { schema: refreshQuery }) refresh: boolean,
  ) {
    return this.ai.modelList(id, refresh);
  }
}
