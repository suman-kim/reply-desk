import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module.js';
import { ChecksModule } from '../checks/checks.module.js';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { Topic } from '../topics/topic.entity.js';
import { TopicsModule } from '../topics/topics.module.js';
import { Video } from '../videos/video.entity.js';
import { VideosModule } from '../videos/videos.module.js';
import { AnalysisService } from './analysis.service.js';
import { DraftQueueService } from './draft-queue.service.js';
import { Draft } from './draft.entity.js';
import { DraftingService } from './drafting.service.js';
import { DraftsController } from './drafts.controller.js';
import { DraftsService } from './drafts.service.js';
import { VideoAnalysis } from './video-analysis.entity.js';

/** 영상 분석·초안 작성 모듈 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Draft, VideoAnalysis, PostAttempt, Topic, Video]),
    AiModule,
    ChecksModule,
    TopicsModule,
    VideosModule,
    ProfilesModule,
  ],
  controllers: [DraftsController],
  providers: [
    AnalysisService,
    DraftingService,
    DraftQueueService,
    DraftsService,
  ],
  exports: [DraftsService, DraftQueueService],
})
export class DraftsModule {}
