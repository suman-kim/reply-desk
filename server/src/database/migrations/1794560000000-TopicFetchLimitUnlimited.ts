import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주제의 fetch_limit 설명만 바꾼다 (구조는 그대로).
 * [영상 불러오기]가 초안을 쓰지 않게 되었고, 0이면 무제한(검색 결과 끝까지, 최대 500개)이다.
 */
export class TopicFetchLimitUnlimited1794560000000 implements MigrationInterface {
  name = 'TopicFetchLimitUnlimited1794560000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."fetch_limit" IS '[영상 불러오기] 한 번에 가져올 영상 수. 0이면 무제한(검색 결과 끝까지, 최대 500개)'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "topic"."fetch_limit" IS '[영상 불러오기] 한 번에 가져와 초안까지 쓸 영상 수'`,
    );
  }
}
