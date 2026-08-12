import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  POINTS_HANDLERS,
  PointsCronService,
  PointsTaskPayload,
} from './points.cron';

/**
 * Cloud Tasks entry point for points redemption lifecycle events.
 *
 * points.release-hold — fires at redemption.expiresAt. If the
 * redemption is still 'pending' (i.e. checkout never committed),
 * refunds the held points and flips status to 'released'.
 *
 * Self-registers with TaskHandlerRegistry via constructor.
 */
@Injectable()
export class PointsReleaseHoldTask implements TaskHandler<PointsTaskPayload> {
  readonly name = POINTS_HANDLERS.RELEASE_HOLD;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly cron: PointsCronService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: PointsTaskPayload }): Promise<void> {
    await this.cron.releaseHoldOne(payload.redemptionId);
  }
}
