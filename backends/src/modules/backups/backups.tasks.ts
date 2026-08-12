import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  BACKUP_HANDLERS,
  BackupTaskPayload,
  RestoreCloneService,
} from './restore-clone.service';

/**
 * Cloud Tasks entry point for backup restore-clone lifecycle.
 *
 * backup.purge-clone — fires at restore_clone.expiresAt. Delegates to
 * RestoreCloneService.purgeOne which idempotent-drops the sandbox DB
 * and updates the row.
 */
@Injectable()
export class BackupPurgeCloneTask implements TaskHandler<BackupTaskPayload> {
  readonly name = BACKUP_HANDLERS.PURGE_CLONE;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly restoreClone: RestoreCloneService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: BackupTaskPayload }): Promise<void> {
    await this.restoreClone.purgeOne(payload.cloneId);
  }
}
