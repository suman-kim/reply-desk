import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { kstDayRange } from '../common/kst.js';
import { DAILY_CAP_TOTAL } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { PostAttempt, PostStatus } from './post-attempt.entity.js';

/** 오늘 게시 현황 (헤더의 "오늘 게시 n/10") */
export interface TodayQuota {
  /** 오늘 전체 게시 수 */
  posted: number;
  /** 전체 하루 상한 */
  cap: number;
  /** 주제별 오늘 게시 수 (주제 ID → 수) */
  byTopic: Record<number, number>;
}

/**
 * 하루 게시 수 세기. 한국 시간 0시에 다시 센다.
 * 게시 성공(status=success)만 센다. 실패한 시도는 상한을 쓰지 않는다.
 */
@Injectable()
export class PostQuotaService {
  /**
   * @param attempts 게시 기록 저장소
   * @param settings 공용 설정 (전체 하루 상한)
   */
  constructor(
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    private readonly settings: SettingsService,
  ) {}

  /**
   * 오늘 게시 현황
   * @param now 기준 시각 (테스트용)
   */
  async today(now: Date = new Date()): Promise<TodayQuota> {
    const { start, end } = kstDayRange(now);
    const rows: { topicId: number | null; n: string }[] = await this.attempts
      .createQueryBuilder('a')
      .select('a.topic_id', 'topicId')
      .addSelect('COUNT(*)', 'n')
      .where('a.status = :s', { s: PostStatus.Success })
      .andWhere('a.started_at >= :start AND a.started_at < :end', {
        start,
        end,
      })
      .groupBy('a.topic_id')
      .getRawMany();

    const byTopic: Record<number, number> = {};
    let posted = 0;
    for (const r of rows) {
      const n = Number(r.n);
      posted += n;
      if (r.topicId !== null) byTopic[Number(r.topicId)] = n;
    }
    return { posted, cap: await this.settings.get(DAILY_CAP_TOTAL), byTopic };
  }
}
