import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TasksService } from './tasks.service';
import { TaskHandlerRegistry } from './task-handler.registry';
import { OidcVerifierService } from './oidc-verifier.service';
import { TasksDispatchController } from './tasks-dispatch.controller';
import { DistributedLockService } from './distributed-lock.service';

/**
 * Global module — TasksService and TaskHandlerRegistry are injected
 * by every module that produces or consumes deferred events, so
 * @Global() spares each module from listing this in its imports
 * (same convention as JobsModule + NelcAuditModule).
 *
 * TasksDispatchController is only mounted here (nowhere else needs it).
 *
 * OIDC verification is a co-tenant of the tasks system because it
 * gates the only endpoint tasks call. Keeping it in this module means
 * anyone reasoning about tasks sees the full auth chain in one place.
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [TasksDispatchController],
  providers: [
    TasksService,
    TaskHandlerRegistry,
    OidcVerifierService,
    DistributedLockService,
  ],
  exports: [TasksService, TaskHandlerRegistry, DistributedLockService],
})
export class TasksModule {}
