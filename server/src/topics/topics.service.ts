import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PostQuotaService } from '../posting/post-quota.service.js';
import {
  Profile,
  type ProfileLoginStatus,
} from '../profiles/profile.entity.js';
import { DAILY_CAP_TOTAL } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { TopicProfile } from './topic-profile.entity.js';
import { Topic } from './topic.entity.js';
import type { CreateTopicDto, UpdateTopicDto } from './topic.schemas.js';

/** 주제 목록·상세에 보일 값 */
export interface TopicView extends Topic {
  /** 쓸 프로필 */
  profiles: { id: number; name: string; loginStatus: ProfileLoginStatus }[];
  /** 오늘(한국 시간) 이 주제로 게시한 수 */
  postedToday: number;
  /** 게시를 기다리는 초안 수 (검사 통과, 아직 댓글 안 단 영상) */
  pendingDrafts: number;
}

/** 주제(홍보 대상) 관리 */
@Injectable()
export class TopicsService {
  /**
   * @param repo 주제 저장소
   * @param topicProfiles 주제-프로필 연결 저장소
   * @param dataSource 트랜잭션·집계 쿼리용
   * @param quota 오늘 게시 수
   * @param settings 공용 설정 (전체 하루 상한)
   */
  constructor(
    @InjectRepository(Topic) private readonly repo: Repository<Topic>,
    @InjectRepository(TopicProfile)
    private readonly topicProfiles: Repository<TopicProfile>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly quota: PostQuotaService,
    private readonly settings: SettingsService,
  ) {}

  /** 주제 목록 (사이드바) */
  async list(): Promise<TopicView[]> {
    const topics = await this.repo.find({ order: { id: 'ASC' } });
    return this.toViews(topics);
  }

  /**
   * 주제 하나
   * @param id 주제 ID
   */
  async get(id: number): Promise<TopicView> {
    const [view] = await this.toViews([await this.findOrFail(id)]);
    return view;
  }

  /**
   * 주제 만들기
   * @param dto 주제 설정과 쓸 프로필
   */
  async create(dto: CreateTopicDto): Promise<TopicView> {
    await this.assertCapWithinTotal(dto.dailyCap);
    await this.assertProfilesExist(dto.profileIds);
    const { profileIds, ...fields } = dto;
    const id = await this.dataSource.transaction(async (m) => {
      const saved = await m.save(Topic, m.create(Topic, fields));
      await this.replaceProfiles(
        m.getRepository(TopicProfile),
        saved.id,
        profileIds,
      );
      return saved.id;
    });
    return this.get(id);
  }

  /**
   * 주제 고치기 (보낸 값만)
   * @param id 주제 ID
   * @param dto 바꿀 값
   */
  async update(id: number, dto: UpdateTopicDto): Promise<TopicView> {
    const topic = await this.findOrFail(id);
    const { profileIds, ...fields } = dto;

    const minLength = fields.minLength ?? topic.minLength;
    const maxLength = fields.maxLength ?? topic.maxLength;
    if (minLength > maxLength) {
      throw new BadRequestException([
        'minLength: 최소 글자 수가 최대 글자 수보다 클 수 없어요',
      ]);
    }
    if (fields.dailyCap !== undefined)
      await this.assertCapWithinTotal(fields.dailyCap);
    if (profileIds) await this.assertProfilesExist(profileIds);

    await this.dataSource.transaction(async (m) => {
      if (Object.keys(fields).length > 0) await m.update(Topic, id, fields);
      if (profileIds)
        await this.replaceProfiles(
          m.getRepository(TopicProfile),
          id,
          profileIds,
        );
    });
    return this.get(id);
  }

  /**
   * 주제 지우기. 영상 목록·분석·초안은 함께 지워지고, 게시 기록은 남는다(주제 칸만 비움).
   * @param id 주제 ID
   */
  async remove(id: number): Promise<{ id: number }> {
    await this.findOrFail(id);
    await this.repo.delete(id);
    return { id };
  }

