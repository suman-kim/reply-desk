import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import {
  CheckRunnerService,
  type CheckReport,
} from '../checks/check-runner.service.js';
import type { CheckContext } from '../checks/check.types.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import { DRAFT_SYSTEM, buildDraftPrompt, draftSchema } from './draft-prompt.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/** 작성 제한 시간 */
const DRAFT_TIMEOUT_MS = 120_000;
/** 검사에 걸리면 고칠 점을 붙여 다시 쓰는 최대 횟수 (첫 시도 포함) */
export const MAX_DRAFT_ATTEMPTS = 2;

/** 작성 결과 */
export interface WrittenDraft {
  /** 댓글 글 */
  text: string;
  /** 이렇게 쓴 이유 */
  reasons: string[];
  /** 자동 검사 결과 */
  report: CheckReport;
  /** 쓴 제공자 */
  provider: string;
  /** 쓴 모델 */
  model: string;
  /** 몇 번 만에 썼는지 */
  attempts: number;
}

/**
 * 검사에 필요한 값을 만든다 (초안 작성·사람이 고칠 때 공통).
 * @param text 검사할 글
 * @param topic 주제
 * @param analysis 영상 분석 (없으면 장면 언급 검사가 실패한다)
 */
export function checkContextOf(
  text: string,
  topic: Pick<Topic, 'minLength' | 'maxLength' | 'brandWord' | 'bannedWords'>,
  analysis: Pick<VideoAnalysis, 'sceneKeywords' | 'scenes'> | null,
): CheckContext {
  return {
    text,
    topic: {
      minLength: topic.minLength,
      maxLength: topic.maxLength,
      brandWord: topic.brandWord,
      bannedWords: topic.bannedWords,
    },
    analysis: analysis
      ? {
          sceneKeywords: analysis.sceneKeywords,
          sceneTimes: analysis.scenes
            .map((s) => s.time)
            .filter((t): t is string => !!t),
        }
      : null,
  };
}

/**
 * 댓글 초안 작성. 설정의 "댓글 작성 AI"로 쓰고, 자동 검사에 걸리면
 * 걸린 이유를 붙여 한 번 더 쓴다. 그래도 걸리면 그 결과를 그대로 돌려준다(사람이 고친다).
 */
@Injectable()
export class DraftingService {
  /**
   * @param ai AI 호출 창구
   * @param checks 자동 검사
   */
  constructor(
    private readonly ai: AiService,
    private readonly checks: CheckRunnerService,
  ) {}

  /**
   * 초안을 쓴다.
   * @param topic 주제
   * @param video 영상
   * @param analysis 영상 분석
   */
  async write(
    topic: Topic,
    video: Video,
    analysis: VideoAnalysis,
  ): Promise<WrittenDraft> {
    const ai = await this.ai.resolve('drafting');
    let retry: { text: string; failed: CheckReport['results'] } | undefined;
    let last: WrittenDraft | null = null;

    for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt++) {
      const out = await this.ai.generate(
        ai,
        {
          system: DRAFT_SYSTEM,
          prompt: buildDraftPrompt(topic, video, analysis, retry),
          schema: draftSchema,
          timeoutMs: DRAFT_TIMEOUT_MS,
        },
        `draft topic=${topic.id} video=${video.id} try=${attempt}`,
      );
      const text = out.text.trim();
      const report = this.checks.run(checkContextOf(text, topic, analysis));
      last = {
        text,
        reasons: out.reasons,
        report,
        provider: ai.provider.id,
        model: ai.model,
        attempts: attempt,
      };
      if (report.passed) break;
      retry = { text, failed: report.results.filter((r) => !r.passed) };
    }
    return last!;
  }
}
