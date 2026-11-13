import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 상태 확인 API.
 * - GET /api/health  서버와 DB가 살아 있는지
 */
@Controller('health')
export class HealthController {
  /**
   * @param dataSource DB 연결
   */
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** 서버·DB 상태 */
  @Get()
  async check(): Promise<{ ok: boolean; db: boolean }> {
    const db = await this.dataSource
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false);
    return { ok: db, db };
  }
}
