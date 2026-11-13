import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostAttempt } from './post-attempt.entity.js';

/** 게시 기록 표의 한 행 */
export interface PostLogRow {
  /** 게시 시도 ID */
  id: number;
  /** 시작 시각 */
  startedAt: Date;
  /** 끝난 시각 */
  finishedAt: Date | null;
  /** 영상 (제목·유튜브 ID) */
  video: { id: number; youtubeId: string; title: string } | null;
  /** 주제 */
  topic: { id: number; name: string } | null;
  /** 프로필 이름 (지운 프로필이면 null) */
  profileName: string | null;
  /** 게시한 댓글 */
  commentText: string;
  /** 결과 */
  status: PostAttempt['status'];
  /** 실패한 단계 */
  failedStep: PostAttempt['failedStep'];
  /** 실패 원인 */
  failureReason: string | null;
  /** 캡처가 있는지 ([캡처 보기]) */
  hasScreenshot: boolean;
  /** 댓글 주소 ([댓글 보기]) */
  commentUrl: string | null;
}

/** 게시 기록 조회 (주제별 보기·전체 보기). 최근 항목이 위에 온다 */
@Injectable()
export class PostLogService {
  /**
   * @param attempts 게시 기록 저장소
   */
  constructor(
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
  ) {}

  /**
   * 게시 기록 목록
   * @param filter.topicId 주제 ID (없으면 전체 보기)
   * @param filter.limit 가져올 행 수
   */
  async list(filter: {
    topicId?: number;
    limit: number;
  }): Promise<PostLogRow[]> {
    const rows = await this.attempts.find({
      where: filter.topicId ? { topicId: filter.topicId } : {},
      relations: { video: true, topic: true, profile: true },
      order: { startedAt: 'DESC', id: 'DESC' },
      take: filter.limit,
    });
    return rows.map((a) => ({
      id: a.id,
      startedAt: a.startedAt,
      finishedAt: a.finishedAt,
      video: a.video
        ? { id: a.video.id, youtubeId: a.video.youtubeId, title: a.video.title }
        : null,
      topic: a.topic ? { id: a.topic.id, name: a.topic.name } : null,
      profileName: a.profile?.name ?? null,
      commentText: a.commentText,
      status: a.status,
      failedStep: a.failedStep,
      failureReason: a.failureReason,
      hasScreenshot: !!a.screenshotPath,
      commentUrl: a.commentUrl,
    }));
  }
}
