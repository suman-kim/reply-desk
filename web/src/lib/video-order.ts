import type { VideoItem } from '../api/types';
import { isReadyToPost } from '../components/badges';

/** 영상 목록 한 쪽에 보이는 수 (계획안: 30개씩) */
export const PAGE_SIZE = 30;

/** 정렬: 관련도(유튜브 검색 순위, RD-23) · 조회수 · 최신 */
export type VideoSort = 'rel' | 'views' | 'new';

/**
 * 정렬한 새 목록 (원본은 그대로)
 * - 관련도: 검색 관련도 순위, 순위가 없는 영상(링크로 추가)은 뒤에
 * - 조회수: 많은 순 · 최신: 올린 시각 최근 순 (같으면 최신 순)
 * @param list 영상
 * @param sort 정렬
 */
export function sortVideos(list: VideoItem[], sort: VideoSort): VideoItem[] {
  const big = Number.MAX_SAFE_INTEGER;
  const byNew = (a: VideoItem, b: VideoItem) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  return [...list].sort((a, b) => {
    if (sort === 'rel') return (a.searchPosition ?? big) - (b.searchPosition ?? big) || byNew(a, b);
    if (sort === 'views') return b.viewCount - a.viewCount || byNew(a, b);
    return byNew(a, b);
  });
}

/**
 * 작업 상세의 앞뒤 게시 대기 영상 (관련도 순서).
 * 지금 영상이 게시 대기가 아니어도(방금 게시함) 목록 속 그 자리에서 앞뒤를 찾는다.
 * @param list 이 주제 영상
 * @param currentId 지금 영상
 */
export function readyNeighbors(list: VideoItem[], currentId: number) {
  const sorted = sortVideos(list, 'rel');
  const others = (v: VideoItem) => isReadyToPost(v) && v.id !== currentId;
  const pos = sorted.findIndex((v) => v.id === currentId);
  const after = pos >= 0 ? sorted.slice(pos + 1).find(others) : undefined;
  const before = pos >= 0 ? sorted.slice(0, pos).reverse().find(others) : undefined;
  const ready = sorted.filter(isReadyToPost);
  const index = ready.findIndex((v) => v.id === currentId);
  return {
    /** 다음 (뒤에 없으면 처음부터 남은 첫 영상) */
    next: after ?? sorted.find(others) ?? null,
    /** 이전 */
    prev: before ?? null,
    /** 게시 대기에서 몇 번째 (1부터, 지금 영상이 게시 대기가 아니면 null) */
    index: index >= 0 ? index + 1 : null,
    /** 게시 대기 수 */
    total: ready.length,
  };
}
