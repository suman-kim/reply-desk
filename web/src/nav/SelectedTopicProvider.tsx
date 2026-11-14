import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useTopics } from '../api/queries';
import { topicFromPath } from './paths';
import { readLastTopic, resolveTopicId, SelectedTopicContext, writeLastTopic, type SelectedTopicValue } from './selected-topic';

/**
 * 고른 주제를 주소에서 읽고, 마지막에 고른 주제를 기억한다(브라우저 저장소).
 * 공통 화면(계정 관리·설정)으로 옮겨도 고른 주제와 그 메뉴는 그대로 남고, 홈(/)으로 가면 고르지 않은 상태가 된다.
 * @param props.children 앱 화면
 */
export function SelectedTopicProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const topics = useTopics();
  const fromPath = topicFromPath(pathname);
  /** 앱을 열 때 기억하고 있던 주제 (한 번만 읽는다) */
  const [startTopicId] = useState(readLastTopic);
  const [remembered, setRemembered] = useState(startTopicId);

  // 주소가 주제를 가리키면(주제 화면·홈) 그 값을 기억한다. 공통 화면은 그대로 둔다 (그리는 중에 맞추는 파생 상태)
  const fromPathId = resolveTopicId(fromPath, remembered);
  if (fromPath !== undefined && fromPathId !== remembered) setRemembered(fromPathId);

  useEffect(() => writeLastTopic(remembered), [remembered]);

  // 없는 주제(지워짐)는 고르지 않은 것으로 본다
  const topic = topics.data?.find((t) => t.id === fromPathId) ?? null;
  const value = useMemo<SelectedTopicValue>(() => ({ topic, startTopicId }), [topic, startTopicId]);

  return <SelectedTopicContext.Provider value={value}>{children}</SelectedTopicContext.Provider>;
}
