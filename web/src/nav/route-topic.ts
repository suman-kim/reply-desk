import { useOutletContext } from 'react-router';
import type { Topic } from '../api/types';

/** 지금 화면의 주제 (TopicLayout 아래 화면 /t/:topicId/… 에서만. TopicLayout이 불러온 주제를 넘겨준다) */
export function useRouteTopic(): Topic {
  return useOutletContext<Topic>();
}
