import { Module } from '@nestjs/common';
import { CheckRunnerService } from './check-runner.service.js';
import { DRAFT_CHECKS } from './check.types.js';
import { DEFAULT_CHECKS } from './draft-checks.js';

/** 초안 자동 검사 모듈. 검사 목록을 바꾸려면 DRAFT_CHECKS 값만 바꾸면 된다 */
@Module({
  providers: [
    { provide: DRAFT_CHECKS, useValue: DEFAULT_CHECKS },
    CheckRunnerService,
  ],
  exports: [CheckRunnerService],
})
export class ChecksModule {}
