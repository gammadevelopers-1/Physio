/**
 * A Cloud Run Job that runs one of our extracted @Cron methods.
 *
 * Each JobHandler is an @Injectable() class registered in its home
 * module's providers list. Its constructor calls JobRegistry.register(this),
 * so at bootstrap time every JobHandler makes itself known via a shared
 * registry keyed by `name`. The main-job.ts entry point reads JOB_NAME
 * from env, asks the registry for the handler, and awaits its run().
 *
 * The name should match the value used in isCronExternalized() so both
 * halves of the extraction stay in sync (single source of truth is the
 * string literal in both places).
 */
export interface JobHandler {
  /**
   * Stable identifier for this job. Used by JobRegistry, by Cloud Run
   * Job's JOB_NAME env var, and by isCronExternalized() in the paired
   * @Cron method's kill-switch guard.
   */
  readonly name: string;

  /**
   * The work this job does. Should be idempotent — Cloud Scheduler
   * retries on failure and there is no guarantee an exception won't
   * cause a duplicate run.
   */
  run(): Promise<void>;
}
