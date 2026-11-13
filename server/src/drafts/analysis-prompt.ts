import { z } from 'zod';
import { renderTemplate, type PromptVar } from '../prompts/prompt-template.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import type { YoutubeVideoContext } from '../videos/youtube/youtube-client.js';
import type { EvidenceScene } from './video-analysis.entity.js';

/**
 * 영상 분석 프롬프트와 코드 검증.
 * 원칙: 숫자는 코드, 판단은 AI, 검증은 코드.
 * - AI는 고른 이유에 숫자를 직접 쓰지 않고 {조회수}·{올린때}·{채널} 자리만 쓴다. 코드가 채운다.
 * - AI가 고른 인용은 코드가 원문(영상 설명·인기 댓글)과 대조해, 없는 말이면 버린다.
 */

/** 이유 문장에 쓰는 자리 표시 → 코드가 넣을 값 */
export const PLACEHOLDERS = ['{조회수}', '{올린때}', '{채널}'] as const;

/** AI 답의 모양 */
export const analysisSchema = z.object({
  topicMatch: z
    .number()
    .min(0)
    .max(100)
    .describe(
      '이 영상이 주제(홍보 대상·관심 키워드)와 얼마나 맞는지 0~100 정수. 영상에 실제로 나온 내용으로 판단한다',
    ),
  topicMatchReason: z
    .string()
    .min(5)
    .max(120)
    .describe(
      '주제 매칭 퍼센트를 그렇게 매긴 이유 한 줄. 영상 속 내용을 근거로, 한국어 한 문장 60자 안팎',
    ),
  pickReasons: z
    .array(z.string().min(5).max(120))
    .min(2)
    .max(3)
    .describe(
      '이 영상을 홍보 댓글 자리로 고른 이유 2~3개. 한 줄 40자 안팎의 짧은 구로, 명사형으로 끝낸다. 숫자는 쓰지 말고 {조회수}, {올린때}, {채널} 자리 표시를 쓴다',
    ),
  scenes: z
    .array(
      z.object({
        time: z
          .string()
          .nullable()
          .describe('영상 속 시점 "mm:ss". 인기 댓글이나 시점을 모르면 null'),
        quote: z
          .string()
          .min(2)
          .max(120)
          .describe('원문 그대로 인용. 고치거나 지어내지 않는다'),
        source: z
          .enum(['video', 'comment'])
          .describe('video: 영상 속 말이나 영상 설명, comment: 인기 댓글'),
      }),
    )
    .min(1)
    .max(4)
    .describe('근거 장면·인기 댓글 1~4개'),
  sceneKeywords: z
    .array(z.string().min(1).max(15))
    .min(2)
    .max(6)
    .describe(
      '댓글이 장면을 짚었는지 검사할 핵심 단어 2~6개. 인용 속에 실제로 있는 짧은 단어',
    ),
});

/** AI 답 */
export type AnalysisOutput = z.infer<typeof analysisSchema>;

/** 분석 시스템 지시 */
export const ANALYSIS_SYSTEM = [
  '너는 유튜브 영상 댓글 마케팅을 돕는 분석가야.',
  '영상과 시청자 반응을 보고, 이 영상이 주제(홍보 대상·관심 키워드)와 얼마나 맞는지 판단하고 그 근거 장면을 찾는다.',
  '주제 매칭(topicMatch) 기준:',
  '- 90~100: 영상이 주제를 직접 다룬다',
  '- 60~89: 주제와 가까운 이야기라 시청자가 홍보 대상에 관심을 가질 만하다',
  '- 30~59: 주제와 일부만 닿는다',
  '- 0~29: 주제와 거의 상관없다. 홍보 대상과 이어 붙일 수 있어도 영상 내용이 다르면 낮게 준다',
  '규칙:',
  '- 인용(quote)은 영상 속 말, 영상 설명, 인기 댓글에 실제로 있는 문장만 그대로 옮긴다. 지어내지 않는다.',
  '- 숫자(조회수, 시간, 날짜)는 직접 쓰지 않는다. 필요하면 {조회수}, {올린때}, {채널} 자리 표시를 쓴다.',
  '- 모든 문장은 한국어로, 짧게 쓴다.',
  '고른 이유(pickReasons) 예:',
  '- {올린때} 올라와 조회수가 빠르게 오르는 중 ({조회수})',
  '- 썸 단계 연락 텀이라는 흔한 고민이라 공감할 사람이 많음',
  '- 인기 댓글이 사연형이라 시청자 말투 댓글이 자연스럽게 섞임',
].join('\n');

