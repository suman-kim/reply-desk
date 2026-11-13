import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service.js';

/**
 * AI 제공자 안내 API (설정 화면에서 고를 때).
 * - GET /api/settings/ai/providers  제공자별 사용 가능 여부, 안내, 영상 직접 보기 여부, 모델 예시
 */
@Controller('settings/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** 제공자별 사용 가능 여부 */
  @Get('providers')
  providers() {
    return this.ai.providerInfos();
  }
}
