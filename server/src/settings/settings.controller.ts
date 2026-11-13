import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { SettingsService } from './settings.service.js';

/** 설정 값 바꾸기 요청 */
const updateSettingSchema = z.object({
  /** 새 값 (모양은 키마다 다르고 서비스가 검증한다) */
  value: z.unknown(),
});

/**
 * 공용 설정 API.
 * - GET    /api/settings                  모든 설정 (이름·도움말·지금 값·기본값)
 * - PUT    /api/settings/:key             값 바꾸기 { value }
 * - DELETE /api/settings/:key             기본값으로 되돌리기
 * - GET    /api/settings/ai/providers     AI 제공자별 사용 가능 여부
 */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** 모든 설정 */
  @Get()
  list() {
    return this.settings.list();
  }

  /** AI 제공자별 사용 가능 여부 */
  @Get('ai/providers')
  aiProviders() {
    return this.settings.aiProviders();
  }

  /**
   * 값 바꾸기
   * @param key 설정 키 (예: posting.dailyCapTotal)
   * @param body { value }
   */
  @Put(':key')
  update(
    @Param('key') key: string,
    @Body({ schema: updateSettingSchema })
    body: z.infer<typeof updateSettingSchema>,
  ) {
    return this.settings.update(key, body.value);
  }

  /**
   * 기본값으로 되돌리기
   * @param key 설정 키
   */
  @Delete(':key')
  reset(@Param('key') key: string) {
    return this.settings.reset(key);
  }
}
