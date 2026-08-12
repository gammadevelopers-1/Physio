import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogModule } from '../audit-logs/audit-logs.module';
import { RoleRequestsModule } from '../role-requests/role-requests.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SlaMonitorService } from './sla-monitor.service';
import {
  SlaBreachJob,
  PriorityEscalationJob,
  AutoCloseResolvedJob,
  AutoCloseWaitingJob,
  CsatEmailsJob,
  BusinessResumeSweepJob,
} from './support.jobs';
import {
  TicketCsatSendTask,
  TicketAutoCloseResolvedTask,
  TicketAutoCloseWaitingTask,
} from './support.tasks';

@Module({
  imports: [
    AuthModule,
    UserNotificationsModule,
    NotificationsModule,
    StorageModule,
    AuditLogModule,
    RoleRequestsModule,
  ],
  controllers: [SupportController],
  providers: [
    SupportService,
    SlaMonitorService,
    SlaBreachJob,
    PriorityEscalationJob,
    AutoCloseResolvedJob,
    AutoCloseWaitingJob,
    CsatEmailsJob,
    BusinessResumeSweepJob,
    // Cloud Tasks handlers — self-register with TaskHandlerRegistry.
    TicketCsatSendTask,
    TicketAutoCloseResolvedTask,
    TicketAutoCloseWaitingTask,
  ],
  // Export SlaMonitorService so SupportService (in this module) and
  // any downstream service that needs the CSAT enqueue helpers can
  // reach them.
  exports: [SupportService, SlaMonitorService],
})
export class SupportModule {}
