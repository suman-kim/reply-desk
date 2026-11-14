import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { requiredDisclosure } from '../checks/ad-disclosure.js';
import { CheckRunnerService } from '../checks/check-runner.service.js';
import { EventsService } from '../events/events.service.js';
import { PostAttempt, PostStatus } from '../posting/post-attempt.entity.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { TopicsService } from '../topics/topics.service.js';
import { Video } from '../videos/video.entity.js';
import { VideosService, type VideoItem } from '../videos/videos.service.js';
import { AnalysisService } from './analysis.service.js';
import {
  DraftQueueService,
  type DraftProgress,
} from './draft-queue.service.js';
import {
  DRAFT_STATUS_LABELS,
  DraftListStatus,
  draftListStatus,
} from './draft-status.js';
import { watchUrl } from '../videos/youtube/youtube-parsers.js';
import { Draft, DraftState } from './draft.entity.js';
import { checkContextOf } from './drafting.service.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/** ② 칸 / 초안 상세 패널에 필요한 값 */
export interface DraftDetail {
  /** 영상 카드 값 */
  video: VideoItem;
  /** 최근 분석 (없으면 null) */
  analysis: VideoAnalysis | null;
  /** 최근 초안 (없으면 null) */
  draft: Draft | null;
  /** 목록 상태 (초안이 없으면 null) */
  status: { code: DraftListStatus; label: string } | null;
  /** 이 영상의 게시 기록 (최근 순) */
  attempts: Pick<
    PostAttempt,
    | 'id'
    | 'status'
    | 'failedStep'
    | 'failureReason'
    | 'startedAt'
    | 'commentUrl'
  >[];
}

/** 초안 목록 한 행 */
export interface DraftListRow {
  /** 초안 ID */
  id: number;
  /** 주제 */
  topic: { id: number; name: string };
  /** 영상 */
  video: {
    /** 내부 영상 ID */
    id: number;
    /** 유튜브 영상 ID */
    youtubeId: string;
    /** 유튜브 보기 주소 */
    url: string;
    /** 제목 */
    title: string;
    /** 채널 이름 */
    channelTitle: string;
    /** 내 채널 영상인지 */
    isMine: boolean;
    /** 조회수 */
    viewCount: number;
    /** 올린 시각 */
    publishedAt: Date;
    /** 영상 길이 (초) */
    durationSec: number;
  };
  /** 초안 글 */
  text: string;
  /** 초안을 쓴 AI 제공자 (작성 실패·작성 중이면 null) */
  provider: string | null;
  /** 초안을 쓴 모델 */
  model: string | null;
  /** 게시된 댓글 주소 (게시 완료일 때) */
  commentUrl: string | null;
  /** 사람이 고쳤는지 */
  edited: boolean;
  /** 상태 */
  status: DraftListStatus;
  /** 상태 이름 */
  statusLabel: string;
  /** 작성 실패 원인 */
  errorMessage: string | null;
  /** 고친 시각 */
  updatedAt: Date;
}

/** 초안 목록 조회 조건 */
export interface DraftListFilter {
  /** 상태 */
  status?: DraftListStatus;
  /** 주제 ID */
  topicId?: number;
  /** 검색어 (영상 제목·댓글 내용) */
  q?: string;
  /** 최대 행 수 */
  limit: number;
}

/**
 * 초안: 불러오기 + 자동 작성, 다시 생성, 상세, 고치기, 목록.
 * 실제 AI 호출은 DraftQueueService가 차례로 한다.
 */
@Injectable()
export class DraftsService {
  /**
   * @param drafts 초안 저장소
   * @param attempts 게시 기록 저장소
   * @param dataSource 집계 쿼리용
   * @param queue 초안 작성 대기열
   * @param analysis 영상 분석
   * @param checks 자동 검사
   * @param topics 주제 서비스
   * @param videos 영상 서비스
   * @param profiles 프로필 서비스 (내 채널)
   * @param events 실시간 이벤트 (고친 초안을 다른 화면에 알린다)
   */
  constructor(
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly queue: DraftQueueService,
    private readonly analysis: AnalysisService,
    private readonly checks: CheckRunnerService,
    private readonly topics: TopicsService,
    private readonly videos: VideosService,
    private readonly profiles: ProfilesService,
    private readonly events: EventsService,
  ) {}

