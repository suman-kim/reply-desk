import type { Repository } from 'typeorm';
import { PostAttempt, PostStatus } from './post-attempt.entity.js';

/** 새 초안에 넘기는 '이미 단 댓글' 수 (최근 순) */
export const POSTED_COMMENTS_LIMIT = 5;

/**
 * 이 영상에 이미 단 댓글 글 (게시 성공 기록, 최근 순, 주제·계정 상관없이).
 * 같은 영상에 댓글을 더 달 때(RD-27) AI에게 겹치지 않게 쓰라고 넘기고, 같은 글은 자동 검사로 막는 데 쓴다.
 * @param attempts 게시 기록 저장소
 * @param videoId 내부 영상 ID
 * @param limit 가져올 수 (기본 5개)
 */
export async function postedCommentsOf(
  attempts: Repository<PostAttempt>,
  videoId: number,
  limit: number = POSTED_COMMENTS_LIMIT,
): Promise<string[]> {
  const rows = await attempts.find({
    select: { id: true, commentText: true },
    where: { videoId, status: PostStatus.Success },
    order: { startedAt: 'DESC', id: 'DESC' },
    take: limit,
  });
  return rows.map((r) => r.commentText);
}
