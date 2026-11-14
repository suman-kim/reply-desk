import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RD-33: 초안에 '글 모양'을 남긴다 (2026-11-14 사용자 승인).
 * 코드가 초안마다 누가·말투·시작·브랜드 꺼내는 방식·자리·길이를 무작위로 고르고, 최근 조합은 피한다.
 * 최근 조합을 알고 화면에 보이려고 저장한다. 이 기능 전 초안은 빈 값({}).
 */
export class DraftStyle1794630000000 implements MigrationInterface {
  name = 'DraftStyle1794630000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "draft" ADD "style" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "draft"."style" IS '이 초안을 쓸 때 코드가 고른 글 모양(누가·말투·시작·브랜드 꺼내는 방식·자리·길이와 화면용 요약). 최근 조합을 피하는 데 쓴다. 이 기능 전 초안은 빈 값'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "draft" DROP COLUMN "style"`);
  }
}
