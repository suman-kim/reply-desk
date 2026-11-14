import type { AiProviderId } from '../ai-provider.js';

/**
 * 모델 가격표. 제공자 모델 목록 API는 가격·무료 여부를 주지 않아, 공식 가격표에서 옮겨 적는다.
 * 가격은 바뀌므로 확인한 날짜와 출처를 함께 보이고, 표에 없는 모델은 '가격 정보 없음'으로 둔다(지어내지 않는다).
 */

/** 가격표를 확인한 날 */
export const PRICING_CHECKED_AT = '2026-11-13';

/** 제공자별 공식 가격표 */
export const PRICING_SOURCES: Record<AiProviderId, string | null> = {
  gemini: 'https://aistudio.google.com/docs/pricing',
  claude: 'https://platform.claude.com/docs/en/about-claude/pricing',
  openai: 'https://developers.openai.com/api/docs/pricing',
  ollama: null,
};

/** 모델 하나의 가격 (100만 토큰당 미국 달러, 표준·가장 짧은 문맥 기준) */
export interface ModelPricing {
  /** 입력 100만 토큰 가격 */
  inputPerM: number;
  /** 출력 100만 토큰 가격 */
  outputPerM: number;
  /** 무료로 쓸 수 있는지 (Gemini 무료 등급, Ollama) */
  free: boolean;
  /** 어떤 모델인지 한 줄 */
  summary: string;
  /** 알아 둘 것 (가격 인상 예정·지원 종료 등) */
  note?: string;
}

/** [모델 ID, 입력, 출력, 무료, 한 줄 설명, 알아 둘 것] */
type Row = [string, number, number, boolean, string, string?];

/** Gemini (무료 등급 여부는 가격표의 Free tier 칸) */
const GEMINI: Row[] = [
  [
    'gemini-4-carbon',
    2,
    10,
    false,
    '복잡한 코딩·수학·에이전트 추론',
    '2026-12-01부터 입력 $4·출력 $20',
  ],
  [
    'gemini-4-argon',
    2,
    10,
    false,
    '빠르고 효율적인 추론',
    '2026-12-01부터 입력 $4·출력 $20',
  ],
  ['gemini-4-hydrogen', 1.5, 7.5, true, '빠른 일상 작업·에이전트'],
  [
    'gemini-3.8-flash',
    0.75,
    3.75,
    true,
    '긴 작업·에이전트용 Flash',
    '2027-01-01부터 입력 $1.50·출력 $7.50',
  ],
  [
    'gemini-3.6-flash',
    0.75,
    3.75,
    true,
    '이전 세대 Flash (멀티모달)',
    '2027-01-01부터 입력 $1.50·출력 $7.50',
  ],
  ['gemini-3.5-flash-lite', 0.3, 2.5, true, '많이 돌리는 일에 싼 모델'],
  ['gemini-3.1-flash-lite', 0.25, 1.5, true, '많이 돌리는 일·번역에 싼 모델'],
  ['gemini-3.1-pro-preview', 2, 12, false, '3세대 Pro (멀티모달·에이전트)'],
  ['gemini-3-flash-preview', 0.5, 3, true, '예전 Flash'],
  ['gemini-2.5-pro', 1.25, 10, true, '코딩·복잡한 추론 Pro', '지원 종료 예정'],
  [
    'gemini-2.5-flash',
    0.3,
    2.5,
    true,
    '생각 예산을 쓰는 Flash',
    '지원 종료 예정 · 새 키는 막힐 수 있음',
  ],
  ['gemini-2.5-flash-lite', 0.1, 0.4, true, '작고 싼 모델'],
];

/** Claude (API 무료 등급 없음 · 새로 가입하면 시험용 크레딧) */
const CLAUDE: Row[] = [
  ['claude-fable-5-2', 8, 40, false, '최상위 등급 (가장 비싼 편)'],
  ['claude-fable-5-1', 10, 50, false, '최상위 등급 (이전 판)'],
  ['claude-fable-5', 10, 50, false, '최상위 등급 (이전 판)'],
  ['claude-opus-5-5', 4, 20, false, 'Opus: 가장 깊이 생각하는 고성능'],
  ['claude-opus-5', 5, 25, false, 'Opus 이전 판'],
  ['claude-opus-4-8', 5, 25, false, 'Opus 이전 판'],
  ['claude-opus-4-7', 5, 25, false, 'Opus 이전 판'],
  ['claude-opus-4-6', 5, 25, false, 'Opus 이전 판'],
  ['claude-opus-4-5', 5, 25, false, 'Opus 이전 판'],
  ['claude-sonnet-5-5', 2, 10, false, 'Sonnet: 성능과 가격의 균형'],
  ['claude-sonnet-5', 2, 10, false, 'Sonnet 이전 판'],
  ['claude-sonnet-4-6', 3, 15, false, 'Sonnet 이전 판'],
  ['claude-sonnet-4-5', 3, 15, false, 'Sonnet 이전 판'],
  [
    'claude-haiku-5-5',
    0.1,
    0.5,
    false,
    'Haiku: 가장 빠르고 싼 모델',
    '입력 10만 토큰을 넘으면 입력 $0.50·출력 $2.50',
  ],
  ['claude-haiku-4-5', 1, 5, false, 'Haiku 이전 판'],
];

