import type { Topic } from '../topics/topic.entity.js';
import {
  analysisPromptValues,
  DEFAULT_ANALYSIS_PROMPT,
} from '../drafts/analysis-prompt.js';
import {
  DEFAULT_DRAFT_PROMPT,
  draftPromptValues,
  draftRetryValues,
} from '../drafts/draft-prompt.js';
import { renderTemplateParts, type RenderedPart } from './prompt-template.js';

/**
 * 설정 화면 '예시 보기': 고치는 중인 프롬프트를 예시 영상과 주제 값으로 채워 AI가 받을 글을 보인다.
 * 영상은 고정 예시라 유튜브 할당량과 AI 비용이 들지 않는다.
 */

/** 주제가 하나도 없을 때 쓰는 예시 주제 */
const SAMPLE_TOPIC: Pick<
  Topic,
  | 'name'
  | 'brandTarget'
  | 'brandWord'
  | 'keywords'
  | 'tone'
  | 'minLength'
  | 'maxLength'
  | 'bannedWords'
> = {
  name: '운명원 연애 사주 (예시)',
  brandTarget: '운명원 · 연애 사주 잘 보는 곳',
  brandWord: '',
  keywords: ['연애', '썸', '재회'],
  tone: '20~30대 시청자, 공감형 구어체',
  minLength: 40,
  maxLength: 120,
  bannedWords: [],
};

/** 예시 영상 (계획서의 운명원 예시) */
const SAMPLE_VIDEO = {
  title: '썸 탈 때 남자가 연락 텀을 늘리는 진짜 이유 3가지',
  channelTitle: '연애심리연구소 하루',
  durationSec: 768,
};

/** 예시 영상 설명·인기 댓글 */
const SAMPLE_CONTEXT = {
  description:
    '썸 단계에서 연락이 뜸해질 때 남자의 속마음 3가지를 정리했어요. 04:12 확신이 없어서 텀이 길어지는 경우를 꼭 보세요.',
  comments: [
    { text: '읽씹 3일째인데 이거 보고 위로받고 갑니다', likeCount: 120 },
    { text: '확신 없으면 텀 길어진다는 말 너무 맞아요', likeCount: 48 },
    { text: '저도 지금 딱 이 상태라 뜨끔했어요ㅠ', likeCount: 15 },
  ],
};

/** 예시 분석 결과 (작성 프롬프트에 들어가는 근거 장면) */
const SAMPLE_ANALYSIS = {
  scenes: [
    {
      time: '04:12',
      quote: '확신이 없어서 텀이 길어지는 경우',
      source: 'video' as const,
    },
    {
      time: null,
      quote: '읽씹 3일째인데 이거 보고 위로받고 갑니다',
      source: 'comment' as const,
    },
  ],
};

/** 예시: 자동 검사에 걸린 앞선 글 */
const SAMPLE_RETRY = {
  text: '연락 텀 얘기 너무 공감돼요. 운명원 연애 사주 잘 본다던데 저도 한번 물어보고 싶네요. 확신이 없어서 그런 건지 궁금해요. 진짜 요즘 이것 때문에 잠도 못 자요ㅠ',
  failed: [{ label: '길이', detail: '132자예요 · 120자 이하로 줄여 주세요' }],
};

/** 예시 보기 결과 */
export interface PromptPreview {
  /** 채운 값의 출처 안내 (주제는 실제, 영상은 예시) */
  basis: { topicName: string; videoTitle: string; watchesVideo: boolean };
  /** 지시 (그대로 보낸다) */
  system: string;
  /** 자료 틀을 채운 글 (자리에서 온 값은 slot이 있다) */
  user: RenderedPart[];
  /** 다시 쓸 때 덧붙이는 글 (작성만) */
  retry: RenderedPart[] | null;
}

/**
 * 프롬프트 예시를 만든다
 * @param key prompt.analysis 또는 prompt.drafting
 * @param value 고치는 중인 프롬프트 값
 * @param topic 실제 주제 (없으면 예시 주제)
 * @param watchesVideo 지금 분석 AI가 영상을 직접 보는지
 */
export function previewPrompt(
  key: 'prompt.analysis' | 'prompt.drafting',
  value: { system: string; user: string; retry?: string },
  topic: typeof SAMPLE_TOPIC | null,
  watchesVideo: boolean,
): PromptPreview {
  const t = topic ?? SAMPLE_TOPIC;
  const basis = {
    topicName: t.name,
    videoTitle: SAMPLE_VIDEO.title,
    watchesVideo,
  };
  if (key === 'prompt.analysis') {
    return {
      basis,
      system: value.system,
      user: renderTemplateParts(
        value.user || DEFAULT_ANALYSIS_PROMPT.user,
        analysisPromptValues(t, SAMPLE_VIDEO, SAMPLE_CONTEXT, watchesVideo),
      ),
      retry: null,
    };
  }
  return {
    basis,
    system: value.system,
    user: renderTemplateParts(
      value.user || DEFAULT_DRAFT_PROMPT.user,
      draftPromptValues(t, SAMPLE_VIDEO, SAMPLE_ANALYSIS),
    ),
    retry: renderTemplateParts(
      value.retry || DEFAULT_DRAFT_PROMPT.retry,
      draftRetryValues(SAMPLE_RETRY),
    ),
  };
}
