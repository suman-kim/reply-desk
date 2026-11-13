import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * e2e 테스트 설정.
 * docker compose로 띄운 PostgreSQL의 테스트 DB(reply_desk_test)를 쓰고, 테스트마다 비우고 다시 만든다.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // 같은 DB를 쓰므로 파일을 하나씩 돌린다
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'reply_desk_test',
      PROFILES_ROOT: join(tmpdir(), 'reply-desk-e2e-profiles'),
      YOUTUBE_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
  },
});
