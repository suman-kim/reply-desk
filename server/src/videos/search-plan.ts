/**
 * [영상 불러오기]의 유튜브 검색 방식 정하기 (할당량 줄이기).
 * 검색(search.list)은 한 쪽에 할당량 100으로 비싸고, 영상 정보(videos.list)는 50개에 1로 싸다.
 * - cached: 기준 시간 안에 다시 누르면 검색하지 않고 저장된 목록을 쓴다 (할당량 0)
 * - incremental: 지난 검색 뒤에 올라온 영상만 검색하고, 이미 있는 영상은 정보만 다시 받아 순위를 새로 매긴다
 * - full: 처음이거나 지난 검색 뒤 검색 조건(키워드·기간·정렬·불러올 수)을 바꿨으면 기간 전체를 검색한다
 */

/** 검색 조건 (이것이 바뀌면 예전 결과를 이어 쓸 수 없다. 말투·이름 등 다른 칸은 상관없다) */
export interface SearchConditions {
  /** 키워드 */
  keywords: string[];
  /** 올린 날짜 며칠 이내 (0이면 제한 없음) */
  videoWindowDays: number;
  /** 정렬 */
  videoSortBy: string;
  /** 한 번에 불러올 수 (0이면 무제한) */
  fetchLimit: number;
}

/**
 * 검색 조건을 비교할 수 있는 글자로 바꾼다 (키워드 순서는 상관없다)
 * @param c 검색 조건
 */
export function conditionsKey(c: SearchConditions): string {
  return JSON.stringify([
    [...c.keywords].sort(),
    c.videoWindowDays,
    c.videoSortBy,
    c.fetchLimit,
  ]);
}

/** 검색 방식 */
export type SearchMode = 'cached' | 'incremental' | 'full';

/**
 * 새 영상만 검색할 때 지난 검색보다 이만큼 앞부터 찾는다.
 * 유튜브 검색은 올라온 영상이 늦게 잡히기도 해서, 지난 검색 직전에 올라왔는데 그때 못 잡힌 영상을 놓치지 않게 겹친다.
 */
export const INCREMENTAL_OVERLAP_MS = 2 * 60 * 60 * 1000;

/** 정하는 데 쓰는 값 */
export interface SearchPlanInput {
  /** 지금 */
  now: Date;
  /** 이 주제를 마지막으로 검색한 시각 (한 번도 안 했으면 null) */
  lastSearchedAt: Date | null;
  /** 지난 검색 뒤 검색 조건(키워드·기간·정렬·불러올 수)이 바뀌었는지 */
  conditionsChanged: boolean;
  /** 주제의 기간 시작 ('올린 날짜' 며칠 이내). 제한이 없으면 null */
  windowStart: Date | null;
  /** 다시 검색하기 전 기다리는 시간 (분, 설정). 0이면 매번 검색 */
  cacheMinutes: number;
  /** [새로 검색]을 눌렀는지 (기준 시간을 무시한다) */
  force: boolean;
}

/** 정한 검색 방식 */
export type SearchPlan =
  | {
      /** 검색하지 않고 저장된 목록을 쓴다 */
      mode: 'cached';
      /** 검색하지 않으니 없음 */
      publishedAfter: null;
      /** 이 시각부터 다시 검색한다 */
      nextSearchAt: Date;
    }
  | {
      /** 새 영상만 또는 기간 전체를 검색한다 */
      mode: 'incremental' | 'full';
      /** 검색에 넘길 '이 시각 이후에 올라온 영상' (null이면 제한 없음) */
      publishedAfter: Date | null;
    };

/**
 * 검색 방식을 정한다
 * @param input 지난 검색 시각, 검색 조건이 바뀌었는지, 기간, 기준 시간, [새로 검색] 여부
 */
export function planSearch(input: SearchPlanInput): SearchPlan {
  const { now, lastSearchedAt, windowStart } = input;
  // 처음이거나, 지난 검색 뒤 키워드·기간·정렬 등을 바꿨으면 예전 결과를 이어 쓸 수 없다
  if (!lastSearchedAt || input.conditionsChanged) {
    return { mode: 'full', publishedAfter: windowStart };
  }

  const nextSearchAt = new Date(
    lastSearchedAt.getTime() + input.cacheMinutes * 60 * 1000,
  );
  if (!input.force && input.cacheMinutes > 0 && now < nextSearchAt) {
    return { mode: 'cached', publishedAfter: null, nextSearchAt };
  }

  const since = new Date(lastSearchedAt.getTime() - INCREMENTAL_OVERLAP_MS);
  return {
    mode: 'incremental',
    publishedAfter: windowStart && windowStart > since ? windowStart : since,
  };
}
