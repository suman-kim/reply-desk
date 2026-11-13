import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiError } from '../ai/ai-provider.js';
import { Topic } from '../topics/topic.entity.js';
import { Video } from '../videos/video.entity.js';
import { AnalysisService } from './analysis.service.js';
import { Draft, DraftState } from './draft.entity.js';
import { DraftingService } from './drafting.service.js';

/** 대기열의 일 하나 */
interface DraftTask {
  /** 채울 초안 행 (writing 상태로 먼저 만들어 둔다) */
  draftId: number;
  /** 주제 ID */
  topicId: number;
  /** 영상 ID */
  videoId: number;
  /** 분석부터 다시 할지 (없으면 최근 분석을 쓴다) */
  reanalyze: boolean;
}

/** 주제별 자동 작성 진행률 (① 버튼의 "초안 자동 작성 중 (2/5)") */
export interface DraftProgress {
  /** 이번 묶음의 영상 수 */
  total: number;
  /** 끝난 수 (성공·실패 모두) */
  done: number;
  /** 실패한 수 */
  failed: number;
  /** 아직 도는 중인지 */
  running: boolean;
  /** 지금 쓰는 영상 ID */
  currentVideoId: number | null;
  /** 마지막 실패 원인 (화면에 한 줄) */
  lastError: string | null;
  /** 시작 시각 */
  startedAt: Date;
  /** 끝난 시각 */
  finishedAt: Date | null;
}

/**
 * 초안 작성 대기열. 분석 → 작성 → 검사를 영상마다 차례로 한다.
 * - 한 번에 하나만: 로컬 GPU(Ollama)와 API 사용량 한도를 지키고, 순서대로 배지가 "준비됨"으로 바뀌게 한다
 * - 초안 행을 writing으로 먼저 만들어 ① 카드에 "초안 작성 중"이 바로 보이게 한다
 * - 서버가 다시 뜨면 writing으로 남은 행은 error로 바꾼다 (대기열은 메모리에만 있다)
 */
@Injectable()
export class DraftQueueService implements OnModuleInit {
  private readonly logger = new Logger(DraftQueueService.name);
  /** 기다리는 일 */
  private readonly tasks: DraftTask[] = [];
  /** 주제별 진행률 */
  private readonly progress = new Map<number, DraftProgress>();
  /** 일을 처리하는 중인지 */
  private working = false;
  /** 대기열이 빌 때 풀리는 약속 (테스트·종료용) */
  private idle: Promise<void> = Promise.resolve();
  private resolveIdle: () => void = () => {};

  /**
   * @param drafts 초안 저장소
   * @param topics 주제 저장소
   * @param videos 영상 저장소
   * @param analysis 영상 분석
   * @param drafting 초안 작성
   */
  constructor(
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    @InjectRepository(Topic) private readonly topics: Repository<Topic>,
    @InjectRepository(Video) private readonly videos: Repository<Video>,
    private readonly analysis: AnalysisService,
    private readonly drafting: DraftingService,
  ) {}

  /** 서버가 뜰 때: 지난번에 쓰다 멈춘 초안을 실패로 바꾼다 */
  async onModuleInit(): Promise<void> {
    const res = await this.drafts.update(
      { state: DraftState.Writing },
      {
        state: DraftState.Error,
        errorMessage:
          '서버가 다시 시작돼 작성이 멈췄어요 · [다시 생성]을 눌러 주세요',
      },
    );
    if (res.affected)
      this.logger.warn(`멈춘 초안 ${res.affected}개를 실패로 바꿨어요`);
  }

