import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { SessionReminderService } from './session-reminder.service';

@Injectable()
export class SessionReminderNotifyJob implements JobHandler {
  readonly name = 'sessions.reminder-notify';

  constructor(
    registry: JobRegistry,
    private readonly service: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.checkUpcomingSessionsAndNotify();
  }
}

@Injectable()
export class SessionMarkMissedJob implements JobHandler {
  readonly name = 'sessions.mark-missed';

  constructor(
    registry: JobRegistry,
    private readonly service: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.autoMarkMissedSessions();
  }
}

@Injectable()
export class SessionEndExpiredJob implements JobHandler {
  readonly name = 'sessions.end-expired';

  constructor(
    registry: JobRegistry,
    private readonly service: SessionReminderService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.autoEndExpiredSessions();
  }
}
