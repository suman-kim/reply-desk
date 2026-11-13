import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { PostLogService } from './post-log.service.js';
import { PostQuotaService } from './post-quota.service.js';

/** 게시 기록 조회 조건 */
const logQuerySchema = z.object({
  /** 주제 ID. 없으면 전체 보기 */
  topicId: z.coerce.number().int().positive().optional(),
  /** 가져올 행 수 (기본 50, 최대 200) */
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * 게시 현황·기록 API. 실제 게시(Playwright)는 다음 작업에서 이 모듈에 붙는다.
 * - GET /api/posting/today          오늘 게시 n/상한, 주제별 수
 * - GET /api/posting/logs?topicId=  게시 기록 (최근 순)
 */
@Controller('posting')
export class PostingController {
  constructor(
    private readonly quota: PostQuotaService,
    private readonly logs: PostLogService,
  ) {}

  /** 오늘 게시 현황 */
  @Get('today')
  today() {
    return this.quota.today();
  }

  /**
   * 게시 기록
   * @param query 주제 ID와 행 수
   */
  @Get('logs')
  list(
    @Query({ schema: logQuerySchema }) query: z.infer<typeof logQuerySchema>,
  ) {
    return this.logs.list(query);
  }
}
