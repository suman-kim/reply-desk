import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { parseIsoDuration } from './youtube-parsers.js';
import type {
  YoutubeClient,
  YoutubeSearchParams,
  YoutubeVideoInfo,
} from './youtube-client.js';

/** YouTube Data API v3 주소 */
const API = 'https://www.googleapis.com/youtube/v3';

/** search.list 응답 중 쓰는 부분 */
interface SearchResponse {
  items?: { id?: { videoId?: string } }[];
}

/** videos.list 응답 중 쓰는 부분 */
interface VideosResponse {
  items?: {
    id: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
    statistics?: { viewCount?: string };
    contentDetails?: { duration?: string };
  }[];
}

/** API 오류 응답 */
interface ApiError {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] };
}

/**
 * YouTube Data API v3 구현. 키는 YOUTUBE_API_KEY.
 * 실패하면 화면 ①에 그대로 보여 줄 수 있는 한 줄 원인으로 바꿔 던진다.
 */
@Injectable()
export class YoutubeApiClient implements YoutubeClient {
  /**
   * @param config 환경 변수 (API 키)
   */
  constructor(private readonly config: ConfigService<Env, true>) {}

  async searchVideoIds(params: YoutubeSearchParams): Promise<string[]> {
    const body = await this.call<SearchResponse>('search', {
      part: 'id',
      type: 'video',
      q: params.keywords.join('|'),
      order: params.order,
      publishedAfter: params.publishedAfter.toISOString(),
      maxResults: String(Math.min(50, params.maxResults)),
      regionCode: 'KR',
      relevanceLanguage: 'ko',
    });
    return (body.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((id): id is string => !!id);
  }

  async getVideos(ids: string[]): Promise<YoutubeVideoInfo[]> {
    if (ids.length === 0) return [];
    const body = await this.call<VideosResponse>('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(0, 50).join(','),
      maxResults: '50',
    });
    return (body.items ?? []).map((v) => {
      const thumbs = v.snippet?.thumbnails ?? {};
      return {
        youtubeId: v.id,
        title: v.snippet?.title ?? '(제목 없음)',
        channelId: v.snippet?.channelId ?? '',
        channelTitle: v.snippet?.channelTitle ?? '',
        publishedAt: new Date(v.snippet?.publishedAt ?? Date.now()),
        viewCount: Number(v.statistics?.viewCount ?? 0),
        durationSec: parseIsoDuration(v.contentDetails?.duration ?? ''),
        thumbnailUrl:
          thumbs.medium?.url ?? thumbs.high?.url ?? thumbs.default?.url ?? null,
      };
    });
  }

  /**
   * API를 부르고, 실패하면 이해하기 쉬운 원인으로 바꾼다.
   * @param resource search 또는 videos
   * @param query 쿼리 값 (key는 여기서 붙인다)
   */
  private async call<T>(
    resource: string,
    query: Record<string, string>,
  ): Promise<T> {
    const key = this.config.get('YOUTUBE_API_KEY', { infer: true });
    if (!key) {
      throw new ServiceUnavailableException(
        'YouTube API 키가 없어요 · server/.env의 YOUTUBE_API_KEY를 채워 주세요',
      );
    }
    const url = `${API}/${resource}?${new URLSearchParams({ ...query, key })}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new ServiceUnavailableException(
        'YouTube에 연결하지 못했어요 · 인터넷 연결을 확인하고 다시 시도해 주세요',
      );
    }
    if (res.ok) return (await res.json()) as T;

    const err = ((await res.json().catch(() => ({}))) as ApiError).error;
    const reason = err?.errors?.[0]?.reason ?? '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new ServiceUnavailableException(
        'YouTube API 하루 할당량을 다 썼어요 · 한국 시간 오후 4~5시에 다시 채워져요',
      );
    }
    if (
      reason === 'keyInvalid' ||
      (res.status === 400 && /API key/i.test(err?.message ?? ''))
    ) {
      throw new ServiceUnavailableException(
        'YouTube API 키가 맞지 않아요 · server/.env의 YOUTUBE_API_KEY를 확인해 주세요',
      );
    }
    if (res.status === 403) {
      throw new ServiceUnavailableException(
        'YouTube API를 쓸 권한이 없어요 · 구글 클라우드에서 YouTube Data API v3를 켰는지 확인해 주세요',
      );
    }
    throw new ServiceUnavailableException(
      `YouTube API가 응답하지 않아요 (${res.status}) · 잠시 뒤 다시 시도해 주세요`,
    );
  }
}
