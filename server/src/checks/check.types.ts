/**
 * 자동 검사 공통 타입.
 * 검사 하나 = DraftCheck 구현 하나(전략 패턴). 새 검사는 클래스를 만들어 checks.module.ts의 목록에 넣으면 된다.
 */

/** 검사 결과 한 줄 (② 칸 체크리스트의 한 행) */
export interface CheckResult {
  /** 검사 코드 (예: length) */
  code: string;
  /** 화면에 보일 검사 이름 (예: 길이) */
  label: string;
  /** 통과했는지 */
  passed: boolean;
  /** 결과 설명 한 줄 (예: 87/120자, 링크가 들어 있어요 · 지워 주세요) */
  detail: string;
}

/** 검사에 필요한 값 */
export interface CheckContext {
  /** 검사할 댓글 글 */
  text: string;
  /** 주제 설정 중 검사에 쓰는 값 */
  topic: {
    /** 최소 글자 수 */
    minLength: number;
    /** 최대 글자 수 */
    maxLength: number;
    /** 브랜드 언급 검사 단어 (예: 운명원) */
    brandWord: string;
    /** 주제별 추가 금지 표현 */
    bannedWords: string[];
  };
  /** 영상 분석 (없으면 장면 언급 검사가 실패한다) */
  analysis: {
    /** 장면 핵심 단어 */
    sceneKeywords: string[];
    /** 근거 장면의 시점 목록 (예: 04:12) */
    sceneTimes: string[];
  } | null;
}

/** 검사 하나 */
export interface DraftCheck {
  /** 검사 코드 */
  readonly code: string;
  /**
   * 이 검사를 이번 글에 적용할지. 예: 추가 금지 표현이 없는 주제는 건너뛴다.
   * @param ctx 검사에 필요한 값
   */
  appliesTo(ctx: CheckContext): boolean;
  /**
   * 검사한다.
   * @param ctx 검사에 필요한 값
   */
  run(ctx: CheckContext): CheckResult;
}

/** DI 토큰: 등록된 검사 목록 */
export const DRAFT_CHECKS = Symbol('DRAFT_CHECKS');

/**
 * 글자 수를 센다. 이모지·한글 조합을 사람이 보는 글자 단위로 센다.
 * @param text 셀 글
 */
export function countChars(text: string): number {
  const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}
