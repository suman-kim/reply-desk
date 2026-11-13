import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주제 칸 설명만 바꾼다 (구조는 그대로).
 * - brand_word: 등록 화면에서 받지 않게 되어 비어 있을 수 있다
 * - video_window_days: 0이면 기간 제한 없음 (무제한)
 */
export class TopicOptionalBrandUnlimitedWindow1794550000000 implements MigrationInterface {
  name = 'TopicOptionalBrandUnlimitedWindow1794550000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."brand_word" IS '브랜드 언급 자동 검사에 쓰는 단어 (예: 운명원). 비어 있으면 브랜드 언급 검사와 AI 지시를 건너뛴다'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."video_window_days" IS '최근 며칠 안에 올라온 영상만 불러올지 (일). 0이면 기간 제한 없음'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."brand_word" IS '브랜드 언급 자동 검사에 쓰는 단어 (예: 운명원)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."video_window_days" IS '최근 며칠 안에 올라온 영상만 불러올지 (일)'`,
    );
  }
}
