import type { SearchRun, SearchStatus } from '../api/types';
import { searchRunText, searchStatusText } from './search-text';

const now = new Date('2026-11-13T12:00:00Z');
const status = (over: Partial<SearchStatus>): SearchStatus => ({
  nextMode: 'cached',
  lastSearchedAt: '2026-11-13T11:50:00Z',
  nextSearchAt: '2026-11-13T12:50:00Z',
  cacheMinutes: 60,
  ...over,
});

describe('[영상 불러오기] 누르기 전 안내', () => {
  it('저장된 목록: 마지막 검색과 남은 시간, 할당량 0', () => {
    expect(searchStatusText(status({}), now)).toBe(
      '마지막 검색 10분 전 · 50분 동안은 다시 눌러도 검색하지 않고 저장된 목록을 보여 줘요(할당량 0)',
    );
  });

  it('새 영상만: 지난 검색 뒤 올라온 영상만 찾는다', () => {
    expect(searchStatusText(status({ nextMode: 'incremental', lastSearchedAt: '2026-11-13T09:00:00Z', nextSearchAt: null }), now)).toBe(
      '마지막 검색 3시간 전 · 누르면 그 뒤 올라온 영상만 찾아요(할당량 약 100부터)',
    );
  });

  it('전체: 처음이거나 주제 설정이 바뀌었을 때', () => {
    expect(searchStatusText(status({ nextMode: 'full', lastSearchedAt: null, nextSearchAt: null }), now)).toBe(
      '처음 검색이에요 · 기간 전체를 찾아요(할당량 검색 한 쪽에 100)',
    );
    expect(searchStatusText(status({ nextMode: 'full', nextSearchAt: null }), now)).toBe(
      '주제 설정이 바뀌어 기간 전체를 다시 찾아요(할당량 검색 한 쪽에 100)',
    );
  });
});

describe('[영상 불러오기] 결과 안내', () => {
  const run = (over: Partial<SearchRun>): SearchRun => ({
    mode: 'incremental',
    lastSearchedAt: '2026-11-13T12:00:00Z',
    nextSearchAt: '2026-11-13T13:00:00Z',
    quotaUsed: 101,
    newVideos: 3,
    ...over,
  });

  it('검색 방식, 새 영상 수, 쓴 할당량', () => {
    expect(searchRunText(run({}))).toBe('지난 검색 뒤 올라온 영상만 찾았어요 · 새 영상 3개 · 할당량 101 사용');
    expect(searchRunText(run({ mode: 'full', newVideos: 0 }))).toBe('기간 전체를 검색했어요 · 새 영상 없음 · 할당량 101 사용');
    expect(searchRunText(run({ mode: 'cached', quotaUsed: 0, newVideos: 0 }))).toBe(
      '최근에 검색해서 저장된 목록을 보여 드려요 · 할당량 0',
    );
  });
});
