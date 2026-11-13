import { createReadStream } from 'node:fs';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { z } from 'zod';
import { idParam } from '../common/id-param.js';
import { PublishService } from './publish.service.js';

/** [댓글 달기] 요청 */
const postSchema = z.object({
  /** 고른 프로필 ID. 없으면 자동 배정 */
  profileId: z.number().int().positive().optional(),
});

/**
 * 댓글 게시 API (③ 칸).
 * - POST /api/topics/:topicId/videos/:videoId/post   [댓글 달기] { profileId? } → 막히면 409 { code, message }
 * - GET  /api/posting/attempts/:id                   진행 5단계·입력 글자 수·결과
 * - GET  /api/posting/attempts/:id/preview           크롬 화면 미리보기 (jpeg, 게시 중·최근)
 * - GET  /api/posting/attempts/:id/capture           게시 결과 캡처 (png, 성공: 게시된 댓글 화면, 실패: 실패 순간)
 */
@Controller()
export class PublishController {
  constructor(private readonly publish: PublishService) {}

  /**
   * [댓글 달기]
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   * @param body { profileId? }
   */
  @Post('topics/:topicId/videos/:videoId/post')
  start(
    @Param('topicId', { schema: idParam }) topicId: number,
    @Param('videoId', { schema: idParam }) videoId: number,
    @Body({ schema: postSchema }) body: z.infer<typeof postSchema>,
  ) {
    return this.publish.start(topicId, videoId, body.profileId ?? null);
  }

  /**
   * 게시 상태
   * @param id 게시 시도 ID
   */
  @Get('posting/attempts/:id')
  status(@Param('id', { schema: idParam }) id: number) {
    return this.publish.status(id);
  }

  /**
   * 크롬 화면 미리보기
   * @param id 게시 시도 ID
   */
  @Get('posting/attempts/:id/preview')
  @Header('Cache-Control', 'no-store')
  preview(@Param('id', { schema: idParam }) id: number) {
    const image = this.publish.preview(id);
    const isPng = image[0] === 0x89;
    return new StreamableFile(image, {
      type: isPng ? 'image/png' : 'image/jpeg',
    });
  }

  /**
   * 게시 결과 캡처 (성공·실패)
   * @param id 게시 시도 ID
   */
  @Get('posting/attempts/:id/capture')
  async capture(@Param('id', { schema: idParam }) id: number) {
    const path = await this.publish.capturePath(id);
    return new StreamableFile(createReadStream(path), { type: 'image/png' });
  }
}
