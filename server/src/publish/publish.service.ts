import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProfileLockService } from '../browser/profile-lock.service.js';
import {
  YOUTUBE_BROWSER,
  type YoutubeBrowser,
} from '../browser/youtube-browser.js';
import type { Env } from '../config/env.schema.js';
import { Draft, DraftState } from '../drafts/draft.entity.js';
import type { StepView } from '../events/app-events.js';
import { EventsService } from '../events/events.service.js';
import {
  PostAttempt,
  PostStatus,
  PostStep,
} from '../posting/post-attempt.entity.js';
import { PostQuotaService } from '../posting/post-quota.service.js';
import { ProfileLoginService } from '../profiles/profile-login.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { PostGuardService } from '../rules/post-guard.service.js';
import { POSTING_HEADLESS } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { VideosService } from '../videos/videos.service.js';
import {
  buildStepViews,
  runPostSteps,
  type PostContext,
  type PostStepHandler,
} from './post-steps.js';

/** 게시 중인 일의 지금 상태 (메모리) */
interface LiveRun {
  /** 주제 ID (이벤트를 그 주제 화면에만 보낸다) */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 지금 단계 */
  step: PostStep;
  /** 친 글자 수 */
  typed: number;
  /** 전체 글자 수 */
  total: number;
  /** 끝났는지 */
  finished: boolean;
  /** 크롬 화면 미리보기 (jpeg, 마지막은 png) */
  preview: Buffer | null;
  /** 미리보기 번호 (새로 찍을 때마다 1씩) */
  previewSeq: number;
  /** 입력 진행을 마지막으로 알린 시각 (너무 자주 보내지 않게) */
  typingEmittedAt: number;
}

export type { StepView };

/** 게시 상태 (③ 칸) */
export interface AttemptView {
  /** 게시 시도 ID */
  id: number;
  /** 결과 */
  status: PostStatus;
  /** 프로필 이름 */
  profileName: string | null;
  /** 진행 5단계 */
  steps: StepView[];
  /** 입력 진행 (한 글자씩 입력 중 (34/91자)) */
  typing: { typed: number; total: number } | null;
  /** 실패 원인 */
  failureReason: string | null;
  /** 게시 결과 캡처가 있는지 (성공: 게시된 댓글 화면, 실패: 실패 순간) */
  hasCapture: boolean;
  /** 미리보기가 있는지 */
  hasPreview: boolean;
  /** 댓글 주소 ([댓글 보기]) */
  commentUrl: string | null;
  /** 시작 시각 */
  startedAt: Date;
  /** 끝난 시각 */
  finishedAt: Date | null;
}

/** 미리보기를 찍는 간격 */
const PREVIEW_INTERVAL_MS = 1_500;
/** 입력 진행을 알리는 최소 간격 (글자마다 보내면 너무 잦다) */
const TYPING_EMIT_MS = 150;
/** 끝난 일의 상태·미리보기를 메모리에 두는 시간 */
const LIVE_KEEP_MS = 10 * 60 * 1000;

/**
 * [댓글 달기]: 규칙을 다시 보고, 게시 중 행을 넣고, 크롬으로 5단계를 돌린다.
 * 시작(검사 + 행 넣기)은 한 번에 하나씩 해서 하루 상한을 동시에 넘기지 않는다.
 * 같은 영상 동시 게시·영상당 1개는 DB 부분 유일 인덱스가 마지막으로 막는다.
 */
