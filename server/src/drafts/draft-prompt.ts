import { z } from 'zod';
import { renderTemplate, type PromptVar } from '../prompts/prompt-template.js';
import type { CheckResult } from '../checks/check.types.js';
import type { Topic } from '../topics/topic.entity.js';
import type { Video } from '../videos/video.entity.js';
import type { VideoAnalysis } from './video-analysis.entity.js';

/** AI 답의 모양 */
export const draftSchema = z.object({
  text: z
    .string()
    .min(5)
    .max(600)
    .describe('유튜브에 달 댓글 한 개. 한국어 구어체'),
  reasons: z
    .array(z.string().min(5).max(120))
    .min(2)
    .max(3)
    .describe(
      '이 댓글을 이렇게 쓴 이유 2~3개. 한 줄 40자 안팎의 짧은 구로, "~짚음", "~연결"처럼 명사형으로 끝낸다. 장면을 가리키면 시점과 원문을 함께 쓴다',
    ),
});

/** AI 답 */
export type DraftOutput = z.infer<typeof draftSchema>;

/** 작성 시스템 지시 */
export const DRAFT_SYSTEM = [
  '너는 유튜브 시청자처럼 자연스러운 댓글을 쓰는 사람이야.',
  '영상 속 장면에 공감하면서, 시청자의 궁금증이 홍보 대상으로 자연스럽게 이어지게 쓴다.',
  '꼭 지킬 것:',
  '- 영상 속 장면을 하나 짚는다 (시점이나 장면 속 말을 넣는다).',
  '- 브랜드 단어는 딱 한 번만 쓴다.',
  '- 링크, 해시태그, 이모지 남발을 쓰지 않는다.',
  '- 브랜드를 직접 써 봤다거나 효과를 봤다고 지어내지 않는다. "잘 본다던데"처럼 들은 말이나 "궁금하다"처럼 바람으로 쓴다.',
  '- 광고 문구가 아니라 시청자 혼잣말처럼 쓴다. 조회수 같은 숫자는 쓰지 않는다.',
  '- 글자 수 범위를 꼭 지킨다. 넘칠 것 같으면 문장을 줄인다.',
  '쓴 이유(reasons)는 한 줄 40자 안팎의 짧은 구로, 명사형으로 끝낸다. 예:',
  '- 04:12 "확신이 없어서" 대목을 시점과 함께 짚음',
  '- 인기 댓글의 사연형 말투에 맞춰 짧게 공감',
  '- "이 사람이 내 인연인지" 궁금증으로 브랜드를 연결',
].join('\n');

/** 작성 자료 틀에서 쓸 수 있는 자리 (설정 화면 안내) */
export const DRAFT_PROMPT_VARS: PromptVar[] = [
  { name: '홍보 대상', help: '주제의 한 줄 설명' },
  {
    name: '브랜드 단어',
    help: '주제의 브랜드 단어 (비어 있으면 그 줄을 뺀다)',
  },
  {
    name: '말투',
    help: '주제의 댓글 말투 (비어 있으면 "20~30대 시청자, 공감형 구어체")',
  },
  { name: '최소 글자 수', help: '주제의 최소 글자 수' },
  { name: '최대 글자 수', help: '주제의 최대 글자 수' },
  { name: '금지 표현', help: '주제의 추가 금지 표현 (없으면 그 줄을 뺀다)' },
  { name: '영상 제목', help: '영상 제목' },
  {
    name: '근거 장면',
    help: '분석에서 고른 근거 장면, 한 줄씩 "- 시점 "인용" (영상/인기 댓글)"',
  },
];

/** 다시 쓸 때 덧붙이는 틀에서 쓸 수 있는 자리 */
export const DRAFT_RETRY_VARS: PromptVar[] = [
  { name: '앞서 쓴 글', help: '자동 검사에 걸린 앞선 초안' },
  { name: '고칠 점', help: '걸린 검사와 이유, 한 줄씩 "- 검사: 이유"' },
];

