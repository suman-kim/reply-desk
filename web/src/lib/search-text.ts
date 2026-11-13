import type { SearchRun, SearchStatus } from '../api/types';
import { relativeTime } from './format';

/** 검색 한 쪽(50개)이 쓰는 유튜브 할당량 (서버 SEARCH_PAGE_QUOTA와 같다) */
const SEARCH_PAGE_QUOTA = 100;

/**
 * [영상 불러오기]를 누르기 전 안내 한 줄 (① 버튼 아래): 지금 누르면 검색을 하는지, 할당량이 얼마쯤 드는지
 * @param status 검색 상태 (서버)
 * @param now 기준 시각 (테스트용)
 */
export function searchStatusText(status: SearchStatus, now: Date = new Date()): string {
  const last = status.lastSearchedAt ? `마지막 검색 ${relativeTime(status.lastSearchedAt, now)}` : null;
  if (status.nextMode === 'cached' && status.nextSearchAt) {
    const left = Math.max(1, Math.ceil((new Date(status.nextSearchAt).getTime() - now.getTime()) / 60000));
    return `${last} · ${left}분 동안은 다시 눌러도 검색하지 않고 저장된 목록을 보여 줘요(할당량 0)`;
  }
  if (status.nextMode === 'incremental') {
    return `${last} · 누르면 그 뒤 올라온 영상만 찾아요(할당량 약 ${SEARCH_PAGE_QUOTA}부터)`;
  }
  return last
    ? `주제 설정이 바뀌어 기간 전체를 다시 찾아요(할당량 검색 한 쪽에 ${SEARCH_PAGE_QUOTA})`
    : `처음 검색이에요 · 기간 전체를 찾아요(할당량 검색 한 쪽에 ${SEARCH_PAGE_QUOTA})`;
}

/**
 * [영상 불러오기] 결과 안내 한 줄 (① 결과 띠): 검색 방식, 새 영상 수, 쓴 할당량
 * @param run 이번 검색 정보 (서버)
 */
export function searchRunText(run: SearchRun): string {
  if (run.mode === 'cached') return '최근에 검색해서 저장된 목록을 보여 드려요 · 할당량 0';
  const how = run.mode === 'incremental' ? '지난 검색 뒤 올라온 영상만 찾았어요' : '기간 전체를 검색했어요';
  const added = run.newVideos > 0 ? `새 영상 ${run.newVideos}개` : '새 영상 없음';
  return `${how} · ${added} · 할당량 ${run.quotaUsed.toLocaleString('ko-KR')} 사용`;
}
