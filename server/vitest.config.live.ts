import { defineConfig } from 'vitest/config';

/**
 * 실제 YouTube 게시 시험 설정 (test/live/). 사람이 손으로만 돌린다.
 * 실제 크롬을 다루고 한 글자씩 입력하므로 제한 시간을 넉넉히 둔다.
 * 돌리는 법은 test/live/post.live-spec.ts 맨 위 설명을 본다.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/live/**/*.live-spec.ts'],
    fileParallelism: false,
    testTimeout: 180_000,
    // 통과해도 단계별 시간·캡처 경로·댓글 주소 로그를 보이게 한다 (기본 출력은 통과한 시험의 로그를 숨긴다)
    reporters: ['verbose'],
  },
});