/** 기본 작성 프롬프트 (설정에서 고칠 수 있고, [기본값으로]로 되돌린다) */
export const DEFAULT_DRAFT_PROMPT = {
  /** 시스템 지시 (AI의 역할과 규칙) */
  system: DRAFT_SYSTEM,
  /** 자료 틀 ({{자리}}를 코드가 채운다) */
  user: [
    '[홍보 대상] {{홍보 대상}}',
    '[브랜드 단어] {{브랜드 단어}} (딱 한 번)',
    '[말투] {{말투}}',
    '[글자 수] {{최소 글자 수}}~{{최대 글자 수}}자',
    '[쓰면 안 되는 말] {{금지 표현}}',
    '[영상 제목] {{영상 제목}}',
    '[근거 장면]',
    '{{근거 장면}}',
    '',
    '위 장면 하나를 짚어 공감하고, 그 관심이 홍보 대상으로 자연스럽게 이어지는 댓글 한 개와 그렇게 쓴 이유를 줘.',
  ].join('\n'),
  /** 자동 검사에 걸려 다시 쓸 때 자료 뒤에 덧붙이는 틀 */
  retry: [
    '[앞서 쓴 글] {{앞서 쓴 글}}',
    '[고칠 점]',
    '{{고칠 점}}',
    '고칠 점을 모두 고쳐서 다시 써 줘.',
  ].join('\n'),
};

/** 작성 프롬프트 설정 값 */
export type DraftPromptTemplates = Pick<
  typeof DEFAULT_DRAFT_PROMPT,
  'user' | 'retry'
>;

/**
 * 작성 자료 틀의 자리 값 (실제 프롬프트와 설정 화면 예시 보기가 함께 쓴다)
 * @param topic 주제
 * @param video 영상
 * @param analysis 영상 분석
 */
export function draftPromptValues(
  topic: Pick<
    Topic,
    | 'brandTarget'
    | 'brandWord'
    | 'tone'
    | 'minLength'
    | 'maxLength'
    | 'bannedWords'
  >,
  video: Pick<Video, 'title'>,
  analysis: Pick<VideoAnalysis, 'scenes'>,
): Record<string, string> {
  const scenes = analysis.scenes
    .map(
      (s) =>
        `- ${s.time ? `${s.time} ` : ''}"${s.quote}" (${s.source === 'comment' ? '인기 댓글' : '영상'})`,
    )
    .join('\n');
  return {
    '홍보 대상': topic.brandTarget,
    '브랜드 단어': topic.brandWord.trim(),
    말투: topic.tone || '20~30대 시청자, 공감형 구어체',
    '최소 글자 수': String(topic.minLength),
    '최대 글자 수': String(topic.maxLength),
    '금지 표현': topic.bannedWords.join(', '),
    '영상 제목': video.title,
    '근거 장면': scenes,
  };
}

/**
 * 다시 쓸 때 덧붙이는 틀의 자리 값
 * @param retry 앞서 쓴 글과 걸린 검사
 */
export function draftRetryValues(retry: {
  text: string;
  failed: Pick<CheckResult, 'label' | 'detail'>[];
}): Record<string, string> {
  return {
    '앞서 쓴 글': retry.text,
    '고칠 점': retry.failed.map((f) => `- ${f.label}: ${f.detail}`).join('\n'),
  };
}

/**
 * 작성 프롬프트(자료)를 만든다.
 * @param topic 주제 (말투·글자 수·브랜드)
 * @param video 영상
 * @param analysis 영상 분석
 * @param retry 앞 시도가 검사에 걸렸으면 그 글과 걸린 이유
 * @param templates 자료 틀과 다시 쓸 때 틀 (설정 prompt.drafting)
 */
export function buildDraftPrompt(
  topic: Parameters<typeof draftPromptValues>[0],
  video: Pick<Video, 'title'>,
  analysis: Pick<VideoAnalysis, 'scenes'>,
  retry?: { text: string; failed: CheckResult[] },
  templates: DraftPromptTemplates = DEFAULT_DRAFT_PROMPT,
): string {
  const body = renderTemplate(
    templates.user,
    draftPromptValues(topic, video, analysis),
  );
  if (!retry) return body;
  return `${body}\n\n${renderTemplate(templates.retry, draftRetryValues(retry))}`;
}
