import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/id-param.js';
import { DraftListStatus } from './draft-status.js';
import { DraftsService } from './drafts.service.js';

/** [영상 불러오기] 요청 */
const loadSchema = z
  .object({
    /** [새로 검색]: 최근에 검색했어도 다시 검색한다 */
    force: z.boolean().default(false),
  })
  // 본문 없이 부르면(예전 화면·테스트) 보통 불러오기
  .default({ force: false });

/** [다시 생성] 요청 */
const regenerateSchema = z.object({
  /** 분석(주제 매칭·고른 이유·근거 장면)부터 다시 할지. 기본은 초안만 다시 */
  reanalyze: z.boolean().default(false),
});

/** 초안 고치기 요청 */
const editSchema = z.object({
  /** 고친 글 */
  text: z
    .string()
    .trim()
    .min(1, '댓글을 적어 주세요')
    .max(1000, '댓글은 1000자까지예요'),
});

/** 초안 목록 조건 */
const listQuerySchema = z.object({
  /** 상태 */
  status: z.enum(DraftListStatus).optional(),
  /** 주제 ID */
  topicId: z.coerce.number().int().positive().optional(),
  /** 검색어 (영상 제목·댓글 내용) */
  q: z.string().trim().max(100).optional(),
  /** 최대 행 수 */
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * 초안 API.
 * - POST  /api/topics/:topicId/load                          [영상 불러오기] { force? } → { videos, search } (초안은 쓰지 않는다)
 * - GET   /api/topics/:topicId/drafts/progress               자동 작성 진행률 (2/5)
 * - GET   /api/topics/:topicId/videos/:videoId/draft         ② 칸: 영상·분석·초안·검사·게시 기록
 * - POST  /api/topics/:topicId/videos/:videoId/draft         [다시 생성] { reanalyze? }
 * - PATCH /api/drafts/:id                                    초안 고치기 { text } → 바로 다시 검사
 * - GET   /api/drafts?status=&topicId=&q=                    초안 목록 + 상태별 개수
 */
@Controller()
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  /**
   * [영상 불러오기] (영상만, 초안은 ②의 [초안 작성]에서). 최근에 검색했으면 저장된 목록을 쓴다
   * @param topicId 주제 ID
   * @param body { force? } [새로 검색]
   */
  @Post('topics/:topicId/load')
  load(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Body({ schema: loadSchema }) body: z.infer<typeof loadSchema>,
  ) {
    return this.drafts.load(topicId, body.force);
  }

  /**
   * 자동 작성 진행률
   * @param topicId 주제 ID
   */
  @Get('topics/:topicId/drafts/progress')
  progress(@Param('topicId', { schema: idParam }) topicId: number) {
    return this.drafts.progress(topicId);
  }

  /**
   * ② 칸
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   */
  @Get('topics/:topicId/videos/:videoId/draft')
  detail(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Param('videoId', { schema: idParam }) videoId: number,
  ) {
    return this.drafts.detail(topicId, videoId);
  }

  /**
   * [다시 생성]
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   * @param body { reanalyze? }
   */
  @Post('topics/:topicId/videos/:videoId/draft')
  regenerate(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Param('videoId', { schema: idParam }) videoId: number,
    @Body({ schema: regenerateSchema }) body: z.infer<typeof regenerateSchema>,
  ) {
    return this.drafts.regenerate(topicId, videoId, body.reanalyze);
  }

  /**
   * 초안 고치기
   * @param id 초안 ID
   * @param body { text }
   */
  @Patch('drafts/:id')
  edit(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: editSchema }) body: z.infer<typeof editSchema>,
  ) {
    return this.drafts.edit(id, body.text);
  }

  /**
   * 초안 목록
   * @param query 상태·주제·검색어
   */
  @Get('drafts')
  list(
    @Query({ schema: listQuerySchema }) query: z.infer<typeof listQuerySchema>,
  ) {
    return this.drafts.list(query);
  }
}