/** OpenAI (텍스트 모델 무료 등급 없음). 설명은 가격대로만 적는다 */
const OPENAI: Row[] = [
  ['gpt-6-astra', 10, 50, false, '최상위 가격대'],
  ['gpt-6.1-sol', 2, 10, false, '중간 가격대'],
  ['gpt-6.1-terra', 1, 5, false, '중간 가격대'],
  ['gpt-6-luna', 0.1, 0.5, false, '가장 싼 가격대'],
  ['gpt-6-sol', 2, 10, false, '중간 가격대'],
  ['gpt-5.6-sol', 4, 20, false, '높은 가격대'],
  ['gpt-5.6-terra', 2, 12, false, '중간 가격대'],
  ['gpt-5.6-luna', 0.2, 1.2, false, '싼 가격대'],
  ['gpt-5.5-pro', 30, 180, false, 'Pro (매우 비쌈)'],
  ['gpt-5.5', 5, 30, false, '높은 가격대', '문맥 27.2만 토큰 이하 기준'],
  ['gpt-5.4-pro', 30, 180, false, 'Pro (매우 비쌈)'],
  ['gpt-5.4-mini', 0.75, 4.5, false, 'mini (싼 편)'],
  ['gpt-5.4-nano', 0.2, 1.25, false, 'nano (가장 싼 편)'],
  ['gpt-5.4', 2.5, 15, false, '중간 가격대', '문맥 27.2만 토큰 이하 기준'],
  ['gpt-5.2-pro', 21, 168, false, 'Pro (매우 비쌈)'],
  ['gpt-5.2', 1.75, 14, false, '중간 가격대'],
  ['gpt-5.1', 1.25, 10, false, '중간 가격대'],
  ['gpt-5-pro', 15, 120, false, 'Pro (매우 비쌈)'],
  ['gpt-5-mini', 0.25, 2, false, 'mini (싼 편)'],
  ['gpt-5-nano', 0.05, 0.4, false, 'nano (가장 싼 편)'],
  ['gpt-5', 1.25, 10, false, '중간 가격대'],
  ['gpt-4.1-mini', 0.4, 1.6, false, '예전 mini'],
  ['gpt-4.1', 2, 8, false, '예전 모델'],
  ['gpt-4o-mini', 0.15, 0.6, false, '예전 mini'],
  ['gpt-4o', 2.5, 10, false, '예전 모델'],
  ['o3', 2, 8, false, '예전 추론 모델'],
];

/** 제공자별 표 */
const TABLES: Partial<Record<AiProviderId, Row[]>> = {
  gemini: GEMINI,
  claude: CLAUDE,
  openai: OPENAI,
};

/**
 * 모델 가격. 날짜가 붙은 고정판(claude-haiku-4-5-20251001, gpt-5-2025-08-07)은 대표 이름으로 찾는다.
 * Ollama는 내 PC에서 돌려 늘 무료다.
 * @param provider 제공자
 * @param modelId 모델 ID
 * @returns 가격 (표에 없으면 null)
 */
export function pricingOf(
  provider: AiProviderId,
  modelId: string,
): ModelPricing | null {
  if (provider === 'ollama') {
    return {
      inputPerM: 0,
      outputPerM: 0,
      free: true,
      summary: '내 PC(AI PC)에서 돌려 요금이 없어요',
    };
  }
  const base = modelId.replace(/-\d{4}-?\d{2}-?\d{2}$/, '');
  const row = TABLES[provider]?.find(([id]) => id === modelId || id === base);
  if (!row) return null;
  const [, inputPerM, outputPerM, free, summary, note] = row;
  return { inputPerM, outputPerM, free, summary, ...(note ? { note } : {}) };
}
