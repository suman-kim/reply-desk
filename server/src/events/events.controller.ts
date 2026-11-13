import { Controller, Query, Sse, type MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import { EventsService } from './events.service.js';

/** 구독 조건 */
const streamQuerySchema = z.object({
  /** 화면이 보고 있는 주제 ID. 없으면 모든 주제의 이벤트를 받는다 */
  topicId: z.coerce.number().int().positive().optional(),
});

/**
 * 실시간 이벤트 API (Server-Sent Events).
 * - GET /api/events?topicId=  이벤트 흐름. 화면은 new EventSource('/api/events?topicId=1')로 열고
 *   addEventListener('draft.progress', …)처럼 이름별로 받는다. 이름 목록은 events/app-events.ts.
 *   25초마다 주석 줄(: ping)로 연결을 살려 둔다. 끊기면 EventSource가 스스로 다시 붙는다.
 */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /**
   * 이벤트 흐름
   * @param query 주제 ID
   */
  @Sse()
  stream(
    @Query({ schema: streamQuerySchema })
    query: z.infer<typeof streamQuerySchema>,
  ): Observable<MessageEvent> {
    return this.events.stream(query.topicId ?? null);
  }
}
