/**
 * 글 모양 카드 (RD-33). 초안마다 코드가 '누가 · 말투 · 시작 · 브랜드 꺼내는 방식 · 자리 · 길이'를 무작위로 고르고,
 * 최근 초안에서 쓴 조합은 피한다. 같은 프롬프트로 같은 모양의 글만 나오는 것(특히 작은 모델)을 막는다.
 * 고를 거리는 데이터(STYLE_DIMENSIONS)로 둔다. 새 거리를 더하려면 차원이나 보기를 하나 더하면 된다.
 */

/** 보기 하나 */
export interface StyleOption {
  /** 저장하는 값 */
  id: string;
  /** 화면에 보일 이름 */
  label: string;
  /** AI에게 줄 지시 한 줄 */
  instruction: string;
}

/** 고를 거리 이름 */
export type StyleDimensionKey =
  'persona' | 'tone' | 'opening' | 'brandWay' | 'brandSpot';

/** 고를 거리 하나 */
export interface StyleDimension {
  /** 저장 이름 */
  key: StyleDimensionKey;
  /** 프롬프트에 쓰는 이름 */
  title: string;
  /** 보기 */
  options: StyleOption[];
}

/** 길이 칸 */
export type StyleLength = 'short' | 'medium' | 'long';

/** 이 초안의 글 모양 (draft.style에 저장) */
export interface DraftStyle {
  /** 쓰는 사람 */
  persona: string;
  /** 말투 */
  tone: string;
  /** 시작 */
  opening: string;
  /** 홍보 대상을 꺼내는 방식 */
  brandWay: string;
  /** 홍보 대상을 넣는 자리 */
  brandSpot: string;
  /** 길이 칸 */
  length: StyleLength;
  /** 화면에 보일 한 줄 (예: 20대 후반 직장인 · 반말 혼잣말 · 질문으로 시작 · …) */
  summary: string;
}

/** 고를 거리와 보기. 주제와 상관없이 쓸 수 있게 '홍보 대상'으로 부른다 */
export const STYLE_DIMENSIONS: StyleDimension[] = [
  {
    key: 'persona',
    title: '쓰는 사람',
    options: [
      {
        id: 'student',
        label: '20대 초반 대학생',
        instruction: '20대 초반 대학생',
      },
      {
        id: 'office20',
        label: '20대 후반 직장인',
        instruction: '20대 후반 직장인',
      },
      {
        id: 'office30',
        label: '30대 초반 직장인',
        instruction: '30대 초반 직장인',
      },
      {
        id: 'jobseeker',
        label: '취업 준비생',
        instruction: '취업 준비 중인 20대',
      },
      {
        id: 'late30',
        label: '30대 후반',
        instruction: '30대 후반, 연애·결혼 얘기를 자주 듣는 나이',
      },
      {
        id: 'freelancer',
        label: '프리랜서',
        instruction: '집에서 일하는 프리랜서',
      },
    ],
  },
  {
    key: 'tone',
    title: '말투',
    options: [
      {
        id: 'polite',
        label: '존댓말',
        instruction: '부드러운 존댓말(~요). 이모티콘은 많아야 하나',
      },
      {
        id: 'casual',
        label: '반말 혼잣말',
        instruction: '반말 혼잣말(~네, ~다, ~듯). 남에게 말 거는 투가 아니다',
      },
      {
        id: 'mixed',
        label: '반말·존댓말 섞음',
        instruction:
          '혼잣말 반말로 시작해 마지막만 존댓말로 끝내는 식으로 섞는다',
      },
      {
        id: 'chatty',
        label: '수다체',
        instruction:
          '친구랑 수다 떨듯 ㅋㅋ·ㅠㅠ·말줄임(..)을 자연스럽게 섞는다',
      },
      {
        id: 'dry',
        label: '담백하게',
        instruction:
          '꾸밈 없이 짧고 담백한 존댓말. ㅋㅋ·ㅠㅠ·느낌표를 쓰지 않는다',
      },
    ],
  },
  {
    key: 'opening',
    title: '시작',
    options: [
      {
        id: 'question',
        label: '질문으로 시작',
        instruction: '첫 문장을 질문으로 시작한다',
      },
      {
        id: 'quote',
        label: '영상 속 말로 시작',
        instruction: '영상 속 말을 짧게 따옴표로 옮기며 시작한다',
      },
      {
        id: 'me',
        label: '내 얘기로 시작',
        instruction: '내 상황 이야기로 시작하고, 장면은 뒤에서 짚는다',
      },
      {
        id: 'exclaim',
        label: '짧은 감탄으로 시작',
        instruction:
          '두세 글자 감탄(예: 와, 헐, 아니)으로 시작한다. "진짜"로 시작하지 않는다',
      },
      {
        id: 'scene',
        label: '장면 묘사로 시작',
        instruction: '장면을 내 말로 짧게 묘사하며 시작한다',
      },
      {
        id: 'time',
        label: '시점으로 시작',
        instruction: '장면의 시점(분:초)을 먼저 짚으며 시작한다',
      },
    ],
  },
  {
    key: 'brandWay',
    title: '홍보 대상 꺼내는 방식',
    options: [
      {
        id: 'heard',
        label: '들은 말로',
        instruction: '주변이나 인터넷에서 들은 말로 꺼낸다 (예: ~잘 본다던데)',
      },
      {
        id: 'friend',
        label: '친구 얘기로',
        instruction:
          '친구가 이야기하던 걸 떠올리는 식으로 꺼낸다. 친구가 받아 봤다·맞았다는 말은 쓰지 않는다',
      },
      {
        id: 'search',
        label: '찾아본 기억으로',
        instruction: '검색하다가 이름을 본 적 있다는 식으로 꺼낸다',
      },
      {
        id: 'wish',
        label: '해 보고 싶다는 마음으로',
        instruction: '나도 한번 봐 볼까 하는 마음으로 꺼낸다',
      },
      {
        id: 'ask',
        label: '다른 시청자에게 물어보며',
        instruction: '다른 시청자에게 묻는 식으로 꺼낸다 (예: ~ 아는 분?)',
      },
    ],
  },
  {
    key: 'brandSpot',
    title: '홍보 대상 넣는 자리',
    options: [
      {
        id: 'early',
        label: '앞쪽',
        instruction: '첫 문장이나 두 번째 문장에 넣는다',
      },
      {
        id: 'middle',
        label: '가운데',
        instruction: '글의 가운데에 넣고, 끝은 내 얘기나 영상 얘기로 맺는다',
      },
      { id: 'end', label: '끝', instruction: '마지막 문장에 넣는다' },
    ],
  },
];

