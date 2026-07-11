import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

/**
 * Shared registry of all extracted-cron JobHandlers. Populated at
 * bootstrap by JobHandler classes calling register(this) from their
 * constructors — a simple plugin pattern that avoids threading a
 * list of handlers through Nest's DI as a multi-provider.
 *
 * main-job.ts (the Cloud Run Job entry point) reads JOB_NAME from
 * env, resolves it here, and awaits handler.run(). Both api-web and
 * api-worker services also instantiate this registry as part of
 * loading AppModule — harmless because no one calls .get() there.
 */
@Injectable()
export class JobRegistry {
  private readonly logger = new Logger(JobRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  register(handler: JobHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(
        `Duplicate job name "${handler.name}" — two JobHandler classes claim it. ` +
          `Pick a unique name so main-job.ts can resolve the intended one.`,
      );
    }
    this.handlers.set(handler.name, handler);
    this.logger.debug(`Registered job handler: ${handler.name}`);
  }

  get(name: string): JobHandler | undefined {
    return this.handlers.get(name);
  }

  list(): string[] {
    return [...this.handlers.keys()].sort();
  }
}
