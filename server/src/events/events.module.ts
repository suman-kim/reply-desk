import { Global, Module } from '@nestjs/common';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

/**
 * 실시간 이벤트 모듈. 여러 모듈이 emit하므로 전역으로 둔다(어디서나 EventsService를 주입).
 */
@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
