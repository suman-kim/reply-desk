import { createContext, useContext } from 'react';
import type { Topic } from '../api/types';
import type { PathTopic } from './paths';

/** 브라우저 저장소 키: 마지막에 고른 주제 ID */
const LAST_TOPIC_KEY = 'rd.lastTopic';

/** 고른 주제 (사이드 메뉴·위쪽 막대·작업 패널이 함께 쓴다) */
export interface SelectedTopicValue {
  /** 고른 주제 (고르기 전이거나, 없는 주제거나, 주제를 불러오는 중이면 null) */
  topic: Topic | null;
  /** 앱을 열 때 기억하고 있던 주제 ID (홈에서 이어 갈 때 쓴다. 없으면 null) */
  startTopicId: number | null;
}

export const SelectedTopicContext = createContext<SelectedTopicValue | null>(null);

/** 고른 주제 (SelectedTopicProvider 안에서만) */
export function useSelectedTopic(): SelectedTopicValue {
  const v = useContext(SelectedTopicContext);
  if (!v) throw new Error('SelectedTopicProvider 안에서만 쓸 수 있어요');
  return v;
}

/**
 * 고른 주제 ID를 정한다.
 * - 주제 화면(/t/:id/…)이면 그 주제
 * - 홈(/)이면 고르지 않음
 * - 공통 화면(계정 관리·설정·새 주제)이면 마지막에 고른 주제를 그대로 둔다
 * @param fromPath 주소가 가리키는 주제 (topicFromPath)
 * @param remembered 마지막에 고른 주제
 */
export function resolveTopicId(fromPath: PathTopic, remembered: number | null): number | null {
  if (fromPath === undefined) return remembered;
  return fromPath === 'none' ? null : fromPath;
}

/** 마지막에 고른 주제 읽기 (저장소가 막힌 브라우저에서도 화면이 그려지게) */
export function readLastTopic(): number | null {
  try {
    return Number(localStorage.getItem(LAST_TOPIC_KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * 마지막에 고른 주제 쓰기
 * @param id 주제 ID (null이면 지운다)
 */
export function writeLastTopic(id: number | null): void {
  try {
    if (id) localStorage.setItem(LAST_TOPIC_KEY, String(id));
    else localStorage.removeItem(LAST_TOPIC_KEY);
  } catch {
    // 저장이 막혀도 이번 화면에서는 동작한다
  }
}
