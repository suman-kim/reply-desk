import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 게시 기록의 screenshot_path 설명만 바꾼다 (구조는 그대로).
 * 실패 순간뿐 아니라, 게시에 성공하면 내 댓글이 보이는 화면도 이 칸에 남긴다 (댓글 게시 목록의 캡처).
 */
export class PostAttemptSuccessCapture1794570000000 implements MigrationInterface {
  name = 'PostAttemptSuccessCapture1794570000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "post_attempt"."screenshot_path" IS '게시 결과 화면 캡처 파일 경로 (성공: 게시된 내 댓글이 보이는 화면, 실패: 실패 순간)'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "post_attempt"."screenshot_path" IS '실패 순간 화면 캡처 파일 경로'`,
    );
  }
}
