/**
 * 주제와 매칭: AI가 영상 분석에서 매긴 "이 영상이 주제와 얼마나 맞는지"(0~100%)를 화면 값으로 바꾼다.
 * 기준(설정 analysis.topicMatchThreshold) 이상이면 '주제와 매칭됨', 미만이면 '매칭 낮음'으로 보인다.
 * 초안 작성·게시는 막지 않는다(영상을 고르고 [초안 작성]을 누른 것은 사람이다).
 */

/** 화면에 보일 매칭 값 */
export interface TopicMatchView {
  /** 매칭 퍼센트 (0~100) */
  percent: number;
  /** AI가 그렇게 매긴 이유 한 줄 */
  reason: string;
  /** 기준 이상인지 ('주제와 매칭됨') */
  matched: boolean;
  /** 판단에 쓴 기준 퍼센트 */
  threshold: number;
}

/**
 * 분석의 매칭 값을 화면 값으로 바꾼다
 * @param analysis 분석 (없으면 null). 이 기능 전에 한 분석은 매칭 값이 null이다
 * @param threshold 기준 퍼센트 (설정)
 * @returns 매칭 값, 분석이 없거나 매칭 전 분석이면 null
 */
export function toTopicMatch(
  analysis: {
    topicMatch: number | null;
    topicMatchReason: string | null;
  } | null,
  threshold: number,
): TopicMatchView | null {
  if (!analysis || analysis.topicMatch === null) return null;
  return {
    percent: analysis.topicMatch,
    reason: analysis.topicMatchReason ?? '',
    matched: analysis.topicMatch >= threshold,
    threshold,
  };
}

/**
 * AI가 준 퍼센트를 0~100 정수로 맞춘다 (모델이 소수·범위 밖 값을 줄 때가 있다)
 * @param value AI가 준 값
 */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
