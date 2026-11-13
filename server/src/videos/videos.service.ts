import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DraftState } from '../drafts/draft.entity.js';
import { PostAttempt, PostStatus } from '../posting/post-attempt.entity.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { VideoSortBy, type Topic } from '../topics/topic.entity.js';
import { TopicsService } from '../topics/topics.service.js';
import { TopicVideo, TopicVideoSource } from './topic-video.entity.js';
import { Video } from './video.entity.js';
import {
  YOUTUBE_CLIENT,
  type YoutubeClient,
  type YoutubeVideoInfo,
} from './youtube/youtube-client.js';
import { parseYoutubeVideoId } from './youtube/youtube-parsers.js';

/** ① 칸 영상 카드 한 장 */
export interface VideoItem {
  /** 내부 영상 ID (다른 API에 넘기는 값) */
  id: number;
  /** 유튜브 영상 ID */
  youtubeId: string;
  /** 유튜브 주소 */
  url: string;
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
  /** 마지막 불러오기 순위 (직접 추가했거나 이번 결과에 없으면 null) */
  rank: number | null;
  /** 들어온 경로 */
  source: TopicVideoSource;
  /** 내 채널 영상인지 (배지: 내 채널) */
  isMine: boolean;
  /** 이미 댓글을 단 영상인지 (배지: 댓글 완료, 주제와 상관없이 전체) */
  commented: boolean;
  /** 최근 초안 상태 (배지: 초안 작성 중·초안 준비됨). 초안이 없으면 none */
  draftState: DraftState | 'none';
  /** 최근 초안이 자동 검사를 통과했는지 */
  checkPassed: boolean;
}

/** 검색 후보를 넉넉히 받아 코드가 다시 정렬한다 (API의 정렬은 근사치라서) */
const CANDIDATE_MULTIPLIER = 5;

/**
 * 영상 불러오기(①)와 링크 직접 추가(②).
 * 숫자(조회수·시각)는 YouTube API 값을 코드가 넣고, 정렬도 코드가 한다.
 */
@Injectable()
export class VideosService {
  /**
   * @param youtube YouTube API 클라이언트
   * @param videos 영상 저장소
   * @param topicVideos 주제별 영상 저장소
   * @param attempts 게시 기록 저장소 (댓글 완료 여부)
   * @param dataSource 트랜잭션·집계 쿼리용
   * @param topics 주제 서비스
   * @param profiles 프로필 서비스 (내 채널 목록)
   */
  constructor(
    @Inject(YOUTUBE_CLIENT) private readonly youtube: YoutubeClient,
    @InjectRepository(Video) private readonly videos: Repository<Video>,
    @InjectRepository(TopicVideo)
    private readonly topicVideos: Repository<TopicVideo>,
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly topics: TopicsService,
    private readonly profiles: ProfilesService,
  ) {}

  /**
   * [영상 불러오기]: 주제 키워드로 최근 영상을 찾고, 정렬해서 상위 fetchLimit개를 목록에 넣는다.
   * 다시 불러오면 순위를 새로 매기고, 이번에 빠진 영상은 순위만 지운다(초안·기록은 남는다).
   * @param topicId 주제 ID
   * @param now 기준 시각 (테스트용)
   */
  async fetchForTopic(
    topicId: number,
    now: Date = new Date(),
  ): Promise<VideoItem[]> {
    const topic = await this.topics.findOrFail(topicId);
    const publishedAfter = new Date(
      now.getTime() - topic.videoWindowDays * 24 * 60 * 60 * 1000,
    );

    const ids = await this.youtube.searchVideoIds({
      keywords: topic.keywords,
      publishedAfter,
      order: topic.videoSortBy === VideoSortBy.Date ? 'date' : 'viewCount',
      maxResults: Math.min(50, topic.fetchLimit * CANDIDATE_MULTIPLIER),
    });
    const infos = await this.youtube.getVideos(ids);
    const picked = rankVideos(infos, topic, publishedAfter);

    await this.dataSource.transaction(async (m) => {
      const saved = await this.upsertVideos(
        m.getRepository(Video),
        picked,
        now,
      );
      const tv = m.getRepository(TopicVideo);
      await tv.update(
        { topicId, source: TopicVideoSource.Search },
        { rank: null },
      );
      for (const [i, info] of picked.entries()) {
        const videoId = saved.get(info.youtubeId)!;
        const existing = await tv.findOneBy({ topicId, videoId });
        if (existing) {
          await tv.update(existing.id, { rank: i + 1, fetchedAt: now });
        } else {
          await tv.insert({
            topicId,
            videoId,
            source: TopicVideoSource.Search,
            rank: i + 1,
            fetchedAt: now,
          });
        }
      }
    });
    return this.listForTopic(topicId);
  }

