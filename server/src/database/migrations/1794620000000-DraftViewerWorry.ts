import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RD-32: 초안에 '시청자 고민 한 줄'을 더한다 (2026-11-14 사용자 승인).
 * AI가 시청자 입장의 고민을 한 줄로 꾸민 뒤, 그 사람이 쓴 것처럼 댓글을 쓴다 (과제 문서 ② 요구사항).
 * 영상에서 뽑는 사실이 아니라 초안마다 새로 꾸미는 값이라 video_analysis가 아니라 draft에 둔다.
 * 이 기능 전에 쓴 초안은 빈 글이고, [다시 생성]하면 생긴다.
 */
export class DraftViewerWorry1794620000000 implements MigrationInterface {
  name = 'DraftViewerWorry1794620000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "draft" ADD "worry" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "draft"."worry" IS '시청자 고민 한 줄. AI가 꾸민 시청자 한 사람의 고민(1인칭 한 문장). 영상과 이어지면 영상에 맞게, 아니어도 주제에 맞게 지어낸다. 이 기능 전 초안은 빈 글'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "draft" DROP COLUMN "worry"`);
  }
}
