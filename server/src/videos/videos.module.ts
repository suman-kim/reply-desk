import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { TopicsModule } from '../topics/topics.module.js';
import { TopicVideo } from './topic-video.entity.js';
import { Video } from './video.entity.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';
import { YoutubeApiClient } from './youtube/youtube-api.client.js';
import { YOUTUBE_CLIENT } from './youtube/youtube-client.js';

/** 영상 불러오기 모듈. YOUTUBE_CLIENT를 바꾸면 다른 구현(테스트용 가짜 등)을 쓸 수 있다 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Video, TopicVideo, PostAttempt]),
    TopicsModule,
    ProfilesModule,
  ],
  controllers: [VideosController],
  providers: [
    VideosService,
    { provide: YOUTUBE_CLIENT, useClass: YoutubeApiClient },
  ],
  exports: [VideosService, YOUTUBE_CLIENT],
})
export class VideosModule {}
