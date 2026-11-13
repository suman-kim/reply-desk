import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyLiveEvent, LIVE_EVENT_TYPES, type LiveEvent } from './apply-event';

/** 실시간 연결 상태 (헤더에 작게 보인다) */
export type LiveStatus = 'connecting' | 'open' | 'reconnecting';

/**
 * 서버 실시간 이벤트(SSE)에 연결한다. 화면 전체에서 한 번만 쓴다.
 * 끊기면 EventSource가 스스로 다시 붙고, 다시 붙으면 놓친 것이 있을 수 있어 데이터를 모두 새로 읽는다.
 * @param topicId 보고 있는 주제 (없으면 모든 주제의 이벤트)
 */
export function useLiveEvents(topicId: number | null): LiveStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    const source = new EventSource(`/api/events${topicId ? `?topicId=${topicId}` : ''}`);
    let dropped = false;

    source.onopen = () => {
      setStatus('open');
      if (dropped) void qc.invalidateQueries();
      dropped = false;
    };
    source.onerror = () => {
      dropped = true;
      setStatus('reconnecting');
    };
    const onMessage = (msg: MessageEvent<string>) => {
      try {
        applyLiveEvent(qc, JSON.parse(msg.data) as LiveEvent);
      } catch {
        // 모양이 다른 이벤트는 무시한다 (서버가 새 이벤트를 먼저 보낼 수 있다)
      }
    };
    for (const type of LIVE_EVENT_TYPES) source.addEventListener(type, onMessage as EventListener);
    return () => source.close();
  }, [qc, topicId]);

  return status;
}
