import { stripDisclosure, withDisclosure } from '../checks/ad-disclosure.js';
import type { DraftStyle } from './variety/draft-style.js';
import { recentPatterns } from './variety/recent-patterns.js';
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
import { PROMPT_DRAFTING } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import { buildDraftPrompt, draftSchema } from './draft-prompt.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/** 작성 제한 시간 */
const DRAFT_TIMEOUT_MS = 120_000;
/** 검사에 걸리면 고칠 점을 붙여 다시 쓰는 최대 횟수 (첫 시도 포함) */
export const MAX_DRAFT_ATTEMPTS = 2;

/** 작성 결과 */
/**
 * 꼭 써야 해서 말버릇으로 보면 안 되는 말: 브랜드 단어·주제 검색어·장면 핵심 단어 (RD-33)
 * @param topic 주제
 * @param analysis 영상 분석
 */
export function mustUseWords(
  topic: Pick<Topic, 'brandWord'> & Partial<Pick<Topic, 'keywords'>>,
  analysis: Pick<VideoAnalysis, 'sceneKeywords'> | null,
): string[] {
  return [
    topic.brandWord,
    ...(topic.keywords ?? []),
    ...(analysis?.sceneKeywords ?? []),
  ].filter((w) => w.trim().length > 0);
}

/** 초안을 다양하게 쓰는 데 쓰는 값 (RD-33) */
export interface DraftExtras {
  /** 이번 글 모양 (코드가 고른 것). 없으면 붙이지 않는다 */
  style?: DraftStyle;
  /** 같은 주제의 최근 초안 글 (말버릇 피하기·비슷함 검사) */
  recentTexts?: string[];
  /** 이 영상에 이미 단 댓글 글, 최근 순 (겹치지 않게 쓰기·같은 글 막기, RD-27) */
  posted?: string[];
}

export interface WrittenDraft {
  /** 시청자 고민 한 줄 (AI가 꾸민 시청자 입장의 고민, RD-32) */
  worry: string;
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
 * @param disclosure 붙인 광고 표시 (다른 채널 영상). 길이 등은 이 표시를 뺀 본문으로 센다. 내 채널 영상이거나 표시가 없으면 null
 * @param history 견줄 이전 글: 같은 주제의 최근 초안(너무 비슷하거나 말버릇이 겹치면 걸린다, RD-33)과 이 영상에 이미 단 댓글(같은 글이면 걸린다, RD-27)
 */
export function checkContextOf(
  text: string,
  topic: Pick<Topic, 'minLength' | 'maxLength' | 'brandWord' | 'bannedWords'> &
    Partial<Pick<Topic, 'keywords'>>,
  analysis: Pick<VideoAnalysis, 'sceneKeywords' | 'scenes'> | null,
  disclosure: string | null,
  history: Pick<DraftExtras, 'recentTexts' | 'posted'> = {},
): CheckContext {
  /** 맨 앞 광고 표시를 뺀 본문 */
  const body = (t: string) => (disclosure ? stripDisclosure(t, disclosure) : t);
  const texts = (history.recentTexts ?? []).map(body);
  return {
    text: body(text),
    recent: {
      texts,
      overused: recentPatterns(texts, mustUseWords(topic, analysis)).overused,
    },
    postedTexts: (history.posted ?? []).map(body),
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
   * @param settings 설정 (댓글 작성 프롬프트)
   */
  constructor(
    private readonly ai: AiService,
    private readonly checks: CheckRunnerService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * 초안을 쓴다.
   * @param topic 주제
   * @param video 영상
   * @param analysis 영상 분석
   * @param disclosure 필요한 광고 표시 (다른 채널 영상). 코드가 맨 앞에 붙인다. 내 채널 영상이면 null
   * @param extras 글 모양·최근 초안(다양하게 쓰기, RD-33)과 이 영상에 이미 단 댓글(겹치지 않게 쓰고 같은 글은 검사에서 막기, RD-27)
   */
  async write(
    topic: Topic,
    video: Video,
    analysis: VideoAnalysis,
    disclosure: string | null,
    extras: DraftExtras = {},
  ): Promise<WrittenDraft> {
    const recentTexts = extras.recentTexts ?? [];
    // 최근 초안에서 자주 나온 말 (광고 표시를 뺀 본문으로 센다)
    const avoid = recentPatterns(
      recentTexts.map((t) => (disclosure ? stripDisclosure(t, disclosure) : t)),
      mustUseWords(topic, analysis),
    ).avoid;
    const ai = await this.ai.resolve('drafting');
    // 설정에서 고친 프롬프트 (없으면 기본값)
    const prompt = await this.settings.get(PROMPT_DRAFTING);
    let retry: { text: string; failed: CheckReport['results'] } | undefined;
    let last: WrittenDraft | null = null;

    for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt++) {
      const out = await this.ai.generate(
        ai,
        {
          system: prompt.system,
          prompt: buildDraftPrompt(topic, video, analysis, retry, prompt, {
            style: extras.style,
            avoid,
            posted: extras.posted,
          }),
          schema: draftSchema,
          timeoutMs: DRAFT_TIMEOUT_MS,
          // 초안은 매번 다르게 (RD-33)
          creativity: 'creative',
        },
        `draft topic=${topic.id} video=${video.id} try=${attempt}`,
      );
      // 광고 표시는 AI에게 맡기지 않고 코드가 맨 앞에 붙인다
      const text = disclosure
        ? withDisclosure(out.text.trim(), disclosure)
        : out.text.trim();
      const report = this.checks.run(
        checkContextOf(text, topic, analysis, disclosure, extras),
      );
      last = {
        // 마지막으로 쓴 댓글과 같은 사람의 고민 (다시 쓰면 고민도 함께 바뀐다)
        worry: out.worry.trim(),
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
