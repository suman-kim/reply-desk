import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** 디자인 시스템 원본 폴더. 복사하지 않고 그대로 불러와, 고칠 곳을 한 곳으로 둔다 */
const INYEON_DIR = fileURLToPath(new URL('../design/inyeon-design-system', import.meta.url));

/** reply-desk 서버 주소 (server/ 의 PORT) */
const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:4100';

/**
 * 대시보드 화면 설정.
 * - 개발 주소: http://127.0.0.1:5173 (이 맥에서만)
 * - /api 요청은 서버(4100)로 넘긴다. 실시간 이벤트(SSE)도 같은 길로 간다
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@inyeon': INYEON_DIR },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
    // 앱 폴더 밖(../design)의 디자인 시스템 파일을 읽을 수 있게 한다
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
