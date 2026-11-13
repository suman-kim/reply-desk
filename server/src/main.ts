import './config/zod-locale.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';

/** 서버를 띄운다 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // 모든 API는 /api 아래에 둔다 (대시보드 화면과 주소가 겹치지 않게)
  app.setGlobalPrefix('api');
  // @Body({ schema }) 등에 붙인 zod 스키마로 검증한다. 실패하면 400과 "필드: 원인" 목록
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // 같은 맥의 대시보드(개발 서버)에서 부를 수 있게 한다. 로컬 도구라 127.0.0.1에만 연다
  app.enableCors({ origin: [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/] });

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '127.0.0.1');
}
await bootstrap();