  /**
   * [영상 불러오기]: 영상만 불러와 순위를 매긴다. 초안은 쓰지 않는다.
   * 초안은 ② 영상 선택에서 [초안 작성]을 누를 때 그 영상 하나만 쓴다
   * (영상을 많이·무제한으로 불러와도 AI 비용이 들지 않게).
   * @param topicId 주제 ID
   */
  async load(topicId: number): Promise<{ videos: VideoItem[] }> {
    return { videos: await this.videos.fetchForTopic(topicId) };
  }

  /**
   * [초안 작성]·[다시 생성]: 이 영상의 초안을 (새로) 쓴다. reanalyze면 분석부터 다시 한다.
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   * @param reanalyze 분석부터 다시 할지
   */
  async regenerate(
    topicId: number,
    videoId: number,
    reanalyze: boolean,
  ): Promise<DraftDetail> {
    const video = await this.videos.getForTopic(topicId, videoId);
    if (video.draftState === DraftState.Writing) {
      throw new ConflictException(
        '이 영상의 초안을 쓰는 중이에요 · 잠시만 기다려 주세요',
      );
    }
    await this.queue.enqueue(topicId, [videoId], {
      reanalyze,
      trackProgress: false,
    });
    return this.detail(topicId, videoId);
  }

  /**
   * 자동 작성 진행률
   * @param topicId 주제 ID
   */
  async progress(topicId: number): Promise<DraftProgress | null> {
    await this.topics.findOrFail(topicId);
    return this.queue.progressOf(topicId);
  }

