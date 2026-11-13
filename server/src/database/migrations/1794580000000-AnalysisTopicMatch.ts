import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 영상 분석: '고민 한 줄'(worry)을 지우고 '주제와 매칭'(퍼센트·이유)을 넣는다 (2026-11-13 사용자 확인).
 * 이미 저장된 고민 값은 함께 사라지고, 이미 한 분석은 매칭 값이 null('매칭 확인 전')이다.
 * 되돌리면 worry 칸은 빈 글자로 다시 생긴다(지운 값은 돌아오지 않는다).
 */
export class AnalysisTopicMatch1794580000000 implements MigrationInterface {
  name = 'AnalysisTopicMatch1794580000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "video_analysis" DROP COLUMN "worry"`);
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ADD "topic_match" smallint`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "video_analysis"."topic_match" IS '이 영상이 주제(홍보 대상·관심 키워드)와 얼마나 맞는지 0~100 (AI 판단). 이 기능 전에 한 분석은 null'`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ADD "topic_match_reason" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "video_analysis"."topic_match_reason" IS '주제 매칭 퍼센트를 그렇게 매긴 이유 한 줄 (AI)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "video_analysis" IS 'AI 영상 분석 결과: 주제와 매칭(%)·이유, 고른 이유, 근거 장면'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON TABLE "video_analysis" IS 'AI 영상 분석 결과: 고민 한 줄, 고른 이유, 근거 장면'`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" DROP COLUMN "topic_match_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" DROP COLUMN "topic_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ADD "worry" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "video_analysis" ALTER COLUMN "worry" DROP DEFAULT`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "video_analysis"."worry" IS '영상 속 고민 한 줄 (금색 상자)'`,
    );
  }
}
