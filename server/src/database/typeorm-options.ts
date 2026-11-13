import type { DataSourceOptions } from 'typeorm';
import type { Env } from '../config/env.schema.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations.js';

/**
 * 앱·TypeORM CLI·e2e 테스트가 함께 쓰는 DB 접속 옵션.
 * - synchronize는 끄고, 스키마는 마이그레이션으로만 바꾼다.
 *
 * @param env 검증을 통과한 환경 변수 중 DB 접속 값
 */
export function buildDataSourceOptions(
  env: Pick<Env, 'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
  };
}