  /**
   * 주제 하나를 찾고, 없으면 404
   * @param id 주제 ID
   */
  async findOrFail(id: number): Promise<Topic> {
    const topic = await this.repo.findOneBy({ id });
    if (!topic)
      throw new NotFoundException(
        '주제를 찾을 수 없어요 · 목록을 새로 고쳐 주세요',
      );
    return topic;
  }

  /**
   * 주제가 쓸 프로필 목록 (자동 배정 후보)
   * @param topicId 주제 ID
   */
  async profilesOf(topicId: number): Promise<Profile[]> {
    const links = await this.topicProfiles.find({
      where: { topicId },
      relations: { profile: true },
      order: { profileId: 'ASC' },
    });
    return links.map((l) => l.profile).filter((p): p is Profile => !!p);
  }

  /** 주제 상한이 전체 하루 상한을 넘지 않는지 */
  private async assertCapWithinTotal(cap: number): Promise<void> {
    const total = await this.settings.get(DAILY_CAP_TOTAL);
    if (cap > total) {
      throw new BadRequestException([
        `dailyCap: 주제 하루 상한은 전체 하루 상한(${total})보다 클 수 없어요`,
      ]);
    }
  }

  /** 넘어온 프로필 ID가 모두 있는지 */
  private async assertProfilesExist(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.dataSource
      .getRepository(Profile)
      .countBy({ id: In(ids) });
    if (found !== new Set(ids).size) {
      throw new BadRequestException([
        'profileIds: 없는 프로필이 섞여 있어요 · 계정 관리에서 확인해 주세요',
      ]);
    }
  }

  /** 주제의 프로필 연결을 통째로 바꾼다 */
  private async replaceProfiles(
    repo: Repository<TopicProfile>,
    topicId: number,
    ids: number[],
  ): Promise<void> {
    await repo.delete({ topicId });
    const unique = [...new Set(ids)];
    if (unique.length > 0)
      await repo.insert(unique.map((profileId) => ({ topicId, profileId })));
  }

  /** 목록에 필요한 값을 붙인다 */
  private async toViews(topics: Topic[]): Promise<TopicView[]> {
    if (topics.length === 0) return [];
    const ids = topics.map((t) => t.id);
    const [links, today, pending] = await Promise.all([
      this.topicProfiles.find({
        where: { topicId: In(ids) },
        relations: { profile: true },
        order: { profileId: 'ASC' },
      }),
      this.quota.today(),
      this.pendingDraftCounts(ids),
    ]);
    return topics.map((t) => ({
      ...t,
      profiles: links
        .filter((l) => l.topicId === t.id && l.profile)
        .map((l) => ({
          id: l.profile!.id,
          name: l.profile!.name,
          loginStatus: l.profile!.loginStatus,
        })),
      postedToday: today.byTopic[t.id] ?? 0,
      pendingDrafts: pending.get(t.id) ?? 0,
    }));
  }

  /**
   * 주제별 게시 대기 초안 수.
   * 영상마다 가장 최근 초안만 보고, 그 초안이 검사를 통과했고 아직 댓글을 안 단 것만 센다.
   * (다른 채널 영상은 광고 표시 검사까지 통과해야 checkPassed다)
   */
  private async pendingDraftCounts(
    topicIds: number[],
  ): Promise<Map<number, number>> {
    const rows: { topic_id: number; n: string }[] = await this.dataSource.query(
      `
      SELECT d.topic_id, COUNT(*) AS n
      FROM (
        SELECT DISTINCT ON (topic_id, video_id) topic_id, video_id, state, check_passed
        FROM draft
        WHERE topic_id = ANY($1)
        ORDER BY topic_id, video_id, created_at DESC, id DESC
      ) d
      WHERE d.state = 'ready'
        AND d.check_passed
        AND NOT EXISTS (SELECT 1 FROM post_attempt a WHERE a.video_id = d.video_id AND a.status = 'success')
      GROUP BY d.topic_id
      `,
      [topicIds],
    );
    return new Map(rows.map((r) => [Number(r.topic_id), Number(r.n)]));
  }
}
