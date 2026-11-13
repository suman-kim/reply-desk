import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/id-param.js';
import { PostGuardService } from './post-guard.service.js';

/** 게시 판단 조건 */
const postCheckQuerySchema = z.object({
  /** 고른 영상 ID (없으면 "영상을 먼저 골라 주세요") */
  videoId: z.coerce.number().int().positive().optional(),
  /** 고른 프로필 ID (없으면 자동 배정) */
  profileId: z.coerce.number().int().positive().optional(),
});

/**
 * 게시 판단 API (③ 칸의 버튼 상태와 차단 사유 한 줄).
 * - GET /api/topics/:topicId/post-check?videoId=&profileId=
 */
@Controller('topics/:topicId/post-check')
export class RulesController {
  constructor(private readonly guard: PostGuardService) {}

  /**
   * 지금 댓글을 달 수 있는지
   * @param topicId 주제 ID
   * @param query 영상 ID, 프로필 ID
   */
  @Get()
  check(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Query({ schema: postCheckQuerySchema })
    query: z.infer<typeof postCheckQuerySchema>,
  ) {
    return this.guard.check(
      topicId,
      query.videoId ?? null,
      query.profileId ?? null,
    );
  }
}
