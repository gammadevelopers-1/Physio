import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  CsatTaskPayload,
  SlaMonitorService,
  TicketTaskPayload,
  TICKET_HANDLERS,
} from './sla-monitor.service';

/**
 * Cloud Tasks entry point for support/ticket lifecycle events.
 *
 * ticket.csat-send — fires at ticket.resolvedAt + 15min. Delegates to
 * SlaMonitorService.sendCsatEmailOne which CAS-flips the sentAt marker
 * before sending, so duplicate task deliveries can't double-email.
 */
@Injectable()
export class TicketCsatSendTask implements TaskHandler<CsatTaskPayload> {
  readonly name = TICKET_HANDLERS.CSAT_SEND;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly monitor: SlaMonitorService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: CsatTaskPayload }): Promise<void> {
    await this.monitor.sendCsatEmailOne(payload.surveyId);
  }
}

@Injectable()
export class TicketAutoCloseResolvedTask implements TaskHandler<TicketTaskPayload> {
  readonly name = TICKET_HANDLERS.AUTO_CLOSE_RESOLVED;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly monitor: SlaMonitorService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: TicketTaskPayload }): Promise<void> {
    await this.monitor.autoCloseResolvedOne(payload.ticketId);
  }
}

@Injectable()
export class TicketAutoCloseWaitingTask implements TaskHandler<TicketTaskPayload> {
  readonly name = TICKET_HANDLERS.AUTO_CLOSE_WAITING;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly monitor: SlaMonitorService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: TicketTaskPayload }): Promise<void> {
    await this.monitor.autoCloseWaitingOne(payload.ticketId);
  }
}