  /**
   * 링크 직접 입력 + [추가]
   * @param topicId 주제 ID
   * @param input 유튜브 링크나 영상 ID
   * @param now 기준 시각 (테스트용)
   */
  async addByUrl(
    topicId: number,
    input: string,
    now: Date = new Date(),
  ): Promise<VideoItem> {
    await this.topics.findOrFail(topicId);
    const youtubeId = parseYoutubeVideoId(input);
    if (!youtubeId) {
      throw new BadRequestException([
        'url: 유튜브 영상 링크가 아니에요 · youtube.com/watch?v=… 형식으로 넣어 주세요',
      ]);
    }
    const [info] = await this.youtube.getVideos([youtubeId]);
    if (!info)
      throw new NotFoundException(
        '영상을 찾을 수 없어요 · 비공개이거나 지워진 영상인지 확인해 주세요',
      );

    const videoId = (await this.upsertVideos(this.videos, [info], now)).get(
      youtubeId,
    )!;
    const existing = await this.topicVideos.findOneBy({ topicId, videoId });
    if (existing) {
      await this.topicVideos.update(existing.id, { fetchedAt: now });
    } else {
      await this.topicVideos.insert({
        topicId,
        videoId,
        source: TopicVideoSource.Manual,
        rank: null,
        fetchedAt: now,
      });
    }
    return this.getForTopic(topicId, videoId);
  }

  /**
   * 주제의 영상 목록 (순위 순, 순위 없는 영상은 최근에 들어온 순으로 뒤에)
   * @param topicId 주제 ID
   */
  async listForTopic(topicId: number): Promise<VideoItem[]> {
    await this.topics.findOrFail(topicId);
    const rows = await this.topicVideos.find({
      where: { topicId },
      relations: { video: true },
    });
    rows.sort(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) -
          (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        b.fetchedAt.getTime() - a.fetchedAt.getTime(),
    );
    return this.toItems(topicId, rows);
  }

  /**
   * 주제의 영상 하나
   * @param topicId 주제 ID
   * @param videoId 내부 영상 ID
   */
  async getForTopic(topicId: number, videoId: number): Promise<VideoItem> {
    const row = await this.topicVideos.findOne({
      where: { topicId, videoId },
      relations: { video: true },
    });
    if (!row)
      throw new NotFoundException(
        '이 주제에 없는 영상이에요 · 영상 목록을 새로 고쳐 주세요',
      );
    const [item] = await this.toItems(topicId, [row]);
    return item;
  }

  /**
   * 영상을 저장하거나 최신 통계로 고친다.
   * @returns 유튜브 ID → 내부 ID
   */
  private async upsertVideos(
    repo: Repository<Video>,
    infos: YoutubeVideoInfo[],
    now: Date,
  ): Promise<Map<string, number>> {
    if (infos.length === 0) return new Map();
    await repo.upsert(
      infos.map((i) => ({ ...i, statsUpdatedAt: now })),
      { conflictPaths: ['youtubeId'] },
    );
    const rows = await repo.find({
      select: { id: true, youtubeId: true },
      where: { youtubeId: In(infos.map((i) => i.youtubeId)) },
    });
    return new Map(rows.map((r) => [r.youtubeId, r.id]));
  }

  /** 카드에 필요한 배지 값(내 채널·댓글 완료·초안 상태)을 붙인다 */
  private async toItems(
    topicId: number,
    rows: TopicVideo[],
  ): Promise<VideoItem[]> {
    const videoIds = rows.map((r) => r.videoId);
    if (videoIds.length === 0) return [];

    const [myChannels, commentedRows, drafts] = await Promise.all([
      this.profiles.myChannelIds(),
      this.attempts.find({
        select: { videoId: true },
        where: { videoId: In(videoIds), status: PostStatus.Success },
      }),
      this.dataSource.query(
        `SELECT DISTINCT ON (video_id) video_id, state, check_passed
         FROM draft WHERE topic_id = $1 AND video_id = ANY($2)
         ORDER BY video_id, created_at DESC, id DESC`,
        [topicId, videoIds],
      ) as Promise<
        { video_id: number; state: DraftState; check_passed: boolean }[]
      >,
    ]);
    const commented = new Set(commentedRows.map((r) => r.videoId));
    const draftBy = new Map(drafts.map((d) => [Number(d.video_id), d]));

    return rows.map((r) => {
      const v = r.video!;
      const d = draftBy.get(v.id);
      return {
        id: v.id,
        youtubeId: v.youtubeId,
        url: `https://www.youtube.com/watch?v=${v.youtubeId}`,
        title: v.title,
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        publishedAt: v.publishedAt,
        viewCount: v.viewCount,
        durationSec: v.durationSec,
        thumbnailUrl: v.thumbnailUrl,
        rank: r.rank,
        source: r.source,
        isMine: myChannels.has(v.channelId),
        commented: commented.has(v.id),
        draftState: d?.state ?? 'none',
        checkPassed: d?.check_passed ?? false,
      };
    });
  }
}

/**
 * 후보 영상을 주제 조건으로 거르고 정렬해서 상위 fetchLimit개를 고른다 (코드가 하는 일).
 * @param infos API에서 읽은 영상
 * @param topic 주제 (정렬 기준·개수)
 * @param publishedAfter 이 시각 이후 영상만
 */
export function rankVideos(
  infos: YoutubeVideoInfo[],
  topic: Pick<Topic, 'videoSortBy' | 'fetchLimit'>,
  publishedAfter: Date,
): YoutubeVideoInfo[] {
  const unique = [...new Map(infos.map((i) => [i.youtubeId, i])).values()];
  return unique
    .filter((i) => i.publishedAt >= publishedAfter)
    .sort((a, b) =>
      topic.videoSortBy === VideoSortBy.Date
        ? b.publishedAt.getTime() - a.publishedAt.getTime()
        : b.viewCount - a.viewCount ||
          b.publishedAt.getTime() - a.publishedAt.getTime(),
    )
    .slice(0, topic.fetchLimit);
}
