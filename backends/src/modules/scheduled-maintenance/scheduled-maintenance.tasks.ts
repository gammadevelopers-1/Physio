import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  MaintenanceTaskPayload,
  MAINTENANCE_HANDLERS,
  ScheduledMaintenanceService,
} from './scheduled-maintenance.service';

/**
 * Cloud Tasks entry points for scheduled-maintenance lifecycle events.
 *
 * Each handler is a thin wrapper around the per-row method on the
 * service. The service methods are the source of truth for CAS +
 * status-transition semantics; these classes just adapt the
 * dispatch-endpoint contract to the service API.
 *
 * Handlers self-register with TaskHandlerRegistry in their
 * constructors so the module list doesn't need per-handler wiring
 * (matches the existing JobHandler pattern).
 */

@Injectable()
export class MaintenanceActivateTask implements TaskHandler<MaintenanceTaskPayload> {
  readonly name = MAINTENANCE_HANDLERS.ACTIVATE;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly service: ScheduledMaintenanceService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: MaintenanceTaskPayload }): Promise<void> {
    await this.service.activateOne(payload.windowId);
  }
}

@Injectable()
export class MaintenanceCompleteTask implements TaskHandler<MaintenanceTaskPayload> {
  readonly name = MAINTENANCE_HANDLERS.COMPLETE;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly service: ScheduledMaintenanceService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: MaintenanceTaskPayload }): Promise<void> {
    await this.service.completeOne(payload.windowId);
  }
}

@Injectable()
export class MaintenancePreNotifyTask implements TaskHandler<MaintenanceTaskPayload> {
  readonly name = MAINTENANCE_HANDLERS.PRE_NOTIFY;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly service: ScheduledMaintenanceService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: MaintenanceTaskPayload }): Promise<void> {
    await this.service.preNotifyOne(payload.windowId);
  }
}
