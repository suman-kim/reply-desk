import {
  Injectable,
  type MessageEvent,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  filter,
  interval,
  map,
  merge,
  Observable,
  Subject,
  takeUntil,
} from 'rxjs';
import type { AppEvent } from './app-events.js';

/** 연결을 살려 두는 신호 간격 (프록시·브라우저가 조용한 연결을 끊지 않게) */
export const HEARTBEAT_MS = 25_000;

/**
 * 앱 안 이벤트 통로 (관찰자 패턴).
 * 서비스는 emit만 하고, 누가 듣는지는 모른다. SSE 연결마다 stream()으로 구독한다.
 * 서버 하나라 메모리 Subject로 충분하다.
 */
@Injectable()
export class EventsService implements OnModuleDestroy {
  /** 이벤트 통로 */
  private readonly subject = new Subject<AppEvent>();
  /** 보낸 이벤트 번호 (SSE id) */
  private seq = 0;
  /** 서버가 꺼질 때 신호 (연결 유지 신호도 함께 끝낸다) */
  private readonly destroyed = new Subject<void>();

  /**
   * 이벤트를 보낸다
   * @param event 보낼 이벤트
   */
  emit(event: AppEvent): void {
    this.subject.next(event);
  }

  /**
   * 앱 안에서 이벤트를 듣는다 (테스트·다른 서비스용)
   */
  asObservable(): Observable<AppEvent> {
    return this.subject.asObservable();
  }

  /**
   * SSE 한 연결이 받을 흐름.
   * @param topicId 화면이 보고 있는 주제 (없으면 모든 주제)
   * @param heartbeatMs 살려 두는 신호 간격 (테스트에서 줄인다)
   */
  stream(
    topicId: number | null,
    heartbeatMs = HEARTBEAT_MS,
  ): Observable<MessageEvent> {
    const events = this.subject.pipe(
      filter(
        (e) => topicId === null || !('topicId' in e) || e.topicId === topicId,
      ),
      map((e): MessageEvent => ({
        id: String(++this.seq),
        type: e.type,
        data: e,
      })),
    );
    // 주석 줄(: ping)은 EventSource가 무시하지만 연결을 살려 둔다
    const heartbeat = interval(heartbeatMs).pipe(
      map((): MessageEvent => ({ comment: 'ping' })),
      takeUntil(this.destroyed),
    );
    return merge(events, heartbeat);
  }

  /** 서버가 꺼질 때 열린 연결을 끝낸다 */
  onModuleDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    this.subject.complete();
  }
}
