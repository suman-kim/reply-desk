import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { TopicProfile } from '../topics/topic-profile.entity.js';
import { Profile } from './profile.entity.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

/** 크롬 프로필(계정 관리) 모듈 */
@Module({
  imports: [TypeOrmModule.forFeature([Profile, TopicProfile, PostAttempt])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
