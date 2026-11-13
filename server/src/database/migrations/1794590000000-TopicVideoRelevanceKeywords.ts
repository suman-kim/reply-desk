import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RD-23: 영상 목록에 관련도 순위와 맞은 검색어를 둔다 (2026-11-14 사용자 승인).
 * - search_position: 유튜브 검색(관련도 순)에서 나온 순서. 대시보드에서 관련도·조회수·최신으로 바로 정렬한다
 * - matched_keywords: 주제 검색 키워드 중 영상 제목·설명·태그에 들어 있는 것 (코드가 대조, 할당량을 더 쓰지 않는다)
 * 이미 있는 영상은 다음 [영상 불러오기]에서 채워진다(그 전까지 순위 null · 검색어 빈 목록).
 */
export class TopicVideoRelevanceKeywords1794590000000 implements MigrationInterface {
  name = 'TopicVideoRelevanceKeywords1794590000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "topic_video" ADD "search_position" integer`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "topic_video"."search_position" IS '유튜브 검색(관련도 순)에서 나온 순서 (1부터). 새 영상만 검색했을 때는 기존 목록 뒤에 그 검색의 순서대로 붙는다. 직접 추가한 영상은 NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" ADD "matched_keywords" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "topic_video"."matched_keywords" IS '주제 검색 키워드 중 영상 제목·설명·태그에 들어 있는 것 (코드가 대조, 주제에 적은 순서)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "topic_video" IS '주제별 영상 목록(① 칸). 불러오기 순위·관련도 순위·맞은 검색어와 들어온 경로'`,
    );
  }

  /** @param queryRunner 마이그레이션 실행기 */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON TABLE "topic_video" IS '주제별 영상 목록(① 칸). 불러오기 순위와 들어온 경로'`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" DROP COLUMN "matched_keywords"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_video" DROP COLUMN "search_position"`,
    );
  }
}