  /**
   * 영상들의 초안 작성을 대기열에 넣는다. 이미 쓰는 중인 영상은 건너뛴다.
   * @param topicId 주제 ID
   * @param videoIds 영상 ID 목록 (이 순서대로 쓴다)
   * @param opts.reanalyze 분석부터 다시 할지
   * @param opts.trackProgress 주제 진행률을 새로 셀지 ([영상 불러오기] 묶음)
   * @returns 새로 만든 writing 초안
   */
  async enqueue(
    topicId: number,
    videoIds: number[],
    opts: { reanalyze: boolean; trackProgress: boolean },
  ): Promise<Draft[]> {
    const busy = new Set(
      this.tasks.filter((t) => t.topicId === topicId).map((t) => t.videoId),
    );
    const targets = [...new Set(videoIds)].filter((id) => !busy.has(id));

    const created: Draft[] = [];
    for (const videoId of targets) {
      const row = await this.drafts.save(
        this.drafts.create({ topicId, videoId, state: DraftState.Writing }),
      );
      created.push(row);
      this.tasks.push({
        draftId: row.id,
        topicId,
        videoId,
        reanalyze: opts.reanalyze,
      });
    }

    if (opts.trackProgress) {
      this.progress.set(topicId, {
        total: created.length,
        done: 0,
        failed: 0,
        running: created.length > 0,
        currentVideoId: null,
        lastError: null,
        startedAt: new Date(),
        finishedAt: created.length > 0 ? null : new Date(),
      });
    }
    if (created.length > 0) this.kick();
    return created;
  }

  /**
   * 주제의 자동 작성 진행률. 한 번도 돌리지 않았으면 null
   * @param topicId 주제 ID
   */
  progressOf(topicId: number): DraftProgress | null {
    return this.progress.get(topicId) ?? null;
  }

  /** 대기열이 빌 때까지 기다린다 (테스트용) */
  whenIdle(): Promise<void> {
    return this.idle;
  }

  /** 처리 고리를 돌린다 (이미 돌고 있으면 그대로) */
  private kick(): void {
    if (this.working) return;
    this.working = true;
    this.idle = new Promise((resolve) => (this.resolveIdle = resolve));
    void this.loop();
  }

  /** 대기열이 빌 때까지 하나씩 처리한다 */
  private async loop(): Promise<void> {
    try {
      let task: DraftTask | undefined;
      while ((task = this.tasks[0])) {
        const p = this.progress.get(task.topicId);
        if (p?.running) p.currentVideoId = task.videoId;
        const error = await this.process(task);
        this.tasks.shift();
        if (p?.running) {
          p.done += 1;
          if (error) {
            p.failed += 1;
            p.lastError = error;
          }
          if (!this.tasks.some((t) => t.topicId === task!.topicId)) {
            p.running = false;
            p.currentVideoId = null;
            p.finishedAt = new Date();
          }
        }
      }
    } finally {
      this.working = false;
      this.resolveIdle();
    }
  }

  /**
   * 일 하나: 분석(필요하면) → 작성 → 검사 → 저장
   * @returns 실패하면 원인 한 줄, 성공하면 null
   */
  private async process(task: DraftTask): Promise<string | null> {
    try {
      const [topic, video] = await Promise.all([
        this.topics.findOneBy({ id: task.topicId }),
        this.videos.findOneBy({ id: task.videoId }),
      ]);
      if (!topic || !video)
        throw new NotFoundException('주제나 영상이 지워졌어요');

      const analysis =
        (!task.reanalyze && (await this.analysis.latest(topic.id, video.id))) ||
        (await this.analysis.analyze(topic, video));
      const written = await this.drafting.write(topic, video, analysis);

      await this.drafts.update(task.draftId, {
        state: DraftState.Ready,
        analysisId: analysis.id,
        text: written.text,
        aiText: written.text,
        reasons: written.reasons,
        edited: false,
        checkResults: written.report.results,
        checkPassed: written.report.passed,
        provider: written.provider,
        model: written.model,
        errorMessage: null,
      });
      return null;
    } catch (err) {
      const message =
        err instanceof AiError || err instanceof NotFoundException
          ? err.message
          : `초안을 쓰지 못했어요 (${(err as Error)?.message ?? err}) · [다시 생성]을 눌러 주세요`;
      if (!(err instanceof AiError))
        this.logger.error(`draft #${task.draftId} 실패`, err as Error);
      await this.drafts
        .update(
          { id: task.draftId, state: In([DraftState.Writing]) },
          { state: DraftState.Error, errorMessage: message },
        )
        .catch(() => undefined);
      return message;
    }
  }
}
