import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/id-param.js';
import { VideosService } from './videos.service.js';

/** 링크 직접 추가 요청 */
const addVideoSchema = z.object({
  /** 유튜브 링크나 영상 ID */
  url: z.string().trim().min(1, '유튜브 링크를 넣어 주세요').max(500),
});

/**
 * 주제별 영상 API (① 칸, ②의 링크 직접 입력).
 * - GET  /api/topics/:topicId/videos           영상 목록 (배지 포함)
 * - POST /api/topics/:topicId/videos/fetch     [영상 불러오기] (YouTube 검색 → 정렬 → 저장)
 * - POST /api/topics/:topicId/videos           링크 직접 추가 { url }
 * - GET  /api/topics/:topicId/videos/:videoId  영상 하나
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
}