/** 길이 칸 이름 */
const LENGTH_LABELS: Record<StyleLength, string> = {
  short: '짧게',
  medium: '보통',
  long: '길게',
};

/** 0 이상 1 미만의 수를 주는 함수 (테스트에서 고정값을 넣는다) */
export type Rng = () => number;

/**
 * 보기 하나를 고른다. 최근에 쓴 보기는 피하고(보기의 절반까지), 남은 것 중에서 고른다.
 * @param options 보기
 * @param recent 최근 초안이 고른 값 (최근 순)
 * @param rng 무작위 함수
 */
function pickOption<T extends { id: string }>(
  options: T[],
  recent: string[],
  rng: Rng,
): T {
  const avoid = new Set(recent.slice(0, Math.floor(options.length / 2)));
  const pool = options.filter((o) => !avoid.has(o.id));
  const list = pool.length > 0 ? pool : options;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * 이번 초안의 글 모양을 고른다.
 * @param recent 최근 초안의 글 모양 (최근 순, 이 기능 전 초안은 빈 값이라 건너뛴다)
 * @param opts.hasSceneTime 근거 장면에 시점이 있는지 (없으면 '시점으로 시작'을 고르지 않는다)
 * @param rng 무작위 함수 (기본 Math.random)
 */
export function pickStyle(
  recent: Partial<DraftStyle>[],
  opts: { hasSceneTime: boolean },
  rng: Rng = Math.random,
): DraftStyle {
  const picked = {} as Record<StyleDimensionKey, StyleOption>;
  for (const dim of STYLE_DIMENSIONS) {
    const options =
      dim.key === 'opening' && !opts.hasSceneTime
        ? dim.options.filter((o) => o.id !== 'time')
        : dim.options;
    const used = recent.map((r) => r[dim.key]).filter((v): v is string => !!v);
    picked[dim.key] = pickOption(options, used, rng);
  }
  const lengths = (['short', 'medium', 'long'] as const).map((id) => ({ id }));
  const length = pickOption(
    lengths,
    recent.map((r) => r.length).filter((v): v is StyleLength => !!v),
    rng,
  ).id;
  return {
    persona: picked.persona.id,
    tone: picked.tone.id,
    opening: picked.opening.id,
    brandWay: picked.brandWay.id,
    brandSpot: picked.brandSpot.id,
    length,
    summary: [
      picked.persona.label,
      picked.tone.label,
      picked.opening.label,
      `${picked.brandWay.label} ${picked.brandSpot.label}에`,
      LENGTH_LABELS[length],
    ].join(' · '),
  };
}

/**
 * 길이 칸의 글자 수 범위 (주제의 최소~최대를 셋으로 나누되 조금씩 겹치게, 위쪽은 15% 남기고, 5 단위)
 * @param length 길이 칸
 * @param min 주제 최소 글자 수
 * @param max 주제 최대 글자 수
 */
export function lengthRange(
  length: StyleLength,
  min: number,
  max: number,
): [number, number] {
  const span = max - min;
  const at = (r: number) => Math.round((min + span * r) / 5) * 5;
  // 상한에 붙여 쓰면 작은 모델이 넘치기 쉬워 위쪽을 15% 남긴다 (실제 Ollama: '길게'가 150자 상한에 163자)
  const [lo, hi] =
    length === 'short'
      ? [0, 0.4]
      : length === 'medium'
        ? [0.3, 0.6]
        : [0.5, 0.85];
  return [Math.max(min, at(lo)), Math.min(max, at(hi))];
}

/**
 * 프롬프트에 붙이는 글 모양 지시 (설정의 프롬프트 틀과 상관없이 코드가 붙인다)
 * @param style 이번 글 모양
 * @param topic 주제 글자 수 범위
 * @param sceneWords 장면 검사에 쓰는 단어·시점. 모양이 바뀌어도 장면은 꼭 짚게 그대로 넣으라고 한다
 */
export function styleBlock(
  style: DraftStyle,
  topic: { minLength: number; maxLength: number },
  sceneWords: string[] = [],
): string {
  const lines = STYLE_DIMENSIONS.map((dim) => {
    const option = dim.options.find((o) => o.id === style[dim.key]);
    return option ? `- ${dim.title}: ${option.instruction}` : null;
  }).filter(Boolean);
  const [lo, hi] = lengthRange(style.length, topic.minLength, topic.maxLength);
  return [
    '[이번 글 모양] 이 모양대로 쓴다',
    ...lines,
    `- 길이: ${lo}~${hi}자 안팎 (광고 표시는 세지 않는다)`,
    ...(sceneWords.length > 0
      ? [
          `- 장면: 다음 중 하나 이상을 글에 그대로 넣어 장면을 짚는다: ${sceneWords.join(', ')}`,
        ]
      : []),
  ].join('\n');
}
