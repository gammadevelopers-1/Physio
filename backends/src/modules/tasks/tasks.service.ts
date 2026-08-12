import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import {
  buildTaskName,
  buildTaskNamePrefix,
  TaskNameParts,
} from './task-name';
import { TaskEnvelope } from './task-payload';

export interface EnqueueOptions<TPayload = unknown> {
  /** Cloud Tasks queue id (must exist — provisioned by setup-cloud-tasks.sh) */
  queue: string;
  /** Handler slug registered on the dispatch endpoint (e.g. 'session.remind') */
  handler: string;
  /** Naming parts — entity/id/event/version */
  name: TaskNameParts;
  /** JSON-serialisable payload passed to the handler */
  payload: TPayload;
  /** When to fire the task (defaults to now) */
  scheduleAt?: Date;
  /**
   * Cancel-and-replace: if a task with the same entity/event but a
   * different version is already scheduled, delete it before enqueueing
   * the new one. Slightly slower (list + delete) but simpler for callers.
   * Default: false (rely on unique version).
   */
  replaceExisting?: boolean;
}

export interface CancelOptions {
  queue: string;
  name: TaskNameParts;
}

export interface CancelByEventOptions {
  queue: string;
  entity: string;
  id: string | number;
  event: string;
}

/**
 * Typed wrapper around @google-cloud/tasks.
 *
 * Design rules:
 *   1. Task names are deterministic — collisions ARE the correctness anchor.
 *   2. Cloud Tasks is the only supported infra (no BullMQ fallback). If it
 *      is disabled via TASKS_ENABLED=false, enqueue() logs + no-ops so
 *      local dev without ADC works; production must always have it on.
 *   3. All logging goes through Nest's Logger (structured), never console.
 *   4. Errors from Cloud Tasks are re-thrown as-is; callers decide policy.
 *      NOT_FOUND on cancel is swallowed (idempotent delete).
 */
