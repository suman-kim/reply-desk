import { Module } from '@nestjs/common';
import { PlaywrightYoutubeBrowser } from './playwright-youtube.browser.js';
import { ProfileLockService } from './profile-lock.service.js';
import { YOUTUBE_BROWSER } from './youtube-browser.js';

/** 크롬 조작 모듈. YOUTUBE_BROWSER를 바꾸면 테스트용 가짜 브라우저를 쓸 수 있다 */
@Module({
  providers: [
    { provide: YOUTUBE_BROWSER, useClass: PlaywrightYoutubeBrowser },
    ProfileLockService,
  ],
  exports: [YOUTUBE_BROWSER, ProfileLockService],
})
export class BrowserModule {}
