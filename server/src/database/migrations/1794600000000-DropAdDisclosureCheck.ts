import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RD-28: 광고 표시 검사를 없앤다 (2026-11-14 사용자 요청). 표 구조는 바꾸지 않고 저장된 값만 고친다.
 * - 이미 있는 초안의 검사 결과(check_results)에서 광고 표시 검사(code=ad_disclosure) 행을 뺀다
 * - 남은 검사가 모두 통과면 check_passed를 참으로 다시 맞춘다 (광고 표시만 걸렸던 초안이 '게시 대기'로 돌아온다)
 * 되돌릴 때는 지운 결과를 되살리지 않는다 (다음에 초안을 고치거나 다시 생성하면 다시 검사한다).
 */
export class DropAdDisclosureCheck1794600000000 implements MigrationInterface {
  name = 'DropAdDisclosureCheck1794600000000';

  /** @param queryRunner 마이그레이션 실행기 */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "draft" d
          SET "check_results" = kept.results,
              "check_passed" = NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(kept.results) r
                 WHERE (r->>'passed')::boolean IS NOT TRUE
              )
         FROM (
           SELECT id,
                  COALESCE(
                    (SELECT jsonb_agg(r ORDER BY n)
                       FROM jsonb_array_elements(check_results) WITH ORDINALITY AS e(r, n)
                      WHERE r->>'code' <> 'ad_disclosure'),
                    '[]'::jsonb
                  ) AS results
             FROM "draft"
            WHERE "check_results" @> '[{"code":"ad_disclosure"}]'::jsonb
         ) kept
        WHERE d.id = kept.id`,
    );
  }

  /** 지운 검사 결과는 되살리지 않는다 */
  public async down(): Promise<void> {}
}
