import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  SESSION_HANDLERS,
  SessionReminderService,
  SessionTaskPayload,
} from './session-reminder.service';

/**
 * Cloud Tasks entry point for session lifecycle events.
 *
 * Only session.remind is wired in Phase 1.3 — session.end / session.warn-90
 * follow in Phase 1.4. Adding the class scaffolds here now would create
 * a "registered handler with no dispatcher" state; wait until the
 * matching migration lands.
 */

@Injectable()
export class SessionRemindTask implements TaskHandler<SessionTaskPayload> {
  readonly name = SESSION_HANDLERS.REMIND;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly reminder: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: SessionTaskPayload }): Promise<void> {
    await this.reminder.remindOne(payload.sessionId);
  }
}

@Injectable()
export class SessionWarn90Task implements TaskHandler<SessionTaskPayload> {
  readonly name = SESSION_HANDLERS.WARN_90;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly reminder: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: SessionTaskPayload }): Promise<void> {
    await this.reminder.warn90One(payload.sessionId);
  }
}

@Injectable()
export class SessionEndTask implements TaskHandler<SessionTaskPayload> {
  readonly name = SESSION_HANDLERS.END;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly reminder: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: SessionTaskPayload }): Promise<void> {
    await this.reminder.endOne(payload.sessionId);
  }
}

@Injectable()
export class SessionMarkMissedTask implements TaskHandler<SessionTaskPayload> {
  readonly name = SESSION_HANDLERS.MARK_MISSED;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly reminder: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: SessionTaskPayload }): Promise<void> {
    await this.reminder.markMissedOne(payload.sessionId);
  }
}
