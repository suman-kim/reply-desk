import { Inject, Injectable } from '@nestjs/common';
import {
  DRAFT_CHECKS,
  type CheckContext,
  type CheckResult,
  type DraftCheck,
} from './check.types.js';

/** 검사 전체 결과 */
export interface CheckReport {
  /** 검사마다 결과 */
  results: CheckResult[];
  /** 모두 통과했는지 */
  passed: boolean;
}

/**
 * 등록된 검사를 순서대로 모두 돌린다.
 * 초안을 AI가 새로 쓰거나 사람이 고칠 때마다 부른다.
 */
@Injectable()
export class CheckRunnerService {
  /**
   * @param checks 등록된 검사 목록 (checks.module.ts에서 넣는다)
   */
  constructor(@Inject(DRAFT_CHECKS) private readonly checks: DraftCheck[]) {}

  /**
   * 글 하나를 검사한다.
   * @param ctx 검사할 글과 주제·분석 값
   */
  run(ctx: CheckContext): CheckReport {
    const results = this.checks
      .filter((c) => c.appliesTo(ctx))
      .map((c) => c.run(ctx));
    return { results, passed: results.every((r) => r.passed) };
  }
}
