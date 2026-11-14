import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RD-27: 같은 영상에 댓글을 더 달 수 있게 한다 (2026-11-14 사용자 승인, 방법 A: 초안 하나에 댓글 하나).
 * - 영상마다 성공 1개(uq_post_attempt_video_success)를 지우고, 초안마다 성공 1개(uq_post_attempt_draft_success)로 바꾼다
 *   (같은 초안을 두 번 게시하지 않게. 새 댓글은 새 초안으로 단다)
 * - 같은 영상 동시 게시 막기(uq_post_attempt_video_running)는 그대로 둔다
 * - 컬럼은 바꾸지 않는다. 지금까지는 영상마다 성공이 하나뿐이라 초안마다 하나도 그대로 맞는다
 */
export class PostAttemptSuccessPerDraft1794610000000 implements MigrationInterface {
  name = 'PostAttemptSuccessPerDraft1794610000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_post_attempt_video_success"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_post_attempt_draft_success" ON "post_attempt" ("draft_id") WHERE "status" = 'success'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "post_attempt" IS '게시 시도 기록(게시 기록 표). 초안당 성공 1개·같은 영상 동시 게시 막기·하루 상한을 이 표로 판단'`,
    );
  }

  /**
   * 되돌리기. 같은 영상에 성공이 두 번 이상 있으면 영상당 1개 인덱스를 만들 수 없어 실패한다
   * (그때는 그 기록을 먼저 정리해야 한다).
   * @param queryRunner 마이그레이션 실행기
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON TABLE "post_attempt" IS '게시 시도 기록(게시 기록 표). 영상당 1개·하루 상한을 이 표로 판단'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_post_attempt_draft_success"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_post_attempt_video_success" ON "post_attempt" ("video_id") WHERE "status" = 'success'`,
    );
  }
}
