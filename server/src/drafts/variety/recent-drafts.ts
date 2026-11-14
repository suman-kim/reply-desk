import { Not, type Repository } from 'typeorm';
import { Draft, DraftState } from '../draft.entity.js';
import type { DraftStyle } from './draft-style.js';

/** 말버릇·글 모양을 비교할 최근 초안 수 */
export const RECENT_DRAFTS_LIMIT = 10;

/** 최근 초안 하나 (비교에 쓰는 값만) */
export interface RecentDraft {
  /** 지금 글 (사람이 고쳤으면 고친 글) */
  text: string;
  /** 그때 고른 글 모양 (이 기능 전 초안은 빈 값) */
  style: Partial<DraftStyle>;
}

/**
 * 같은 주제의 최근 다 쓴 초안 (최근 순). 새 초안의 글 모양을 고르고 말버릇을 찾는 데 쓴다 (RD-33).
 * @param drafts 초안 저장소
 * @param topicId 주제 ID
 * @param excludeDraftId 빼고 볼 초안 (지금 쓰거나 고치는 초안)
 * @param limit 가져올 수 (기본 10개)
 */
export async function recentDraftsOf(
  drafts: Repository<Draft>,
  topicId: number,
  excludeDraftId: number,
  limit: number = RECENT_DRAFTS_LIMIT,
): Promise<RecentDraft[]> {
  const rows = await drafts.find({
    select: { id: true, text: true, style: true },
    where: { topicId, state: DraftState.Ready, id: Not(excludeDraftId) },
    order: { createdAt: 'DESC', id: 'DESC' },
    take: limit,
  });
  return rows.map((r) => ({ text: r.text, style: r.style ?? {} }));
}
