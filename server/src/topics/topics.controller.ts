import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { idParam } from '../common/id-param.js';
import {
  createTopicSchema,
  updateTopicSchema,
  type CreateTopicDto,
  type UpdateTopicDto,
} from './topic.schemas.js';
import { TopicsService } from './topics.service.js';

/**
 * 주제(홍보 대상) API.
 * - GET    /api/topics       목록 (오늘 게시 n/상한, 초안 대기 수, 상태, 쓸 프로필)
 * - POST   /api/topics       만들기
 * - GET    /api/topics/:id   하나
 * - PATCH  /api/topics/:id   고치기 (보낸 값만, profileIds를 보내면 통째로 바꿈)
 * - DELETE /api/topics/:id   지우기
 */
@Controller('topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  /** 목록 */
  @Get()
  list() {
    return this.topics.list();
  }

  /**
   * 만들기
   * @param dto 주제 설정
   */
  @Post()
  create(@Body({ schema: createTopicSchema }) dto: CreateTopicDto) {
    return this.topics.create(dto);
  }

  /**
   * 하나
   * @param id 주제 ID
   */
  @Get(':id')
  get(@Param('id', { schema: idParam }) id: number) {
    return this.topics.get(id);
  }

  /**
   * 고치기
   * @param id 주제 ID
   * @param dto 바꿀 값
   */
  @Patch(':id')
  update(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: updateTopicSchema }) dto: UpdateTopicDto,
  ) {
    return this.topics.update(id, dto);
  }

  /**
   * 지우기
   * @param id 주제 ID
   */
  @Delete(':id')
  remove(@Param('id', { schema: idParam }) id: number) {
    return this.topics.remove(id);
  }
}
