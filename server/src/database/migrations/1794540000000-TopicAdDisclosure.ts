import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주제에 광고 표시를 더한다. 다른 채널 영상에도 게시할 수 있게 하면서,
 * 그 댓글 맨 앞에 붙일 표시(예: [광고])를 주제마다 정한다.
 */
export class TopicAdDisclosure1794540000000 implements MigrationInterface {
  name = 'TopicAdDisclosure1794540000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "topic" ADD "ad_disclosure" character varying(20) NOT NULL DEFAULT '[광고]'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."ad_disclosure" IS '다른 채널 영상 댓글 맨 앞에 붙이는 광고 표시 (예: [광고]). 내 채널 영상에는 붙이지 않는다'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "topic" DROP COLUMN "ad_disclosure"`);
  }
}
