import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { SlaMonitorService } from './sla-monitor.service';

@Injectable()
export class SlaBreachJob implements JobHandler {
  readonly name = 'support.sla-breach';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.checkSlaBreaches();
  }
}

@Injectable()
export class PriorityEscalationJob implements JobHandler {
  readonly name = 'support.priority-escalation';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.checkPriorityEscalations();
  }
}

@Injectable()
export class AutoCloseResolvedJob implements JobHandler {
  readonly name = 'support.auto-close-resolved';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.autoCloseResolvedTickets();
  }
}

@Injectable()
export class AutoCloseWaitingJob implements JobHandler {
  readonly name = 'support.auto-close-waiting';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.autoCloseWaitingForStudent();
  }
}

@Injectable()
export class CsatEmailsJob implements JobHandler {
  readonly name = 'support.csat-emails';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.sendCsatEmails();
  }
}

@Injectable()
export class BusinessResumeSweepJob implements JobHandler {
  readonly name = 'support.business-resume-sweep';

  constructor(registry: JobRegistry, private readonly svc: SlaMonitorService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.sweepBusinessResumeAssignments();
  }
}
