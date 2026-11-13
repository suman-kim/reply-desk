import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Draft } from '../drafts/draft.entity.js';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { PostingModule } from '../posting/posting.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { TopicsModule } from '../topics/topics.module.js';
import { VideosModule } from '../videos/videos.module.js';
import { PostGuardService } from './post-guard.service.js';
import { RulesController } from './rules.controller.js';

/** 운영 규칙(게시 차단·자동 배정) 모듈 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Draft, PostAttempt]),
    TopicsModule,
    VideosModule,
    ProfilesModule,
    PostingModule,
  ],
  controllers: [RulesController],
  providers: [PostGuardService],
  exports: [PostGuardService],
})
export class RulesModule {}