/** 분석 자료 틀에서 쓸 수 있는 자리 (설정 화면 안내) */
export const ANALYSIS_PROMPT_VARS: PromptVar[] = [
  {
    name: '홍보 대상',
    help: '주제의 한 줄 설명 (예: 운명원 · 연애 사주 잘 보는 곳)',
  },
  { name: '관심 키워드', help: '주제의 검색 키워드 (쉼표로 이음)' },
  { name: '영상 제목', help: '영상 제목' },
  { name: '채널', help: '영상을 올린 채널 이름' },
  { name: '영상 길이', help: '영상 길이 (mm:ss)' },
  {
    name: '영상 보기 안내',
    help: 'AI가 영상을 직접 보면 "함께 보낸 영상을 직접 보고…", 못 보면 "영상은 볼 수 없어…" (코드가 고른다)',
  },
  { name: '영상 설명', help: '영상 설명 (1,500자까지, 없으면 "(없음)")' },
  {
    name: '인기 댓글',
    help: '인기 댓글 20개, 번호를 붙여 한 줄씩 (없으면 "(없음)")',
  },
];

/** 기본 분석 프롬프트 (설정에서 고칠 수 있고, [기본값으로]로 되돌린다) */
export const DEFAULT_ANALYSIS_PROMPT = {
  /** 시스템 지시 (AI의 역할과 규칙) */
  system: ANALYSIS_SYSTEM,
  /** 자료 틀 ({{자리}}를 코드가 채운다) */
  user: [
    '[홍보 대상] {{홍보 대상}}',
    '[관심 키워드] {{관심 키워드}}',
    '[영상 제목] {{영상 제목}}',
    '[채널] {{채널}}',
    '[영상 길이] {{영상 길이}}',
    '',
    '[영상] {{영상 보기 안내}}',
    '',
    '[영상 설명]',
    '{{영상 설명}}',
    '',
    '[인기 댓글]',
    '{{인기 댓글}}',
    '',
    '이 영상이 주제와 얼마나 맞는지(0~100)와 그 이유, 이 영상을 고른 이유, 근거 장면을 뽑아 줘.',
  ].join('\n'),
};

/**
 * 분석 자료 틀의 자리 값 (실제 프롬프트와 설정 화면 예시 보기가 함께 쓴다)
 * @param topic 주제 (홍보 대상)
 * @param video 영상
 * @param ctx 영상 설명과 인기 댓글
 * @param watchesVideo AI가 영상을 직접 보는지
 */
export function analysisPromptValues(
  topic: Pick<Topic, 'brandTarget' | 'keywords'>,
  video: Pick<Video, 'title' | 'channelTitle' | 'durationSec'>,
  ctx: YoutubeVideoContext,
  watchesVideo: boolean,
): Record<string, string> {
  const comments = ctx.comments
    .slice(0, 20)
    .map((c, i) => `${i + 1}. ${oneLine(c.text, 200)}`)
    .join('\n');
  return {
    '홍보 대상': topic.brandTarget,
    '관심 키워드': topic.keywords.join(', '),
    '영상 제목': video.title,
    채널: video.channelTitle,
    '영상 길이': formatTime(video.durationSec),
    '영상 보기 안내': watchesVideo
      ? '함께 보낸 영상을 직접 보고, 영상 속 말은 시점(mm:ss)과 함께 인용해.'
      : '영상은 볼 수 없어. 영상 설명과 인기 댓글만 근거로 써. 영상 설명에서 인용하면 source는 video, time은 null로 둬.',
    '영상 설명': oneLine(ctx.description, 1500) || '(없음)',
    '인기 댓글': comments || '(없음)',
  };
}

/**
 * 분석 프롬프트(자료)를 만든다.
 * @param topic 주제 (홍보 대상)
 * @param video 영상 (숫자는 코드가 넣는다)
 * @param ctx 영상 설명과 인기 댓글
 * @param watchesVideo AI가 영상을 직접 보는지
 * @param template 자료 틀 (설정 prompt.analysis의 user)
 */
export function buildAnalysisPrompt(
  topic: Pick<Topic, 'brandTarget' | 'keywords'>,
  video: Pick<Video, 'title' | 'channelTitle' | 'durationSec'>,
  ctx: YoutubeVideoContext,
  watchesVideo: boolean,
  template: string = DEFAULT_ANALYSIS_PROMPT.user,
): string {
  return renderTemplate(
    template,
    analysisPromptValues(topic, video, ctx, watchesVideo),
  );
}

