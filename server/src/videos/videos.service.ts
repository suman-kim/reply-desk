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
  type YoutubeComments,
  type YoutubeVideoInfo,
} from './youtube/youtube-client.js';
import { parseYoutubeVideoId, watchUrl } from './youtube/youtube-parsers.js';
import { YOUTUBE_SEARCH_CACHE_MINUTES } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { conditionsKey, planSearch, type SearchMode } from './search-plan.js';
import { matchKeywords } from './keyword-match.js';
import { TOPIC_MATCH_THRESHOLD } from '../settings/setting-definitions.js';

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
  /** 이 주제의 최근 초안을 게시했는지 (배지: 게시 완료). 새 초안을 쓰면 다시 거짓 (RD-27: 영상이 아니라 초안 단위) */
  commented: boolean;
  /** 이 영상에 단 댓글 수 (게시 성공 기록 수, 주제·계정 상관없이) */
  commentCount: number;
  /** 최근 초안 상태 (배지: 초안 작성 중·초안 준비됨). 초안이 없으면 none */
  draftState: DraftState | 'none';
  /** 최근 초안이 자동 검사를 통과했는지 */
  checkPassed: boolean;
  /** 유튜브 검색의 관련도 순위 (1부터, 직접 추가한 영상은 null). 화면에서 '관련도'로 정렬한다 (RD-23) */
  searchPosition: number | null;
  /** 주제 검색 키워드 중 제목·설명·태그에 들어 있는 것 (RD-23) */
  matchedKeywords: string[];
  /** 주제와 매칭 (이 주제의 최근 분석. 분석 전이거나 이 기능 전 분석이면 null) */
  topicMatch: { percent: number; matched: boolean; threshold: number } | null;
}

/** 이번 [영상 불러오기]의 검색 정보 (화면 ①이 결과 띠에 보인다) */
export interface SearchRun {
  /** 검색 방식: cached(검색 안 함, 저장된 목록) · incremental(새로 올라온 영상만) · full(기간 전체) */
  mode: SearchMode;
  /** 이 주제를 마지막으로 검색한 시각 (이번 검색 포함) */
  lastSearchedAt: Date | null;
  /** 이 시각 전에 다시 누르면 저장된 목록을 쓴다 (기준 시간이 0이면 null) */
  nextSearchAt: Date | null;
  /** 이번에 쓴 유튜브 할당량 (검색 한 쪽 100 + 영상 정보 50개에 1) */
  quotaUsed: number;
  /** 이번에 이 주제에 새로 들어온 영상 수 */
  newVideos: number;
}

/** [영상 불러오기] 결과 */
export interface LoadResult {
  /** 주제의 영상 목록 (순위 순) */
  videos: VideoItem[];
  /** 검색 정보 */
  search: SearchRun;
}

/** [영상 불러오기]를 누르기 전의 검색 상태 */
export interface SearchStatus {
  /** 지금 누르면 할 검색 방식 */
  nextMode: SearchMode;
  /** 마지막 검색 시각 (한 번도 안 했으면 null) */
  lastSearchedAt: Date | null;
  /** 이 시각부터 다시 검색한다 (지금 누르면 저장된 목록일 때만) */
  nextSearchAt: Date | null;
  /** 다시 검색하기 전 기다리는 시간 (분, 설정) */
  cacheMinutes: number;
}

/** 검색 한 쪽(50개)이 쓰는 유튜브 할당량 */
export const SEARCH_PAGE_QUOTA = 100;

/**
 * 주제의 기간 시작 ('올린 날짜' 며칠 이내). 0일이면 제한 없음(null)
 * @param topic 주제
 * @param now 지금
 */
function windowStartOf(
  topic: Pick<Topic, 'videoWindowDays'>,
  now: Date,
): Date | null {
  return topic.videoWindowDays > 0
    ? new Date(now.getTime() - topic.videoWindowDays * 24 * 60 * 60 * 1000)
    : null;
}

/** 검색 후보를 넉넉히 받아 코드가 다시 정렬한다 (API의 정렬은 근사치라서) */
const CANDIDATE_MULTIPLIER = 5;

/**
 * 무제한(fetchLimit 0)일 때 받을 최대 영상 수.
 * 검색 한 쪽 50개에 할당량 100이라 500개면 1,000을 쓴다 (하루 기본 10,000). 유튜브 검색도 대개 500개 안팎에서 끝난다.
 */
export const UNLIMITED_MAX_VIDEOS = 500;

