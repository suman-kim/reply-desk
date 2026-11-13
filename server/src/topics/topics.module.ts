import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostingModule } from '../posting/posting.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { TopicProfile } from './topic-profile.entity.js';
import { Topic } from './topic.entity.js';
import { TopicsController } from './topics.controller.js';
import { TopicsService } from './topics.service.js';

/** 주제(홍보 대상) 모듈 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Topic, TopicProfile]),
    ProfilesModule,
    PostingModule,
    SettingsModule,
  ],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
