import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Env } from '../config/env.schema.js';
import { kstDayRange } from '../common/kst.js';
import { PostAttempt, PostStatus } from '../posting/post-attempt.entity.js';
import { TopicProfile } from '../topics/topic-profile.entity.js';
import { Profile } from './profile.entity.js';
import {
  slugFromName,
  type CreateProfileDto,
  type UpdateProfileDto,
} from './profile.schemas.js';

/** 프로필 카드에 보일 값 */
export interface ProfileView extends Profile {
  /** 오늘(한국 시간) 이 프로필로 게시한 수 */
  postedToday: number;
  /** 이 프로필을 쓰는 주제 */
  topics: { id: number; name: string }[];
}

/**
 * 크롬 프로필 관리.
 * 로그인 확인(크롬을 열어 채널 ID·화면 언어 읽기)은 Playwright 작업에서 이 서비스의 markChecked를 부른다.
 */
@Injectable()
export class ProfilesService {
  /**
   * @param repo 프로필 저장소
   * @param topicProfiles 주제-프로필 연결 저장소
   * @param attempts 게시 기록 저장소 (오늘 게시 수)
   * @param config 환경 변수 (PROFILES_ROOT)
   */
  constructor(
    @InjectRepository(Profile) private readonly repo: Repository<Profile>,
    @InjectRepository(TopicProfile)
    private readonly topicProfiles: Repository<TopicProfile>,
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 프로필 목록 (카드에 필요한 값 포함) */
  async list(): Promise<ProfileView[]> {
    const profiles = await this.repo.find({ order: { id: 'ASC' } });
    return this.withStats(profiles);
  }

  /**
   * 프로필 하나
   * @param id 프로필 ID
   */
  async get(id: number): Promise<ProfileView> {
    const [view] = await this.withStats([await this.findOrFail(id)]);
    return view;
  }

  /**
   * 프로필 만들기: DB에 넣고 크롬 프로필 폴더를 만든다.
   * 로그인은 사람이 크롬 창에서 직접 한다 (다음 작업의 [크롬 열고 직접 로그인]).
   * @param dto 이름과 폴더 이름
   */
  async create(dto: CreateProfileDto): Promise<ProfileView> {
    const count = await this.repo.count();
    const slug = dto.slug ?? slugFromName(dto.name, count + 1);
    await this.assertUnique(dto.name, slug);

    const folderPath = join(
      this.config.get('PROFILES_ROOT', { infer: true }),
      slug,
    );
    await mkdir(folderPath, { recursive: true });

    const saved = await this.repo.save(
      this.repo.create({ name: dto.name, slug, folderPath }),
    );
    return this.get(saved.id);
  }

  /**
   * 이름 바꾸기
   * @param id 프로필 ID
   * @param dto 새 이름
   */
  async update(id: number, dto: UpdateProfileDto): Promise<ProfileView> {
    const profile = await this.findOrFail(id);
    if (
      dto.name !== profile.name &&
      (await this.repo.existsBy({ name: dto.name }))
    ) {
      throw new ConflictException(
        `"${dto.name}" 이름을 쓰는 프로필이 이미 있어요`,
      );
    }
    await this.repo.update(id, { name: dto.name });
    return this.get(id);
  }

  /**
   * 프로필 지우기. 크롬 폴더(로그인 정보)는 지우지 않고 남긴다. 다시 등록하면 그대로 쓸 수 있다.
   * 게시 기록은 남고 프로필 칸만 비워진다.
   * @param id 프로필 ID
   */
  async remove(id: number): Promise<{ id: number; folderPath: string }> {
    const profile = await this.findOrFail(id);
    await this.repo.delete(id);
    return { id, folderPath: profile.folderPath };
  }

  /**
   * 등록한 프로필들의 채널 ID = 게시가 허용되는 '내 채널' 목록
   */
  async myChannelIds(): Promise<Set<string>> {
    const rows = await this.repo.find({ select: { channelId: true } });
    return new Set(
      rows.map((r) => r.channelId).filter((c): c is string => !!c),
    );
  }

  /**
   * 프로필 하나를 찾고, 없으면 404
   * @param id 프로필 ID
   */
  async findOrFail(id: number): Promise<Profile> {
    const profile = await this.repo.findOneBy({ id });
    if (!profile)
      throw new NotFoundException(
        '프로필을 찾을 수 없어요 · 목록을 새로 고쳐 주세요',
      );
    return profile;
  }

  /** 이름·폴더 이름이 겹치지 않는지 본다 */
  private async assertUnique(name: string, slug: string): Promise<void> {
    if (await this.repo.existsBy({ name })) {
      throw new ConflictException(`"${name}" 이름을 쓰는 프로필이 이미 있어요`);
    }
    if (await this.repo.existsBy({ slug })) {
      throw new ConflictException(
        `"${slug}" 폴더를 쓰는 프로필이 이미 있어요 · 다른 폴더 이름을 적어 주세요`,
      );
    }
  }

  /** 카드에 필요한 오늘 게시 수와 쓰는 주제를 붙인다 */
  private async withStats(profiles: Profile[]): Promise<ProfileView[]> {
    if (profiles.length === 0) return [];
    const ids = profiles.map((p) => p.id);
    const { start, end } = kstDayRange();

    const counts: { profileId: number; n: string }[] = await this.attempts
      .createQueryBuilder('a')
      .select('a.profile_id', 'profileId')
      .addSelect('COUNT(*)', 'n')
      .where('a.profile_id IN (:...ids)', { ids })
      .andWhere('a.status = :s', { s: PostStatus.Success })
      .andWhere('a.started_at >= :start AND a.started_at < :end', {
        start,
        end,
      })
      .groupBy('a.profile_id')
      .getRawMany();
    const countBy = new Map(
      counts.map((c) => [Number(c.profileId), Number(c.n)]),
    );

    const links = await this.topicProfiles.find({
      where: ids.map((profileId) => ({ profileId })),
      relations: { topic: true },
    });

    return profiles.map((p) => ({
      ...p,
      postedToday: countBy.get(p.id) ?? 0,
      topics: links
        .filter((l) => l.profileId === p.id && l.topic)
        .map((l) => ({ id: l.topic!.id, name: l.topic!.name })),
    }));
  }
}
