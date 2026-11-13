/**
 * YouTube Data API 접근 인터페이스. 서비스는 이 인터페이스만 알고,
 * 실제 구현(YoutubeApiClient)은 DI 토큰으로 넣는다. 테스트에서는 가짜 구현을 넣는다.
 */

/** 영상 정보 (API에서 코드가 읽은 값) */
export interface YoutubeVideoInfo {
  /** 유튜브 영상 ID */
  youtubeId: string;
  /** 제목 */
  title: string;
  /** 채널 ID */
  channelId: string;
  /** 채널 이름 */
  channelTitle: string;
  /** 올린 시각 */
  publishedAt: Date;
  /** 조회수 */
  viewCount: number;
  /** 길이(초) */
  durationSec: number;
  /** 썸네일 주소 */
  thumbnailUrl: string | null;
}

/** 검색 조건 */
export interface YoutubeSearchParams {
  /** 검색 키워드 (OR로 묶는다) */
  keywords: string[];
  /** 이 시각 이후에 올라온 영상만. null이면 기간 제한 없음 */
  publishedAfter: Date | null;
  /** API 쪽 정렬 (후보를 고르는 데만 쓰고, 최종 정렬은 코드가 한다) */
  order: 'viewCount' | 'date';
  /** 받을 후보 수 (최대 50) */
  maxResults: number;
}

/** YouTube API 클라이언트 */
export interface YoutubeClient {
  /**
   * 조건에 맞는 영상 ID 후보를 찾는다 (search.list, 할당량 100 사용)
   * @param params 검색 조건
   */
  searchVideoIds(params: YoutubeSearchParams): Promise<string[]>;
  /**
   * 영상 ID로 자세한 정보를 읽는다 (videos.list, 할당량 1 사용). 없는 영상은 빠진다.
   * @param ids 유튜브 영상 ID 목록 (최대 50)
   */
  getVideos(ids: string[]): Promise<YoutubeVideoInfo[]>;
  /**
   * 분석 재료: 영상 설명과 인기 댓글 (videos.list 1 + commentThreads.list 1).
   * 댓글이 막힌 영상은 댓글이 빈 목록이다.
   * @param youtubeId 유튜브 영상 ID
   * @param maxComments 가져올 인기 댓글 수 (최대 100)
   */
  getVideoContext(
    youtubeId: string,
    maxComments: number,
  ): Promise<YoutubeVideoContext>;
}

/** 분석 재료 */
export interface YoutubeVideoContext {
  /** 영상 설명 */
  description: string;
  /** 인기 댓글 (관련성 순) */
  comments: { text: string; likeCount: number }[];
}

/** DI 토큰 */
export const YOUTUBE_CLIENT = Symbol('YOUTUBE_CLIENT');
