import { stripDisclosure, withDisclosure } from '../checks/ad-disclosure.js';
import { keywordsFromQuotes } from '../checks/scene-keywords.js';
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
 * @param text 검사할 글 (게시될 댓글 전체)
 * @param topic 주제
 * @param analysis 영상 분석 (없으면 장면 언급 검사가 실패한다)
 * @param disclosure 필요한 광고 표시 (다른 채널 영상). 내 채널 영상이면 null
 */
export function checkContextOf(
  text: string,
  topic: Pick<Topic, 'minLength' | 'maxLength' | 'brandWord' | 'bannedWords'>,
  analysis: Pick<VideoAnalysis, 'sceneKeywords' | 'scenes'> | null,
  disclosure: string | null,
): CheckContext {
  return {
    text: disclosure ? stripDisclosure(text, disclosure) : text,
    fullText: text,
    disclosure,
    topic: {
      minLength: topic.minLength,
      maxLength: topic.maxLength,
      brandWord: topic.brandWord,
      bannedWords: topic.bannedWords,
    },
    analysis: analysis
      ? {
          // 핵심 단어가 하나도 안 남았으면 근거 장면 인용의 단어로 대신한다 (아니면 장면 언급 검사가 늘 실패)
          sceneKeywords:
            analysis.sceneKeywords.length > 0
              ? analysis.sceneKeywords
              : keywordsFromQuotes(analysis.scenes.map((s) => s.quote)),
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
   * @param disclosure 필요한 광고 표시 (다른 채널 영상). 코드가 맨 앞에 붙인다. 내 채널 영상이면 null
   */
  async write(
    topic: Topic,
    video: Video,
    analysis: VideoAnalysis,
    disclosure: string | null,
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
      // 광고 표시는 AI에게 맡기지 않고 코드가 맨 앞에 붙인다
      const text = disclosure
        ? withDisclosure(out.text.trim(), disclosure)
        : out.text.trim();
      const report = this.checks.run(
        checkContextOf(text, topic, analysis, disclosure),
      );
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
