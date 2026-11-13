import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { envSchema } from '../config/env.schema.js';
import { buildDataSourceOptions } from './typeorm-options.js';

/**
 * TypeORM CLI 전용 DataSource (마이그레이션 생성·실행).
 * 빌드한 뒤 dist의 이 파일을 -d 옵션으로 넘긴다. package.json의 migration:* 스크립트 참고.
 * .env는 node의 --env-file-if-exists 옵션으로 읽는다.
 */
export default new DataSource(
  buildDataSourceOptions(envSchema.parse(process.env)),
);