  /**
   * ② 칸 / 상세 패널
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   */
  async detail(topicId: number, videoId: number): Promise<DraftDetail> {
    const video = await this.videos.getForTopic(topicId, videoId);
    const [analysis, draft, attempts] = await Promise.all([
      this.analysis.latest(topicId, videoId),
      this.drafts.findOne({
        where: { topicId, videoId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.attempts.find({
        select: {
          id: true,
          status: true,
          failedStep: true,
          failureReason: true,
          startedAt: true,
          commentUrl: true,
        },
        where: { videoId },
        order: { startedAt: 'DESC', id: 'DESC' },
        take: 20,
      }),
    ]);
    const status = draft
      ? draftListStatus({
          state: draft.state,
          checkPassed: draft.checkPassed,
          commented: video.commented,
          lastPostFailed: attempts[0]?.status === PostStatus.Failed,
        })
      : null;
    return {
      video,
      analysis,
      draft,
      status: status
        ? { code: status, label: DRAFT_STATUS_LABELS[status] }
        : null,
      attempts,
    };
  }

  /**
   * 사람이 초안을 고친다. 고치면 바로 다시 검사한다.
   * @param draftId 초안 ID
   * @param text 고친 글
   */
  async edit(draftId: number, text: string): Promise<Draft> {
    const draft = await this.drafts.findOneBy({ id: draftId });
    if (!draft)
      throw new NotFoundException(
        '초안을 찾을 수 없어요 · 목록을 새로 고쳐 주세요',
      );
    if (draft.state !== DraftState.Ready) {
      throw new BadRequestException([
        'text: 다 쓴 초안만 고칠 수 있어요 · 작성이 끝나거나 [다시 생성]한 뒤 고쳐 주세요',
      ]);
    }
    const topic = await this.topics.findOrFail(draft.topicId);
    const analysis = draft.analysisId
      ? await this.dataSource
          .getRepository('VideoAnalysis')
          .findOneBy({ id: draft.analysisId })
      : null;
    // 다른 채널 영상이면 광고 표시가 맨 앞에 있어야 한다 (사람이 지웠으면 검사에서 걸린다)
    const [video, myChannels] = await Promise.all([
      this.dataSource.getRepository(Video).findOneBy({ id: draft.videoId }),
      this.profiles.myChannelIds(),
    ]);
    const disclosure = requiredDisclosure(
      topic.adDisclosure,
      !!video && myChannels.has(video.channelId),
    );
    const report = this.checks.run(
      checkContextOf(text, topic, analysis as VideoAnalysis | null, disclosure),
    );
    await this.drafts.update(draftId, {
      text,
      edited: text !== draft.aiText,
      checkResults: report.results,
      checkPassed: report.passed,
    });
    const saved = (await this.drafts.findOneBy({ id: draftId }))!;
    // 다른 화면(초안 목록·대시보드)도 고친 결과를 바로 반영하게 알린다
    this.events.emit({
      type: 'draft.updated',
      topicId: saved.topicId,
      videoId: saved.videoId,
      draftId: saved.id,
      state: saved.state,
      checkPassed: saved.checkPassed,
      errorMessage: saved.errorMessage,
    });
    return saved;
  }

  /**
   * 초안 목록 (영상·주제마다 가장 최근 초안). 상태별 개수도 함께 준다.
   * @param filter 상태·주제·검색어
   */
  async list(filter: DraftListFilter): Promise<{
    rows: DraftListRow[];
    counts: Record<DraftListStatus, number>;
  }> {
    const latest: { id: number }[] = await this.dataSource.query(
      `SELECT DISTINCT ON (topic_id, video_id) id FROM draft
       ${filter.topicId ? 'WHERE topic_id = $1' : ''}
       ORDER BY topic_id, video_id, created_at DESC, id DESC`,
      filter.topicId ? [filter.topicId] : [],
    );
    const counts = Object.fromEntries(
      Object.values(DraftListStatus).map((s) => [s, 0]),
    ) as Record<DraftListStatus, number>;
    if (latest.length === 0) return { rows: [], counts };

    const drafts = await this.drafts.find({
      where: { id: In(latest.map((l) => l.id)) },
      relations: { topic: true, video: true },
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
    const videoIds = [...new Set(drafts.map((d) => d.videoId))];
    const [myChannels, attempts] = await Promise.all([
      this.profiles.myChannelIds(),
      this.dataSource.query(
        `SELECT DISTINCT ON (video_id) video_id, status,
                EXISTS (SELECT 1 FROM post_attempt s WHERE s.video_id = a.video_id AND s.status = 'success') AS commented,
                (SELECT s.comment_url FROM post_attempt s WHERE s.video_id = a.video_id AND s.status = 'success'
                  ORDER BY s.started_at DESC, s.id DESC LIMIT 1) AS comment_url
         FROM post_attempt a WHERE video_id = ANY($1)
         ORDER BY video_id, started_at DESC, id DESC`,
        [videoIds],
      ) as Promise<
        {
          video_id: number;
          status: PostStatus;
          commented: boolean;
          comment_url: string | null;
        }[]
      >,
    ]);
    const postBy = new Map(attempts.map((a) => [Number(a.video_id), a]));

    const q = filter.q?.trim().toLowerCase();
    const rows: DraftListRow[] = [];
    for (const d of drafts) {
      const post = postBy.get(d.videoId);
      const isMine = myChannels.has(d.video!.channelId);
      const status = draftListStatus({
        state: d.state,
        checkPassed: d.checkPassed,
        commented: post?.commented ?? false,
        lastPostFailed: post?.status === PostStatus.Failed,
      });
      if (
        q &&
        !d.video!.title.toLowerCase().includes(q) &&
        !d.text.toLowerCase().includes(q)
      )
        continue;
      counts[status] += 1;
      if (filter.status && filter.status !== status) continue;
      rows.push({
        id: d.id,
        topic: { id: d.topic!.id, name: d.topic!.name },
        video: {
          id: d.video!.id,
          youtubeId: d.video!.youtubeId,
          url: watchUrl(d.video!.youtubeId),
          title: d.video!.title,
          channelTitle: d.video!.channelTitle,
          isMine,
          viewCount: d.video!.viewCount,
          publishedAt: d.video!.publishedAt,
          durationSec: d.video!.durationSec,
        },
        text: d.text,
        provider: d.provider,
        model: d.model,
        commentUrl: post?.comment_url ?? null,
        edited: d.edited,
        status,
        statusLabel: DRAFT_STATUS_LABELS[status],
        errorMessage: d.errorMessage,
        updatedAt: d.updatedAt,
      });
    }
    return { rows: rows.slice(0, filter.limit), counts };
  }
}