@Injectable()
export class PublishService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishService.name);
  /** 게시 중·최근 끝난 일의 상태 */
  private readonly live = new Map<number, LiveRun>();
  /** 시작을 한 번에 하나씩 하기 위한 줄 */
  private startChain: Promise<unknown> = Promise.resolve();
  /** 돌고 있는 게시 (테스트·종료 때 기다린다) */
  private readonly running = new Set<Promise<void>>();
  /** 단계 목록 (테스트에서 바꿔 넣는다) */
  steps?: PostStepHandler[];

  /**
   * @param attempts 게시 기록 저장소
   * @param drafts 초안 저장소
   * @param guard 게시 판단
   * @param videos 영상 서비스
   * @param profiles 프로필 서비스
   * @param profileLogin 로그인이 풀린 프로필 표시
   * @param settings 공용 설정 (창 숨기기)
   * @param lock 프로필 잠금
   * @param browser 크롬 조작
   * @param config 환경 변수 (캡처 폴더)
   * @param events 실시간 이벤트 (③ 칸 진행·미리보기, 헤더 카운터)
   * @param quota 오늘 게시 수 (게시가 끝나면 헤더에 알린다)
   */
  constructor(
    @InjectRepository(PostAttempt)
    private readonly attempts: Repository<PostAttempt>,
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    private readonly guard: PostGuardService,
    private readonly videos: VideosService,
    private readonly profiles: ProfilesService,
    private readonly profileLogin: ProfileLoginService,
    private readonly settings: SettingsService,
    private readonly lock: ProfileLockService,
    @Inject(YOUTUBE_BROWSER) private readonly browser: YoutubeBrowser,
    private readonly config: ConfigService<Env, true>,
    private readonly events: EventsService,
    private readonly quota: PostQuotaService,
  ) {}

  /** 서버가 뜰 때: 지난번에 게시하다 멈춘 행을 실패로 바꾼다 */
  async onModuleInit(): Promise<void> {
    const res = await this.attempts.update(
      { status: PostStatus.Running },
      {
        status: PostStatus.Failed,
        failureReason:
          '서버가 다시 시작돼 게시가 멈췄어요 · 유튜브에서 댓글이 달렸는지 직접 확인해 주세요',
        finishedAt: new Date(),
      },
    );
    if (res.affected)
      this.logger.warn(`멈춘 게시 ${res.affected}건을 실패로 바꿨어요`);
  }

  /** 서버가 꺼질 때: 돌고 있는 게시가 끝나기를 기다린다 */
  async onModuleDestroy(): Promise<void> {
    await this.whenIdle();
  }

  /** 돌고 있는 게시가 모두 끝날 때까지 (테스트용) */
  async whenIdle(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled(this.running);
  }

  /**
   * [댓글 달기]를 시작한다. 막히면 409와 차단 사유 한 줄.
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   * @param profileId 고른 프로필 (없으면 자동 배정)
   */
  async start(
    topicId: number,
    videoId: number,
    profileId: number | null,
  ): Promise<AttemptView> {
    // 시작은 한 번에 하나씩 (하루 상한·자동 배정이 겹치지 않게)
    const started = this.startChain.then(() =>
      this.begin(topicId, videoId, profileId),
    );
    this.startChain = started.catch(() => undefined);
    return started;
  }

  /**
   * 게시 상태
   * @param attemptId 게시 시도 ID
   */
  async status(attemptId: number): Promise<AttemptView> {
    const attempt = await this.attempts.findOne({
      where: { id: attemptId },
      relations: { profile: true },
    });
    if (!attempt)
      throw new NotFoundException(
        '게시 기록을 찾을 수 없어요 · 목록을 새로 고쳐 주세요',
      );
    return this.toView(attempt);
  }

  /**
   * 크롬 화면 미리보기 (게시 중·최근)
   * @param attemptId 게시 시도 ID
   */
  preview(attemptId: number): Buffer {
    const image = this.live.get(attemptId)?.preview;
    if (!image)
      throw new NotFoundException(
        '아직 크롬 화면이 없어요 · 잠시 뒤 다시 불러와 주세요',
      );
    return image;
  }

  /**
   * 실패 캡처 파일 경로
   * @param attemptId 게시 시도 ID
   */
  async capturePath(attemptId: number): Promise<string> {
    const attempt = await this.attempts.findOneBy({ id: attemptId });
    if (!attempt?.screenshotPath)
      throw new NotFoundException('이 게시에는 캡처가 없어요');
    return attempt.screenshotPath;
  }

  /** 검사 → 잠금 → 게시 중 행 → 뒤에서 5단계 */
  private async begin(
    topicId: number,
    videoId: number,
    profileId: number | null,
  ): Promise<AttemptView> {
    const check = await this.guard.check(topicId, videoId, profileId);
    if (!check.allowed || !check.profile) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Blocked',
        code: check.block?.code ?? 'profile_unavailable',
        message: check.block?.message ?? '게시할 프로필이 없어요',
      });
    }
    const [video, profile, draft] = await Promise.all([
      this.videos.getForTopic(topicId, videoId),
      this.profiles.findOrFail(check.profile.id),
      this.drafts.findOneOrFail({
        where: { topicId, videoId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    ]);
    if (draft.state !== DraftState.Ready || !draft.checkPassed) {
      throw new ConflictException(
        '초안이 게시할 수 있는 상태가 아니에요 · 다시 불러와 주세요',
      );
    }

    this.lock.acquire(profile.id, '게시');
    let attempt: PostAttempt;
    try {
      attempt = await this.attempts.save(
        this.attempts.create({
          draftId: draft.id,
          topicId,
          videoId,
          profileId: profile.id,
          commentText: draft.text,
          status: PostStatus.Running,
        }),
      );
    } catch (err) {
      this.lock.release(profile.id);
      if (
        err instanceof QueryFailedError &&
        /uq_post_attempt_video/.test(err.message)
      ) {
        throw new ConflictException(
          '이 영상은 지금 게시하는 중이거나 이미 댓글을 달았어요 · 영상당 1개만 달 수 있어요',
        );
      }
      throw err;
    }

    const live: LiveRun = {
      topicId,
      videoId,
      step: PostStep.OpenProfile,
      typed: 0,
      total: [...draft.text].length,
      finished: false,
      preview: null,
      previewSeq: 0,
      typingEmittedAt: 0,
    };
    this.live.set(attempt.id, live);
    const headless = await this.settings.get(POSTING_HEADLESS);
    const run = this.execute(attempt.id, profile.id, {
      browser: this.browser,
      profileDir: profile.folderPath,
      headless,
      youtubeId: video.youtubeId,
      text: draft.text,
      page: null,
      commentUrl: null,
      onTyped: (typed, total) => {
        Object.assign(live, { typed, total });
        const now = Date.now();
        if (typed === total || now - live.typingEmittedAt >= TYPING_EMIT_MS) {
          live.typingEmittedAt = now;
          this.emitProgress(attempt.id);
        }
      },
    }).finally(() => this.running.delete(run));
    this.running.add(run);

    return this.status(attempt.id);
  }

  /**
   * 뒤에서 5단계를 돌리고 결과를 남긴다.
   * @param attemptId 게시 시도 ID
   * @param profileId 프로필 ID (잠금 풀기·로그인 풀림 표시)
   * @param ctx 단계 값
   */
  private async execute(
    attemptId: number,
    profileId: number,
    ctx: PostContext,
  ): Promise<void> {
    const live = this.live.get(attemptId)!;
    const timer = setInterval(() => {
      ctx.page
        ?.screenshot('jpeg')
        .then((img) => this.setPreview(attemptId, img))
        .catch(() => undefined);
    }, PREVIEW_INTERVAL_MS);

    try {
      const outcome = await runPostSteps(
        ctx,
        (step) => {
          live.step = step;
          this.emitProgress(attemptId);
        },
        this.steps,
      );
      clearInterval(timer);
      const lastImage = await ctx.page?.screenshot('png').catch(() => null);
      if (lastImage) this.setPreview(attemptId, lastImage);

      if (outcome.ok) {
        // 내 댓글을 찾은 뒤 그 댓글을 화면 가운데에 둔 채 찍은 화면이라, 게시 증거로 로컬에 남긴다
        const screenshotPath = lastImage
          ? await this.saveCapture(attemptId, 'success', lastImage)
          : null;
        await this.attempts.update(attemptId, {
          status: PostStatus.Success,
          commentUrl: outcome.commentUrl,
          screenshotPath,
          finishedAt: new Date(),
        });
        this.emitFinished(
          attemptId,
          PostStatus.Success,
          null,
          null,
          !!screenshotPath,
          outcome.commentUrl,
        );
        this.events.emit({
          type: 'quota.updated',
          ...(await this.quota.today()),
        });
      } else {
        const screenshotPath = lastImage
          ? await this.saveCapture(attemptId, outcome.step, lastImage)
          : null;
        await this.attempts.update(attemptId, {
          status: PostStatus.Failed,
          failedStep: outcome.step,
          failureReason: outcome.reason,
          screenshotPath,
          finishedAt: new Date(),
        });
        this.emitFinished(
          attemptId,
          PostStatus.Failed,
          outcome.step,
          outcome.reason,
          !!screenshotPath,
          null,
        );
        if (outcome.loginLost) await this.profileLogin.markLoginLost(profileId);
      }
    } catch (err) {
      this.logger.error(`게시 #${attemptId} 기록 실패`, err as Error);
      const reason =
        '게시 결과를 남기지 못했어요 · 유튜브에서 직접 확인해 주세요';
      await this.attempts
        .update(attemptId, {
          status: PostStatus.Failed,
          failureReason: reason,
          finishedAt: new Date(),
        })
        .catch(() => undefined);
      this.emitFinished(
        attemptId,
        PostStatus.Failed,
        live.step,
        reason,
        false,
        null,
      );
    } finally {
      clearInterval(timer);
      await ctx.page?.close().catch(() => undefined);
      this.lock.release(profileId);
      live.finished = true;
      setTimeout(() => this.live.delete(attemptId), LIVE_KEEP_MS).unref();
    }
  }

  /** 새 미리보기를 두고 화면에 알린다 */
  private setPreview(attemptId: number, image: Buffer): void {
    const live = this.live.get(attemptId);
    if (!live) return;
    live.preview = image;
    live.previewSeq += 1;
    this.events.emit({
      type: 'post.preview',
      attemptId,
      topicId: live.topicId,
      seq: live.previewSeq,
    });
  }

  /** 진행 단계·입력 글자 수를 화면에 알린다 */
  private emitProgress(attemptId: number): void {
    const live = this.live.get(attemptId);
    if (!live) return;
    this.events.emit({
      type: 'post.progress',
      attemptId,
      topicId: live.topicId,
      videoId: live.videoId,
      steps: buildStepViews(PostStatus.Running, live.step),
      typing: { typed: live.typed, total: live.total },
    });
  }

  /**
   * 게시가 끝났음을 화면에 알린다
   * @param attemptId 게시 시도 ID
   * @param status 결과
   * @param failedStep 실패한 단계
   * @param failureReason 실패 원인
   * @param hasCapture 게시 결과 캡처가 있는지 (성공·실패)
   * @param commentUrl 댓글 주소
   */
  private emitFinished(
    attemptId: number,
    status: PostStatus,
    failedStep: PostStep | null,
    failureReason: string | null,
    hasCapture: boolean,
    commentUrl: string | null,
  ): void {
    const live = this.live.get(attemptId);
    if (!live) return;
    this.events.emit({
      type: 'post.finished',
      attemptId,
      topicId: live.topicId,
      videoId: live.videoId,
      status,
      steps: buildStepViews(status, failedStep),
      failureReason,
      hasCapture,
      commentUrl,
    });
  }

  /**
   * 게시 결과 화면 캡처를 파일로 남긴다 (SCREENSHOTS_DIR/attempt-<번호>-<이름>.png)
   * @param attemptId 게시 시도 ID
   * @param name 파일 이름 끝: 성공이면 'success', 실패면 멈춘 단계
   * @param image 캡처 (png)
   * @returns 저장한 경로 (저장하지 못하면 null)
   */
  private async saveCapture(
    attemptId: number,
    name: PostStep | 'success',
    image: Buffer,
  ): Promise<string | null> {
    try {
      const dir = this.config.get('SCREENSHOTS_DIR', { infer: true });
      await mkdir(dir, { recursive: true });
      const file = join(dir, `attempt-${attemptId}-${name}.png`);
      await writeFile(file, image);
      return file;
    } catch (err) {
      this.logger.warn(`캡처 저장 실패: ${(err as Error).message}`);
      return null;
    }
  }

  /** 화면용 값으로 바꾼다 */
  private toView(a: PostAttempt): AttemptView {
    const live = this.live.get(a.id);
    const current =
      a.status === PostStatus.Failed ? a.failedStep : (live?.step ?? null);
    const steps = buildStepViews(a.status, current);
    return {
      id: a.id,
      status: a.status,
      profileName: a.profile?.name ?? null,
      steps,
      typing: live ? { typed: live.typed, total: live.total } : null,
      failureReason: a.failureReason,
      hasCapture: !!a.screenshotPath,
      hasPreview: !!live?.preview,
      commentUrl: a.commentUrl,
      startedAt: a.startedAt,
      finishedAt: a.finishedAt,
    };
  }
}