/** 영상 보기 창의 댓글을 다시 받기 전까지 쓰는 시간 (5분) */
const COMMENTS_TTL_MS = 5 * 60 * 1000;

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
   * @param attempts 게시 기록 저장소 (게시 완료 여부·댓글 수)
   * @param dataSource 트랜잭션·집계 쿼리용
   * @param topics 주제 서비스
   * @param profiles 프로필 서비스 (내 채널 목록)
   * @param settings 공용 설정 (검색을 다시 하기 전 기다리는 시간)
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
    private readonly settings: SettingsService,
  ) {}

  /**
   * 주제마다 마지막 검색에 쓴 검색 조건 (키워드·기간·정렬·불러올 수).
   * 이 조건이 바뀔 때만 기간 전체를 다시 검색한다(말투·이름을 고쳐도 다시 검색하지 않게).
   * 메모리에 두므로 서버를 다시 띄우면 비고, 그때는 '주제를 고친 시각이 지난 검색보다 뒤인지'로 본다.
   */
  private readonly lastConditions = new Map<number, string>();

  /** 영상별로 받아 둔 댓글과 받은 시각 (창을 다시 열 때 할당량을 아낀다) */
  private readonly commentCache = new Map<
    string,
    { at: number; data: YoutubeComments }
  >();

  /**
   * 영상 보기 창의 인기 댓글 (5분 동안 받아 둔다)
   * @param topicId 주제 ID
   * @param videoId 내부 영상 ID
   * @param limit 가져올 댓글 수 (최대 100)
   */
  async comments(
    topicId: number,
    videoId: number,
    limit: number,
  ): Promise<YoutubeComments> {
    const video = await this.getForTopic(topicId, videoId);
    const key = `${video.youtubeId}:${limit}`;
    const cached = this.commentCache.get(key);
    if (cached && Date.now() - cached.at < COMMENTS_TTL_MS) return cached.data;
    const data = await this.youtube.getComments(video.youtubeId, limit);
    this.commentCache.set(key, { at: Date.now(), data });
    return data;
  }

  /**
   * [영상 불러오기]의 지금 검색 상태 (누르기 전에 화면 ①이 본다)
   * @param topicId 주제 ID
   * @param now 기준 시각 (테스트용)
   */
  async searchStatus(
    topicId: number,
    now: Date = new Date(),
  ): Promise<SearchStatus> {
    const topic = await this.topics.findOrFail(topicId);
    const [lastSearchedAt, cacheMinutes] = await Promise.all([
      this.lastSearchedAt(topicId),
      this.settings.get(YOUTUBE_SEARCH_CACHE_MINUTES),
    ]);
    const plan = planSearch({
      now,
      lastSearchedAt,
      conditionsChanged: this.conditionsChanged(topic, lastSearchedAt),
      windowStart: windowStartOf(topic, now),
      cacheMinutes,
      force: false,
    });
    return {
      nextMode: plan.mode,
      lastSearchedAt,
      nextSearchAt: plan.mode === 'cached' ? plan.nextSearchAt : null,
      cacheMinutes,
    };
  }

  /**
   * [영상 불러오기]: 주제 키워드로 최근 영상을 찾고, 정렬해서 상위 fetchLimit개(0이면 무제한)를 목록에 넣는다.
   * 다시 불러오면 순위를 새로 매기고, 이번에 빠진 영상은 순위만 지운다(초안·기록은 남는다).
   * 할당량을 아끼려고 검색 방식을 고른다(search-plan.ts):
   * - 기준 시간(설정 youtube.searchCacheMinutes) 안에 다시 누르면 검색하지 않고 저장된 목록 (할당량 0)
   * - 기준 시간이 지났거나 [새로 검색]이면 지난 검색 뒤 올라온 영상만 검색하고, 이미 있는 영상은 정보만 다시 받는다
   * - 처음이거나 주제 설정을 바꿨으면 기간 전체 검색
   * @param topicId 주제 ID
   * @param opts.force [새로 검색]: 기준 시간을 무시하고 검색한다
   * @param now 기준 시각 (테스트용)
   */
  async loadForTopic(
    topicId: number,
    opts: { force?: boolean } = {},
    now: Date = new Date(),
  ): Promise<LoadResult> {
    const topic = await this.topics.findOrFail(topicId);
    const windowStart = windowStartOf(topic, now);
    const [lastSearchedAt, cacheMinutes] = await Promise.all([
      this.lastSearchedAt(topicId),
      this.settings.get(YOUTUBE_SEARCH_CACHE_MINUTES),
    ]);
    const plan = planSearch({
      now,
      lastSearchedAt,
      conditionsChanged: this.conditionsChanged(topic, lastSearchedAt),
      windowStart,
      cacheMinutes,
      force: !!opts.force,
    });

    if (plan.mode === 'cached') {
      return {
        videos: await this.listForTopic(topicId),
        search: {
          mode: 'cached',
          lastSearchedAt,
          nextSearchAt: plan.nextSearchAt,
          quotaUsed: 0,
          newVideos: 0,
        },
      };
    }

    const found = await this.youtube.searchVideoIds({
      keywords: topic.keywords,
      publishedAfter: plan.publishedAfter,
      // 검색은 관련도 순으로 받아 그 순서를 '관련도 순위'로 남긴다 (RD-23). 목록 순위(rank)는 아래에서 주제 정렬로 매긴다
      order: 'relevance',
      // 무제한이면 검색 결과 끝까지(최대 500개), 아니면 정렬용 후보를 넉넉히 (최대 50개, 검색 한 쪽)
      maxResults:
        topic.fetchLimit > 0
          ? Math.min(50, topic.fetchLimit * CANDIDATE_MULTIPLIER)
          : UNLIMITED_MAX_VIDEOS,
    });
    // 새 영상만 검색했으면, 기간 안의 이미 있는 영상도 조회수를 다시 받아 함께 순위를 매긴다 (50개에 할당량 1)
    const known =
      plan.mode === 'incremental'
        ? await this.knownSearchVideoIds(topicId, windowStart)
        : [];
    const ids = [...new Set([...found.ids, ...known])];
    const infos = await this.youtube.getVideos(ids);
    const picked = rankVideos(infos, topic, windowStart);

    let newVideos = 0;
    await this.dataSource.transaction(async (m) => {
      const saved = await this.upsertVideos(
        m.getRepository(Video),
        picked,
        now,
      );
      const tv = m.getRepository(TopicVideo);
      // 기간 전체를 다시 검색했으면 관련도 순위도 이번 검색으로 새로 매긴다
      await tv.update(
        { topicId, source: TopicVideoSource.Search },
        plan.mode === 'full'
          ? { rank: null, searchPosition: null }
          : { rank: null },
      );
      const positions = new RelevancePositions(
        found.ids,
        plan.mode === 'full'
          ? 0
          : await this.maxSearchPosition(m.getRepository(TopicVideo), topicId),
      );
      for (const [i, info] of picked.entries()) {
        const videoId = saved.get(info.youtubeId)!;
        const existing = await tv.findOneBy({ topicId, videoId });
        const matchedKeywords = matchKeywords(topic.keywords, info);
        if (existing) {
          await tv.update(existing.id, {
            rank: i + 1,
            fetchedAt: now,
            matchedKeywords,
            searchPosition:
              plan.mode === 'full'
                ? positions.of(info.youtubeId)
                : (existing.searchPosition ?? positions.of(info.youtubeId)),
          });
        } else {
          newVideos += 1;
          await tv.insert({
            topicId,
            videoId,
            source: TopicVideoSource.Search,
            rank: i + 1,
            fetchedAt: now,
            matchedKeywords,
            searchPosition: positions.of(info.youtubeId),
          });
        }
      }
    });

    // 결과가 하나도 없으면 검색 시각이 남지 않아(불러온 시각으로 센다) 다음에 다시 검색한다
    const searchedAt = picked.length > 0 ? now : lastSearchedAt;
    if (picked.length > 0)
      this.lastConditions.set(topicId, conditionsKey(topic));
    return {
      videos: await this.listForTopic(topicId),
      search: {
        mode: plan.mode,
        lastSearchedAt: searchedAt,
        nextSearchAt:
          searchedAt && cacheMinutes > 0
            ? new Date(searchedAt.getTime() + cacheMinutes * 60 * 1000)
            : null,
        quotaUsed: found.pages * SEARCH_PAGE_QUOTA + Math.ceil(ids.length / 50),
        newVideos,
      },
    };
  }

  /**
   * [영상 불러오기] 영상 목록만 (POST /topics/:id/videos/fetch)
   * @param topicId 주제 ID
   * @param now 기준 시각 (테스트용)
   */
  async fetchForTopic(
    topicId: number,
    now: Date = new Date(),
  ): Promise<VideoItem[]> {
    return (await this.loadForTopic(topicId, {}, now)).videos;
  }

  /**
   * 지난 검색 뒤 검색 조건(키워드·기간·정렬·불러올 수)이 바뀌었는지.
   * 기억해 둔 조건이 있으면 그것과 비교하고, 없으면(서버를 다시 띄움) 주제를 고친 시각이 지난 검색보다 뒤인지로 본다.
   * 바뀌지 않았다고 본 조건은 기억해 두어, 다음부터는 정확히 비교한다.
   * @param topic 주제
   * @param lastSearchedAt 마지막 검색 시각
   */
  private conditionsChanged(
    topic: Topic,
    lastSearchedAt: Date | null,
  ): boolean {
    const key = conditionsKey(topic);
    const remembered = this.lastConditions.get(topic.id);
    if (remembered !== undefined) return remembered !== key;
    const changed = !!lastSearchedAt && topic.updatedAt > lastSearchedAt;
    if (lastSearchedAt && !changed) this.lastConditions.set(topic.id, key);
    return changed;
  }

  /**
   * 이 주제를 마지막으로 검색한 시각 = 검색으로 들어온 영상의 가장 최근 '불러온 시각'.
   * 따로 칸을 두지 않고 topic_video.fetched_at으로 센다 (링크 추가는 검색 영상의 시각을 바꾸지 않는다)
   * @param topicId 주제 ID
   */
  private async lastSearchedAt(topicId: number): Promise<Date | null> {
    const row = await this.topicVideos
      .createQueryBuilder('tv')
      .select('MAX(tv.fetched_at)', 'last')
      .where('tv.topic_id = :topicId AND tv.source = :source', {
        topicId,
        source: TopicVideoSource.Search,
      })
      .getRawOne<{ last: Date | null }>();
    return row?.last ? new Date(row.last) : null;
  }

  /**
   * 이 주제에서 가장 뒤의 관련도 순위 (새 영상만 검색했을 때 그 뒤에 붙인다)
   * @param repo 주제별 영상 저장소 (트랜잭션 안)
   * @param topicId 주제 ID
   */
  private async maxSearchPosition(
    repo: Repository<TopicVideo>,
    topicId: number,
  ): Promise<number> {
    const row = await repo
      .createQueryBuilder('tv')
      .select('MAX(tv.search_position)', 'max')
      .where('tv.topic_id = :topicId', { topicId })
      .getRawOne<{ max: number | null }>();
    return Number(row?.max ?? 0);
  }

  /**
   * 검색으로 들어온 이 주제의 영상 중 기간 안의 것 (새 영상만 검색할 때 조회수를 다시 받을 대상)
   * @param topicId 주제 ID
   * @param windowStart 기간 시작 (null이면 모두)
   */
  private async knownSearchVideoIds(
    topicId: number,
    windowStart: Date | null,
  ): Promise<string[]> {
    const rows = await this.topicVideos.find({
      where: { topicId, source: TopicVideoSource.Search },
      relations: { video: true },
    });
    return rows
      .filter(
        (r) => r.video && (!windowStart || r.video.publishedAt >= windowStart),
      )
      .map((r) => r.video!.youtubeId);
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
    const topic = await this.topics.findOrFail(topicId);
    const matchedKeywords = matchKeywords(topic.keywords, info);
    const existing = await this.topicVideos.findOneBy({ topicId, videoId });
    if (existing) {
      // 검색으로 들어온 영상의 시각은 '마지막 검색 시각'으로 쓰므로 링크 추가로는 바꾸지 않는다
      await this.topicVideos.update(existing.id, {
        matchedKeywords,
        ...(existing.source === TopicVideoSource.Manual
          ? { fetchedAt: now }
          : {}),
      });
    } else {
      await this.topicVideos.insert({
        topicId,
        videoId,
        source: TopicVideoSource.Manual,
        rank: null,
        searchPosition: null,
        matchedKeywords,
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
      infos.map((i) => ({
        youtubeId: i.youtubeId,
        title: i.title,
        channelId: i.channelId,
        channelTitle: i.channelTitle,
        publishedAt: i.publishedAt,
        viewCount: i.viewCount,
        durationSec: i.durationSec,
        thumbnailUrl: i.thumbnailUrl,
        statsUpdatedAt: now,
      })),
      { conflictPaths: ['youtubeId'] },
    );
    const rows = await repo.find({
      select: { id: true, youtubeId: true },
      where: { youtubeId: In(infos.map((i) => i.youtubeId)) },
    });
    return new Map(rows.map((r) => [r.youtubeId, r.id]));
  }

  /** 카드에 필요한 배지 값(내 채널·게시 완료·댓글 수·초안 상태·주제와 매칭)을 붙인다 */
  private async toItems(
    topicId: number,
    rows: TopicVideo[],
  ): Promise<VideoItem[]> {
    const videoIds = rows.map((r) => r.videoId);
    if (videoIds.length === 0) return [];

    const [myChannels, successRows, drafts, analyses, threshold] =
      await Promise.all([
        this.profiles.myChannelIds(),
        // 게시 성공 기록: 영상별 댓글 수와, 최근 초안을 게시했는지 (RD-27)
        this.attempts.find({
          select: { videoId: true, draftId: true },
          where: { videoId: In(videoIds), status: PostStatus.Success },
        }),
        this.dataSource.query(
          `SELECT DISTINCT ON (video_id) id, video_id, state, check_passed
         FROM draft WHERE topic_id = $1 AND video_id = ANY($2)
         ORDER BY video_id, created_at DESC, id DESC`,
          [topicId, videoIds],
        ) as Promise<
          {
            id: number;
            video_id: number;
            state: DraftState;
            check_passed: boolean;
          }[]
        >,
        // 이 주제에서 영상마다 가장 최근 분석의 매칭 퍼센트
        this.dataSource.query(
          `SELECT DISTINCT ON (video_id) video_id, topic_match
         FROM video_analysis WHERE topic_id = $1 AND video_id = ANY($2)
         ORDER BY video_id, created_at DESC, id DESC`,
          [topicId, videoIds],
        ) as Promise<{ video_id: number; topic_match: number | null }[]>,
        this.settings.get(TOPIC_MATCH_THRESHOLD),
      ]);
    const postedDrafts = new Set(
      successRows.flatMap((r) => (r.draftId ? [r.draftId] : [])),
    );
    const commentCount = new Map<number, number>();
    for (const r of successRows)
      commentCount.set(r.videoId, (commentCount.get(r.videoId) ?? 0) + 1);
    const draftBy = new Map(drafts.map((d) => [Number(d.video_id), d]));
    const matchBy = new Map(
      analyses
        .filter((a) => a.topic_match !== null)
        .map((a) => [Number(a.video_id), Number(a.topic_match)]),
    );

    return rows.map((r) => {
      const v = r.video!;
      const d = draftBy.get(v.id);
      return {
        id: v.id,
        youtubeId: v.youtubeId,
        url: watchUrl(v.youtubeId),
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
        commented: !!d && postedDrafts.has(Number(d.id)),
        commentCount: commentCount.get(v.id) ?? 0,
        draftState: d?.state ?? 'none',
        checkPassed: d?.check_passed ?? false,
        searchPosition: r.searchPosition,
        matchedKeywords: r.matchedKeywords ?? [],
        topicMatch: matchBy.has(v.id)
          ? {
              percent: matchBy.get(v.id)!,
              matched: matchBy.get(v.id)! >= threshold,
              threshold,
            }
          : null,
      };
    });
  }
}

/**
 * 관련도 순위 매기기 (RD-23). 검색 결과(관련도 순)의 순서를 1부터 매긴다.
 * 새 영상만 검색했을 때는 두 검색의 관련도를 서로 비교할 수 없어, 기존 목록 뒤(base 다음)에 이번 검색의 순서대로 붙인다.
 */
export class RelevancePositions {
  private readonly index = new Map<string, number>();

  /**
   * @param foundIds 이번 검색 결과 (관련도 순)
   * @param base 이번 순서를 붙일 앞 번호 (기간 전체 검색이면 0)
   */
  constructor(
    foundIds: string[],
    private readonly base: number,
  ) {
    foundIds.forEach((id, i) => {
      if (!this.index.has(id)) this.index.set(id, i + 1);
    });
  }

  /**
   * 영상의 관련도 순위 (이번 검색에 없으면 null)
   * @param youtubeId 유튜브 영상 ID
   */
  of(youtubeId: string): number | null {
    const n = this.index.get(youtubeId);
    return n === undefined ? null : this.base + n;
  }
}

/**
 * 후보 영상을 주제 조건으로 거르고 정렬해서 상위 fetchLimit개를 고른다 (코드가 하는 일).
 * @param infos API에서 읽은 영상
 * @param topic 주제 (정렬 기준·개수. 개수 0이면 자르지 않는다)
 * @param publishedAfter 이 시각 이후 영상만 (null이면 기간 제한 없음)
 */
export function rankVideos(
  infos: YoutubeVideoInfo[],
  topic: Pick<Topic, 'videoSortBy' | 'fetchLimit'>,
  publishedAfter: Date | null,
): YoutubeVideoInfo[] {
  const unique = [...new Map(infos.map((i) => [i.youtubeId, i])).values()];
  return unique
    .filter((i) => !publishedAfter || i.publishedAt >= publishedAfter)
    .sort((a, b) =>
      topic.videoSortBy === VideoSortBy.Date
        ? b.publishedAt.getTime() - a.publishedAt.getTime()
        : b.viewCount - a.viewCount ||
          b.publishedAt.getTime() - a.publishedAt.getTime(),
    )
    .slice(0, topic.fetchLimit > 0 ? topic.fetchLimit : undefined);
}
