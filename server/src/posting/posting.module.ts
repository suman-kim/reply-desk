import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module.js';
import { PostAttempt } from './post-attempt.entity.js';
import { PostLogService } from './post-log.service.js';
import { PostQuotaService } from './post-quota.service.js';
import { PostingController } from './posting.controller.js';

/** 게시 현황·기록 모듈 */
@Module({
  imports: [TypeOrmModule.forFeature([PostAttempt]), SettingsModule],
  controllers: [PostingController],
  providers: [PostQuotaService, PostLogService],
  exports: [PostQuotaService],
})
export class PostingModule {}
