import {
  conditionsKey,
  INCREMENTAL_OVERLAP_MS,
  planSearch,
} from './search-plan.js';

const at = (iso: string) => new Date(iso);
const base = {
  now: at('2026-11-13T12:00:00Z'),
  lastSearchedAt: at('2026-11-13T11:30:00Z'),
  conditionsChanged: false,
  windowStart: at('2026-11-12T12:00:00Z'),
  cacheMinutes: 60,
  force: false,
};

describe('[영상 불러오기] 검색 방식 정하기', () => {
  it('처음이면 기간 전체를 검색한다', () => {
    expect(planSearch({ ...base, lastSearchedAt: null })).toEqual({
      mode: 'full',
      publishedAfter: base.windowStart,
    });
  });

  it('지난 검색 뒤 검색 조건(키워드 등)을 바꿨으면 기간 전체를 다시 검색한다', () => {
    expect(planSearch({ ...base, conditionsChanged: true })).toEqual({
      mode: 'full',
      publishedAfter: base.windowStart,
    });
  });

  it('기준 시간(60분) 안이면 검색하지 않고 저장된 목록을 쓴다', () => {
    expect(planSearch(base)).toEqual({
      mode: 'cached',
      publishedAfter: null,
      nextSearchAt: at('2026-11-13T12:30:00Z'),
    });
  });

  it('기준 시간이 지났거나 [새로 검색]이면 지난 검색 뒤(2시간 겹쳐서) 올라온 영상만 검색한다', () => {
    const expected = {
      mode: 'incremental',
      publishedAfter: new Date(
        base.lastSearchedAt.getTime() - INCREMENTAL_OVERLAP_MS,
      ),
    };
    expect(planSearch({ ...base, force: true })).toEqual(expected);
    expect(planSearch({ ...base, now: at('2026-11-13T13:00:00Z') })).toEqual(
      expected,
    );
  });

  it('겹친 시작이 기간보다 앞이면 기간 시작부터, 기간 제한이 없으면 겹친 시작부터', () => {
    const lastLongAgo = {
      ...base,
      force: true,
      lastSearchedAt: at('2026-11-12T13:00:00Z'),
    };
    expect(planSearch(lastLongAgo).publishedAfter).toEqual(base.windowStart);
    expect(
      planSearch({ ...lastLongAgo, windowStart: null }).publishedAfter,
    ).toEqual(at('2026-11-12T11:00:00Z'));
  });

  it('기준 시간이 0이면 매번 검색한다', () => {
    expect(planSearch({ ...base, cacheMinutes: 0 }).mode).toBe('incremental');
  });
});

describe('검색 조건 비교', () => {
  const c = {
    keywords: ['연애', '썸'],
    videoWindowDays: 1,
    videoSortBy: 'view_count',
    fetchLimit: 0,
  };
  it('키워드 순서는 상관없고, 키워드·기간·정렬·불러올 수가 바뀌면 다르다', () => {
    expect(conditionsKey({ ...c, keywords: ['썸', '연애'] })).toBe(
      conditionsKey(c),
    );
    expect(conditionsKey({ ...c, keywords: ['연애'] })).not.toBe(
      conditionsKey(c),
    );
    expect(conditionsKey({ ...c, videoWindowDays: 7 })).not.toBe(
      conditionsKey(c),
    );
    expect(conditionsKey({ ...c, fetchLimit: 10 })).not.toBe(conditionsKey(c));
  });
});
