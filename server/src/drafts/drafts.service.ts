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
import { postedCommentsOf } from '../posting/posted-comments.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { TopicsService } from '../topics/topics.service.js';
import { Video } from '../videos/video.entity.js';
import {
  VideosService,
  type LoadResult,
  type VideoItem,
} from '../videos/videos.service.js';
import { watchUrl } from '../videos/youtube/youtube-parsers.js';
import { TOPIC_MATCH_THRESHOLD } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { AnalysisService } from './analysis.service.js';
import { recentDraftsOf } from './variety/recent-drafts.js';
import {
  DraftQueueService,
  type DraftProgress,
} from './draft-queue.service.js';
import {
  DRAFT_STATUS_LABELS,
  DraftListStatus,
  draftListStatus,
} from './draft-status.js';
import { Draft, DraftState } from './draft.entity.js';
import { checkContextOf } from './drafting.service.js';
import { toTopicMatch, type TopicMatchView } from './topic-match.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/** ② 칸 / 초안 상세 패널에 필요한 값 */
export interface DraftDetail {
  /** 영상 카드 값 */
  video: VideoItem;
  /** 최근 분석 (없으면 null) */
  analysis: VideoAnalysis | null;
  /** 주제와 매칭 (퍼센트·이유·기준 이상인지). 분석이 없거나 이 기능 전 분석이면 null */
  topicMatch: TopicMatchView | null;
  /** 최근 초안 (없으면 null) */
  draft: Draft | null;
  /** 목록 상태 (초안이 없으면 null) */
  status: { code: DraftListStatus; label: string } | null;
  /** 이 영상의 게시 기록 (최근 순, 주제 상관없이). 어느 초안을 게시했는지(draftId)와 단 댓글 글(commentText)도 준다 (RD-27) */
  attempts: Pick<
    PostAttempt,
    | 'id'
    | 'draftId'
    | 'status'
    | 'failedStep'
    | 'failureReason'
    | 'startedAt'
    | 'commentUrl'
    | 'commentText'
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
  /** 주제와 매칭 (퍼센트·기준 이상인지). 분석이 없거나 이 기능 전 분석이면 null */
  topicMatch: Omit<TopicMatchView, 'reason'> | null;
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
   * @param settings 공용 설정 (주제 매칭 기준)
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
    private readonly settings: SettingsService,
  ) {}

  /**
   * [영상 불러오기]: 영상만 불러와 순위를 매긴다. 초안은 쓰지 않는다.
   * 초안은 ② 영상 선택에서 [초안 작성]을 누를 때 그 영상 하나만 쓴다
   * (영상을 많이·무제한으로 불러와도 AI 비용이 들지 않게).
   * 유튜브 할당량을 아끼려고 최근에 검색했으면 저장된 목록을, 아니면 새로 올라온 영상만 검색한다 (VideosService.loadForTopic).
   * @param topicId 주제 ID
   * @param force [새로 검색]: 기준 시간을 무시하고 검색한다
   */
  async load(topicId: number, force = false): Promise<LoadResult> {
    return this.videos.loadForTopic(topicId, { force });
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
    const [analysis, draft, attempts, threshold] = await Promise.all([
      this.analysis.latest(topicId, videoId),
      this.drafts.findOne({
        where: { topicId, videoId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.attempts.find({
        select: {
          id: true,
          draftId: true,
          status: true,
          failedStep: true,
          failureReason: true,
          startedAt: true,
          commentUrl: true,
          commentText: true,
        },
        where: { videoId },
        order: { startedAt: 'DESC', id: 'DESC' },
        take: 20,
      }),
      this.settings.get(TOPIC_MATCH_THRESHOLD),
    ]);
    // 게시 완료·실패는 이 초안의 시도로 본다 (RD-27: 예전 초안의 기록은 새 초안의 상태에 넣지 않는다)
    const lastOfDraft = draft
      ? attempts.find((a) => a.draftId === draft.id)
      : undefined;
    const status = draft
      ? draftListStatus({
          state: draft.state,
          checkPassed: draft.checkPassed,
          posted: video.commented,
          lastPostFailed: lastOfDraft?.status === PostStatus.Failed,
        })
      : null;
    return {
      video,
      analysis,
      topicMatch: toTopicMatch(analysis, threshold),
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
    // 게시한 초안은 그대로 둔다 (게시 기록과 같은 글로 남게, RD-27). 더 달려면 새 초안을 쓴다
    if (await this.attempts.existsBy({ draftId, status: PostStatus.Success })) {
      throw new ConflictException(
        '게시한 초안은 고칠 수 없어요 · [새 초안 쓰고 한 번 더 달기]로 새로 써 주세요',
      );
    }
    const topic = await this.topics.findOrFail(draft.topicId);
    const analysis = draft.analysisId
      ? await this.dataSource
          .getRepository('VideoAnalysis')
          .findOneBy({ id: draft.analysisId })
      : null;
    // 다른 채널 영상이면 맨 앞의 광고 표시를 빼고 길이 등을 센다 (표시는 검사하지 않는다, RD-28)
    const [video, myChannels] = await Promise.all([
      this.dataSource.getRepository(Video).findOneBy({ id: draft.videoId }),
      this.profiles.myChannelIds(),
    ]);
    const disclosure = requiredDisclosure(
      topic.adDisclosure,
      !!video && myChannels.has(video.channelId),
    );
    // 같은 주제의 최근 초안과 너무 비슷하거나 말버릇이 겹치면 검사에서 걸린다 (RD-33)
    const recent = await recentDraftsOf(this.drafts, draft.topicId, draft.id);
    // 이 영상에 이미 단 댓글과 같은 글이면 검사에서 걸린다 (RD-27)
    const posted = await postedCommentsOf(this.attempts, draft.videoId);
    const report = this.checks.run(
      checkContextOf(
        text,
        topic,
        analysis as VideoAnalysis | null,
        disclosure,
        { recentTexts: recent.map((r) => r.text), posted },
      ),
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

    const [drafts, threshold] = await Promise.all([
      this.drafts.find({
        where: { id: In(latest.map((l) => l.id)) },
        // 초안을 쓸 때 쓴 분석 (주제 매칭 퍼센트)
        relations: { topic: true, video: true, analysis: true },
        order: { updatedAt: 'DESC', id: 'DESC' },
      }),
      this.settings.get(TOPIC_MATCH_THRESHOLD),
    ]);
    const [myChannels, attempts] = await Promise.all([
      this.profiles.myChannelIds(),
      // 초안마다 마지막 게시 시도와, 그 초안을 게시했으면 댓글 주소 (RD-27: 영상이 아니라 초안 단위)
      this.dataSource.query(
        `SELECT DISTINCT ON (draft_id) draft_id, status,
                EXISTS (SELECT 1 FROM post_attempt s WHERE s.draft_id = a.draft_id AND s.status = 'success') AS posted,
                (SELECT s.comment_url FROM post_attempt s WHERE s.draft_id = a.draft_id AND s.status = 'success'
                  ORDER BY s.started_at DESC, s.id DESC LIMIT 1) AS comment_url
         FROM post_attempt a WHERE draft_id = ANY($1)
         ORDER BY draft_id, started_at DESC, id DESC`,
        [drafts.map((d) => d.id)],
      ) as Promise<
        {
          draft_id: number;
          status: PostStatus;
          posted: boolean;
          comment_url: string | null;
        }[]
      >,
    ]);
    const postBy = new Map(attempts.map((a) => [Number(a.draft_id), a]));

    const q = filter.q?.trim().toLowerCase();
    const rows: DraftListRow[] = [];
    for (const d of drafts) {
      const post = postBy.get(d.id);
      const isMine = myChannels.has(d.video!.channelId);
      const status = draftListStatus({
        state: d.state,
        checkPassed: d.checkPassed,
        posted: post?.posted ?? false,
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
        topicMatch: listTopicMatch(d.analysis ?? null, threshold),
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

/**
 * 작업 목록 행의 매칭 값 (이유는 상세 창에서만 보인다)
 * @param analysis 초안을 쓸 때 쓴 분석
 * @param threshold 기준 퍼센트
 */
function listTopicMatch(
  analysis: VideoAnalysis | null,
  threshold: number,
): Omit<TopicMatchView, 'reason'> | null {
  const match = toTopicMatch(analysis, threshold);
  if (!match) return null;
  return {
    percent: match.percent,
    matched: match.matched,
    threshold: match.threshold,
  };
}