@Injectable()
export class TasksService implements OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private readonly client: CloudTasksClient | null;
  private readonly enabled: boolean;
  private readonly projectId: string;
  private readonly location: string;
  private readonly dispatchUrl: string;
  private readonly dispatcherServiceAccount: string;
  private readonly oidcAudience: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('TASKS_ENABLED', 'true') !== 'false';
    this.projectId =
      this.config.get<string>('GCP_PROJECT_ID', '') ||
      this.config.get<string>('GOOGLE_CLOUD_PROJECT', '');
    this.location = this.config.get<string>('TASKS_LOCATION', 'me-central2');
    this.dispatchUrl = this.config.get<string>('TASKS_DISPATCH_URL', '');
    this.dispatcherServiceAccount = this.config.get<string>(
      'TASKS_DISPATCHER_SA',
      '',
    );
    // OIDC audience must match the Cloud Run service URL (without path).
    // Derived from the dispatch URL's origin.
    this.oidcAudience = this.config.get<string>(
      'TASKS_OIDC_AUDIENCE',
      this.dispatchUrl ? new URL(this.dispatchUrl).origin : '',
    );

    if (!this.enabled) {
      this.logger.warn(
        'Cloud Tasks disabled (TASKS_ENABLED=false). enqueue()/cancel() will no-op.',
      );
      this.client = null;
      return;
    }

    if (!this.projectId || !this.dispatchUrl || !this.dispatcherServiceAccount) {
      this.logger.error(
        'Cloud Tasks misconfigured. Required env: GCP_PROJECT_ID, TASKS_DISPATCH_URL, TASKS_DISPATCHER_SA.',
      );
      this.client = null;
      return;
    }

    this.client = new CloudTasksClient();
    this.logger.log(
      `Cloud Tasks ready — project=${this.projectId} location=${this.location} dispatch=${this.dispatchUrl}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => {});
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  /**
   * Enqueue a deferred task. Safe to call multiple times with the same
   * name — Cloud Tasks returns ALREADY_EXISTS, which we swallow.
   *
   * Returns the full task name path on success, or null when Cloud Tasks
   * is disabled.
   */
  async enqueue<TPayload>(
    opts: EnqueueOptions<TPayload>,
  ): Promise<string | null> {
    if (!this.client) return null;

    const taskId = buildTaskName(opts.name);
    const queuePath = this.client.queuePath(
      this.projectId,
      this.location,
      opts.queue,
    );
    const taskName = `${queuePath}/tasks/${taskId}`;

    if (opts.replaceExisting) {
      await this.cancelByEvent({
        queue: opts.queue,
        entity: opts.name.entity,
        id: opts.name.id,
        event: opts.name.event,
      });
    }

    const envelope: TaskEnvelope<TPayload> = {
      handler: opts.handler,
      entityId: String(opts.name.id),
      payload: opts.payload,
      taskVersion:
        typeof opts.name.version === 'bigint'
          ? Number(opts.name.version)
          : opts.name.version instanceof Date
            ? opts.name.version.getTime()
            : Math.trunc(opts.name.version),
      enqueuedAt: new Date().toISOString(),
    };

    const task: protos.google.cloud.tasks.v2.ITask = {
      name: taskName,
      httpRequest: {
        httpMethod: 'POST',
        url: this.dispatchUrl,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify(envelope)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: this.dispatcherServiceAccount,
          audience: this.oidcAudience,
        },
      },
    };

    if (opts.scheduleAt) {
      const seconds = Math.floor(opts.scheduleAt.getTime() / 1000);
      const nanos = (opts.scheduleAt.getTime() % 1000) * 1_000_000;
      task.scheduleTime = { seconds, nanos };
    }

    try {
      const [created] = await this.client.createTask({
        parent: queuePath,
        task,
      });
      return created.name ?? taskName;
    } catch (err: unknown) {
      const errorObj = err as { code?: number; message?: string };
      // 6 = ALREADY_EXISTS — same task name already enqueued (or was
      // recently deleted within Cloud Tasks' 1h dedup window). Both
      // outcomes are correct for our idempotency model — no-op.
      if (errorObj.code === 6) {
        this.logger.debug(
          `Task ${taskId} already exists in queue ${opts.queue} — enqueue is a no-op.`,
        );
        return taskName;
      }
      this.logger.error(
        `Cloud Tasks enqueue failed for ${taskId} in ${opts.queue}: ${errorObj.message}`,
      );
      throw err;
    }
  }

  /**
   * Delete a specific task by its full name parts. NOT_FOUND is
   * swallowed — the task may have already fired or been cancelled.
   */
  async cancel(opts: CancelOptions): Promise<boolean> {
    if (!this.client) return false;

    const taskId = buildTaskName(opts.name);
    const taskName = `${this.client.queuePath(
      this.projectId,
      this.location,
      opts.queue,
    )}/tasks/${taskId}`;

    try {
      await this.client.deleteTask({ name: taskName });
      return true;
    } catch (err: unknown) {
      const errorObj = err as { code?: number; message?: string };
      // 5 = NOT_FOUND — already fired or already deleted
      if (errorObj.code === 5) return false;
      this.logger.error(
        `Cloud Tasks delete failed for ${taskId}: ${errorObj.message}`,
      );
      throw err;
    }
  }

  /**
   * Delete every task for a given (entity, id, event) triple regardless
   * of version. Used on reschedule to clear stale versions before
   * enqueueing the new one.
   *
   * Cloud Tasks doesn't support prefix delete, so this lists + deletes.
   * Cost is one list-request + N delete-requests where N is typically 0
   * or 1. Callers that know the exact prior version should prefer
   * cancel() directly.
   */
  async cancelByEvent(opts: CancelByEventOptions): Promise<number> {
    if (!this.client) return 0;

    const queuePath = this.client.queuePath(
      this.projectId,
      this.location,
      opts.queue,
    );
    const prefix = buildTaskNamePrefix({
      entity: opts.entity,
      id: opts.id,
      event: opts.event,
    });

    let deleted = 0;
    // listTasks returns full task names; the last segment is the task ID.
    // Cloud Tasks doesn't support server-side filtering on the id, so we
    // filter client-side. Queues we use are small (<1k in-flight), so a
    // single page is enough for our patterns.
    const [tasks] = await this.client.listTasks({
      parent: queuePath,
      pageSize: 1000,
    });

    for (const task of tasks) {
      if (!task.name) continue;
      const id = task.name.substring(task.name.lastIndexOf('/') + 1);
      if (!id.startsWith(prefix)) continue;
      try {
        await this.client.deleteTask({ name: task.name });
        deleted++;
      } catch (err: unknown) {
        const errorObj = err as { code?: number };
        if (errorObj.code !== 5) throw err;
      }
    }

    return deleted;
  }
}
