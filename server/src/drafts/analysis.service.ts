import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiError } from '../ai/ai-provider.js';
import { AiService } from '../ai/ai.service.js';
import { PROMPT_ANALYSIS } from '../settings/setting-definitions.js';
import { SettingsService } from '../settings/settings.service.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import {
  YOUTUBE_CLIENT,
  type YoutubeClient,
} from '../videos/youtube/youtube-client.js';
import {
  analysisSchema,
  buildAnalysisPrompt,
  fillPlaceholders,
  verifyKeywords,
  verifyScenes,
} from './analysis-prompt.js';
import { watchUrl } from '../videos/youtube/youtube-parsers.js';
import { VideoAnalysis } from './video-analysis.entity.js';

/** 분석 제한 시간 (영상을 직접 보면 오래 걸린다) */
const ANALYSIS_TIMEOUT_MS = 180_000;
/** 분석 재료로 가져올 인기 댓글 수 */
const MAX_COMMENTS = 20;

/**
 * 영상 분석 (② 칸 위쪽: 고른 이유, 고민 한 줄, 근거 장면).
 * 설정의 "영상 분석 AI"로 부르고, 결과는 코드가 원문과 대조한 뒤 저장한다.
 */
@Injectable()
export class AnalysisService {
  /**
   * @param repo 분석 저장소
   * @param ai AI 호출 창구
   * @param youtube YouTube API (영상 설명·인기 댓글)
   * @param settings 설정 (영상 분석 프롬프트)
   */
  constructor(
    @InjectRepository(VideoAnalysis)
    private readonly repo: Repository<VideoAnalysis>,
    private readonly ai: AiService,
    @Inject(YOUTUBE_CLIENT) private readonly youtube: YoutubeClient,
    private readonly settings: SettingsService,
  ) {}

  /**
   * 가장 최근 분석
   * @param topicId 주제 ID
   * @param videoId 영상 ID
   */
  latest(topicId: number, videoId: number): Promise<VideoAnalysis | null> {
    return this.repo.findOne({
      where: { topicId, videoId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /**
   * 영상을 분석해 새 행으로 저장한다.
   * @param topic 주제
   * @param video 영상
   */
  async analyze(topic: Topic, video: Video): Promise<VideoAnalysis> {
    const ai = await this.ai.resolve('analysis');
    const ctx = await this.youtube.getVideoContext(
      video.youtubeId,
      MAX_COMMENTS,
    );
    const watchesVideo = ai.provider.canWatchVideo;

    // 설정에서 고친 프롬프트 (없으면 기본값)
    const prompt = await this.settings.get(PROMPT_ANALYSIS);
    const out = await this.ai.generate(
      ai,
      {
        system: prompt.system,
        prompt: buildAnalysisPrompt(
          topic,
          video,
          ctx,
          watchesVideo,
          prompt.user,
        ),
        schema: analysisSchema,
        videoUrl: watchesVideo ? watchUrl(video.youtubeId) : undefined,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
      },
      `analysis topic=${topic.id} video=${video.id}`,
    );

    // 검증은 코드: 원문에 없는 인용은 버리고, 숫자는 코드가 채운다
    const { kept } = verifyScenes(out.scenes, {
      description: ctx.description,
      comments: ctx.comments.map((c) => c.text),
      durationSec: video.durationSec,
      watchedVideo: watchesVideo,
    });
    if (kept.length === 0) {
      throw new AiError(
        '영상에서 근거 장면을 찾지 못했어요 · 다시 분석하거나 다른 영상을 골라 주세요',
        true,
      );
    }

    return this.repo.save(
      this.repo.create({
        topicId: topic.id,
        videoId: video.id,
        worry: out.worry.trim(),
        pickReasons: fillPlaceholders(out.pickReasons, video),
        scenes: kept,
        sceneKeywords: verifyKeywords(out.sceneKeywords, kept),
        provider: ai.provider.id,
        model: ai.model,
      }),
    );
  }
}
