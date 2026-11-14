import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Draft } from '../drafts/draft.entity.js';
import { PostAttempt, PostStatus } from '../posting/post-attempt.entity.js';
import { PostQuotaService } from '../posting/post-quota.service.js';
import type { Profile } from '../profiles/profile.entity.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { TopicStatus } from '../topics/topic.entity.js';
import { TopicsService } from '../topics/topics.service.js';
import { VideosService } from '../videos/videos.service.js';
import { findBlockReason, type BlockReason } from './block-rules.js';
import { pickNextProfile } from './profile-assigner.js';

/** [댓글 달기] 판단 결과 (③ 칸) */
export interface PostCheckResult {
  /** 버튼을 열지 */
  allowed: boolean;
  /** 막힌 사유 (열리면 null) */
  block: BlockReason | null;
  /** 게시할 프로필 ("이번 차례: 유튜브2"). 없으면 null */
  profile: { id: number; name: string } | null;
  /** 자동 배정으로 고른 프로필인지 */
  autoAssigned: boolean;
  /** 오늘 게시 현황 (헤더 카운터) */
  today: { posted: number; cap: number; topicPosted: number; topicCap: number };
}

/**
 * 게시 가능 여부 판단. DB에서 값을 모아 block-rules의 규칙에 넘긴다.
 * 실제 게시(다음 작업)도 시작 직전에 이 판단을 다시 부르고, DB의 부분 유일 인덱스가 마지막으로 막는다.
 */
@Injectable()
export class PostGuardService {
  /**
   * @param drafts 초안 저장소
   * @param attempts 게시 기록 저장소
   * @param topics 주제 서비스
   * @param videos 영상 서비스
   * @param profiles 프로필 서비스
   * @param quota 오늘 게시 수
   */
  constructor(
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    private readonly topics: TopicsService,
    private readonly videos: VideosService,
    private readonly profiles: ProfilesService,
    private readonly quota: PostQuotaService,
  ) {}

  /**
   * 이 영상에 지금 댓글을 달 수 있는지 본다.
   * @param topicId 주제 ID
   * @param videoId 내부 영상 ID (고르지 않았으면 null)
   * @param profileId 고른 프로필 ID (없으면 자동 배정)
   */
  async check(
    topicId: number,
    videoId: number | null,
    profileId: number | null,
  ): Promise<PostCheckResult> {
    const topic = await this.topics.findOrFail(topicId);
    const video = videoId
      ? await this.videos.getForTopic(topicId, videoId)
      : null;
    const today = await this.quota.today();

    const { profile, autoAssigned } = profileId
      ? {
          profile: await this.profiles.findOrFail(profileId),
          autoAssigned: false,
        }
      : { profile: await this.nextProfile(topicId), autoAssigned: true };

    const draft = video
      ? await this.drafts.findOne({
          where: { topicId, videoId: video.id },
          order: { createdAt: 'DESC', id: 'DESC' },
        })
      : null;
    const postingNow = video
      ? await this.attempts.existsBy({
          videoId: video.id,
          status: PostStatus.Running,
        })
      : false;

    const topicPosted = today.byTopic[topicId] ?? 0;
    const block = findBlockReason({
      video: video ? { id: video.id, isMine: video.isMine } : null,
      draft: draft
        ? {
            state: draft.state,
            checkPassed: draft.checkPassed,
            text: draft.text,
          }
        : null,
      alreadyCommented: video?.commented ?? false,
      postingNow,
      total: { posted: today.posted, cap: today.cap },
      topic: {
        name: topic.name,
        active: topic.status === TopicStatus.Active,
        posted: topicPosted,
        cap: topic.dailyCap,
        adDisclosure: topic.adDisclosure,
      },
      profile: profile
        ? { name: profile.name, loginStatus: profile.loginStatus }
        : null,
    });

    return {
      allowed: block === null,
      block,
      profile: profile ? { id: profile.id, name: profile.name } : null,
      autoAssigned,
      today: {
        posted: today.posted,
        cap: today.cap,
        topicPosted,
        topicCap: topic.dailyCap,
      },
    };
  }

  /**
   * 자동 배정: 주제가 쓸 프로필 중 이번 차례
   * @param topicId 주제 ID
   */
  async nextProfile(topicId: number): Promise<Profile | null> {
    const candidates = await this.topics.profilesOf(topicId);
    if (candidates.length === 0) return null;
    const rows: { profileId: number; last: Date }[] = await this.attempts
      .createQueryBuilder('a')
      .select('a.profile_id', 'profileId')
      .addSelect('MAX(a.started_at)', 'last')
      .where({
        profileId: In(candidates.map((p) => p.id)),
        status: PostStatus.Success,
      })
      .groupBy('a.profile_id')
      .getRawMany();
    return pickNextProfile(
      candidates,
      new Map(rows.map((r) => [Number(r.profileId), new Date(r.last)])),
    );
  }
}
