import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobRegistry } from './modules/jobs/job-registry.service';

/**
 * Cloud Run Jobs entry point. Bootstraps NestJS as a headless
 * ApplicationContext (no HTTP listener), resolves the JobHandler
 * identified by the JOB_NAME env var, runs it, then exits.
 *
 * Cloud Scheduler triggers this indirectly by calling Cloud Run Jobs'
 * `run` REST endpoint on a schedule; the Job pulls the same image the
 * main API + worker services use, but Cloud Run overrides CMD to
 * `node dist/src/main-job` and sets JOB_NAME to the extracted-cron
 * identifier.
 *
 * Exit codes: 0 = success, 1 = failure. Cloud Run Jobs surfaces the
 * exit code in its execution history so alerting can fire on non-zero.
 * Cloud Scheduler retries with exponential backoff on non-zero.
 */
async function bootstrap() {
  const logger = new Logger('JobBootstrap');
  const jobName = process.env.JOB_NAME;

  if (!jobName) {
    logger.error(
      'JOB_NAME env var required (set it in the Cloud Run Job definition)',
    );
    process.exit(1);
  }

  // Cloud Run Jobs never want the in-process @Cron scheduler — the
  // whole point is that Cloud Scheduler triggers this Job. Force
  // SKIP_CRONS on so AppModule skips ScheduleModule.forRoot() even
  // if the Cloud Run Job definition forgot to set it.
  process.env.SKIP_CRONS = 'true';
  // Same for BullMQ workers: a one-shot Job shouldn't spin up Worker
  // instances that outlive the job's actual run(). Producers still
  // work because BullModule.registerQueue is unaffected by this.
  process.env.SKIP_BULLMQ_WORKERS = 'true';

  const startedAt = Date.now();
  logger.log(`Starting job: ${jobName}`);

  // createApplicationContext instead of create — no HTTP server. Job
  // process lives just long enough to run handler.run() and exit.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const registry = app.get(JobRegistry);
    const handler = registry.get(jobName);

    if (!handler) {
      logger.error(
        `Job "${jobName}" not registered. Available: ${registry.list().join(', ') || '(none)'}`,
      );
      await app.close();
      process.exit(1);
    }

    await handler.run();

    const durationMs = Date.now() - startedAt;
    logger.log(`Job "${jobName}" completed successfully in ${durationMs}ms`);
    await app.close();
    process.exit(0);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logger.error(`Job "${jobName}" failed after ${durationMs}ms`, err);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