/** 검증에 쓰는 원문 */
export interface AnalysisSources {
  /** 영상 설명 */
  description: string;
  /** 인기 댓글 */
  comments: string[];
  /** 영상 길이(초). 시점이 이보다 크면 버린다 */
  durationSec: number;
  /** AI가 영상을 직접 봤는지. 봤으면 영상 속 말 인용은 대조할 원문이 없어 그대로 둔다 */
  watchedVideo: boolean;
}

/**
 * AI가 고른 근거 장면을 원문과 대조한다 (검증은 코드).
 * - 댓글 인용: 인기 댓글에 실제로 있어야 한다
 * - 영상 인용: 영상을 직접 본 AI면 그대로, 아니면 영상 설명에 있어야 한다
 * - 시점: mm:ss 형식이고 영상 길이 안이어야 한다. 아니면 시점만 지운다
 * @param scenes AI가 고른 장면
 * @param src 대조할 원문
 * @returns 남은 장면과 버린 수
 */
export function verifyScenes(
  scenes: AnalysisOutput['scenes'],
  src: AnalysisSources,
): { kept: EvidenceScene[]; dropped: number } {
  const comments = src.comments.map(normalize);
  const description = normalize(src.description);
  const kept: EvidenceScene[] = [];
  for (const s of scenes) {
    const quote = s.quote.trim().replace(/^["“'‘]|["”'’]$/g, '');
    const q = normalize(quote.replace(/(…|\.\.\.)$/, ''));
    if (q.length < 2) continue;
    const found =
      s.source === 'comment'
        ? comments.some((c) => c.includes(q))
        : src.watchedVideo || description.includes(q);
    if (!found) continue;
    const time =
      s.source === 'video' && s.time && isValidTime(s.time, src.durationSec)
        ? normalizeTime(s.time)
        : null;
    kept.push({ time, quote, source: s.source });
  }
  return { kept, dropped: scenes.length - kept.length };
}

/**
 * 장면 핵심 단어 중 실제로 인용에 있는 것만 남긴다.
 * @param keywords AI가 고른 단어
 * @param scenes 검증을 통과한 장면
 */
export function verifyKeywords(
  keywords: string[],
  scenes: EvidenceScene[],
): string[] {
  const text = scenes.map((s) => s.quote).join(' ');
  return [
    ...new Set(
      keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 0 && text.includes(k)),
    ),
  ];
}

/**
 * 이유 문장의 자리 표시를 코드가 가진 값으로 채운다 (숫자는 코드).
 * @param reasons AI가 쓴 이유
 * @param video 영상 값
 * @param now 기준 시각
 */
export function fillPlaceholders(
  reasons: string[],
  video: Pick<Video, 'viewCount' | 'publishedAt' | 'channelTitle'>,
  now: Date = new Date(),
): string[] {
  const values: Record<(typeof PLACEHOLDERS)[number], string> = {
    '{조회수}': `${video.viewCount.toLocaleString('ko-KR')}회`,
    '{올린때}': relativeTime(video.publishedAt, now),
    '{채널}': video.channelTitle,
  };
  return reasons.map((r) =>
    PLACEHOLDERS.reduce((acc, p) => acc.split(p).join(values[p]), r).trim(),
  );
}

/**
 * 올린 때를 "3시간 전"처럼 쓴다.
 * @param at 올린 시각
 * @param now 기준 시각
 */
export function relativeTime(at: Date, now: Date = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60000));
  if (min < 60) return `${Math.max(1, min)}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '어제' : `${days}일 전`;
}

/** 초를 m:ss 또는 h:mm:ss로 */
export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** 대조용으로 공백·문장부호를 지우고 소문자로 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s"'“”‘’.,!?~…·ㆍ\-()[\]]/g, '');
}

/** 시점이 mm:ss(또는 h:mm:ss)이고 영상 길이 안인지 */
function isValidTime(time: string, durationSec: number): boolean {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return false;
  const sec = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[3]) < 60 && (durationSec <= 0 || sec <= durationSec);
}

/** 시점을 05:20 모양으로 맞춘다 */
function normalizeTime(time: string): string {
  const parts = time.trim().split(':');
  return parts.length === 2
    ? `${parts[0].padStart(2, '0')}:${parts[1]}`
    : time.trim();
}

/** 줄바꿈을 지우고 길이를 자른다 */
function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
