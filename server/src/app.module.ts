import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module.js';
import { ChecksModule } from './checks/checks.module.js';
import { envSchema, type Env } from './config/env.schema.js';
import { buildDataSourceOptions } from './database/typeorm-options.js';
import { DraftsModule } from './drafts/drafts.module.js';
import { HealthController } from './health.controller.js';
import { PostingModule } from './posting/posting.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { RulesModule } from './rules/rules.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { TopicsModule } from './topics/topics.module.js';
import { VideosModule } from './videos/videos.module.js';

/**
 * 앱 루트 모듈.
 * 다음 작업에서 붙일 모듈: posting의 Playwright 게시, events(SSE).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // NODE_ENV에 맞는 파일을 먼저 읽고(.env.development, .env.production), 없으면 .env를 읽는다.
      // 앞 파일의 값이 이기고, 셸에 이미 있는 환경 변수가 가장 먼저다.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      // 검증·변환한 값만 ConfigService로 내보낸다 (~ 경로 펼치기, 숫자 변환 등)
      validate: (raw) => envSchema.parse(raw),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...buildDataSourceOptions({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USER: config.get('DB_USER', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
        }),
        // 서버가 뜰 때 밀린 마이그레이션을 적용한다 (로컬 도구라 따로 배포 단계가 없다)
        migrationsRun: true,
      }),
    }),
    SettingsModule,
    ChecksModule,
    ProfilesModule,
    PostingModule,
    TopicsModule,
    VideosModule,
    RulesModule,
    AiModule,
    DraftsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
