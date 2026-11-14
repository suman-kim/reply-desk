import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/id-param.js';
import { VideosService } from './videos.service.js';

/** 영상 보기 창 댓글 수 (?limit=, 기본 30, 최대 100) */
const commentsLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(100, '댓글은 100개까지 볼 수 있어요')
  .optional()
  .transform((v) => v ?? 30);

/** 링크 직접 추가 요청 */
const addVideoSchema = z.object({
  /** 유튜브 링크나 영상 ID */
  url: z.string().trim().min(1, '유튜브 링크를 넣어 주세요').max(500),
});

/**
 * 주제별 영상 API (① 칸, ②의 링크 직접 입력).
 * - GET  /api/topics/:topicId/videos           영상 목록 (배지 포함)
 * - GET  /api/topics/:topicId/videos/search-status  [영상 불러오기]를 누르면 할 검색 방식, 마지막 검색 시각, 기준 시간
 * - POST /api/topics/:topicId/videos/fetch     [영상 불러오기] (YouTube 검색 → 정렬 → 저장, 최근에 검색했으면 저장된 목록)
 * - POST /api/topics/:topicId/videos           링크 직접 추가 { url }
 * - GET  /api/topics/:topicId/videos/:videoId  영상 하나
 * - GET  /api/topics/:topicId/videos/:videoId/comments?limit=30  영상 보기 창의 인기 댓글 (할당량 1, 5분 받아 둠)
 */
@Controller('topics/:topicId/videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  /**
   * 영상 목록
   * @param topicId 주제 ID
   */
  @Get()
  list(@Param('topicId', { schema: idParam }) topicId: number) {
    return this.videos.listForTopic(topicId);
  }

  /**
   * [영상 불러오기]를 누르기 전의 검색 상태 (':videoId'보다 앞에 둬야 주소가 겹치지 않는다)
   * @param topicId 주제 ID
   */
  @Get('search-status')
  searchStatus(@Param('topicId', { schema: idParam }) topicId: number) {
    return this.videos.searchStatus(topicId);
  }

  /**
   * [영상 불러오기]
   * @param topicId 주제 ID
   */
  @Post('fetch')
  fetch(@Param('topicId', { schema: idParam }) topicId: number) {
    return this.videos.fetchForTopic(topicId);
  }

  /**
   * 링크 직접 추가
   * @param topicId 주제 ID
   * @param body { url }
   */
  @Post()
  add(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Body({ schema: addVideoSchema }) body: z.infer<typeof addVideoSchema>,
  ) {
    return this.videos.addByUrl(topicId, body.url);
  }

  /**
   * 영상 하나
   * @param topicId 주제 ID
   * @param videoId 내부 영상 ID
   */
  @Get(':videoId')
  get(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Param('videoId', { schema: idParam }) videoId: number,
  ) {
    return this.videos.getForTopic(topicId, videoId);
  }

  /**
   * 영상 보기 창의 인기 댓글
   * @param topicId 주제 ID
   * @param videoId 내부 영상 ID
   * @param limit 가져올 댓글 수
   */
  @Get(':videoId/comments')
  comments(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Param('videoId', { schema: idParam }) videoId: number,
    @Query('limit', { schema: commentsLimit }) limit: number,
  ) {
    return this.videos.comments(topicId, videoId, limit);
  }
}
