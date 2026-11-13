import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrowserModule } from '../browser/browser.module.js';
import { Draft } from '../drafts/draft.entity.js';
import { PostAttempt } from '../posting/post-attempt.entity.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { VideosModule } from '../videos/videos.module.js';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';

/** 댓글 게시(Playwright 5단계) 모듈. 게시 현황·기록 조회는 posting 모듈에 있다 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PostAttempt, Draft]),
    BrowserModule,
    RulesModule,
    VideosModule,
    ProfilesModule,
    SettingsModule,
  ],
  controllers: [PublishController],
  providers: [PublishService],
  exports: [PublishService],
})
export class PublishModule {}
