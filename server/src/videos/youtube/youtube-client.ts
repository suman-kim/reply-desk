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
  /** 영상 설명 (맞은 검색어 대조용, 저장하지 않는다) */
  description?: string;
  /** 태그 (맞은 검색어 대조용, 저장하지 않는다) */
  tags?: string[];
}

/** 검색 조건 */
export interface YoutubeSearchParams {
  /** 검색 키워드 (OR로 묶는다) */
  keywords: string[];
  /** 이 시각 이후에 올라온 영상만. null이면 기간 제한 없음 */
  publishedAfter: Date | null;
  /** API 쪽 정렬. 결과 순서가 관련도 순위(RD-23)가 되므로 보통 relevance. 최종 순위(rank)는 코드가 주제 정렬로 매긴다 */
  order: 'relevance' | 'viewCount' | 'date';
  /** 받을 후보 수. 50을 넘으면 검색을 여러 쪽 받는다 (한 쪽 50개, 할당량 100) */
  maxResults: number;
}

/** 검색 결과 */
export interface YoutubeSearchResult {
  /** 찾은 영상 ID (겹치지 않게) */
  ids: string[];
  /** 받은 검색 쪽 수 (한 쪽에 할당량 100) */
  pages: number;
}

/** YouTube API 클라이언트 */
export interface YoutubeClient {
  /**
   * 조건에 맞는 영상 ID 후보를 찾는다 (search.list, 한 쪽에 할당량 100 사용)
   * @param params 검색 조건
   * @returns 영상 ID와 받은 쪽 수 (쓴 할당량을 알리는 데 쓴다)
   */
  searchVideoIds(params: YoutubeSearchParams): Promise<YoutubeSearchResult>;
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
  /**
   * 영상의 인기 댓글 (영상 보기 창). commentThreads.list 1번, 할당량 1.
   * @param youtubeId 유튜브 영상 ID
   * @param maxComments 가져올 댓글 수 (최대 100)
   */
  getComments(youtubeId: string, maxComments: number): Promise<YoutubeComments>;
}

/** 댓글 하나 (영상 보기 창) */
export interface YoutubeComment {
  /** 댓글 ID */
  id: string;
  /** 쓴 사람 이름 */
  author: string;
  /** 쓴 사람 프로필 사진 */
  authorImageUrl: string | null;
  /** 본문 (글자만) */
  text: string;
  /** 좋아요 수 */
  likeCount: number;
  /** 답글 수 */
  replyCount: number;
  /** 쓴 시각 */
  publishedAt: Date;
}

/** 영상 댓글 목록 */
export interface YoutubeComments {
  /** 댓글이 막힌 영상인지 */
  disabled: boolean;
  /** 댓글 (관련성 순) */
  comments: YoutubeComment[];
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
