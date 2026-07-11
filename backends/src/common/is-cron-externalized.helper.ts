/**
 * Kill switch for in-container @Cron methods that have been moved to
 * Cloud Run Jobs. Set EXTERNALIZED_CRONS to a comma-separated list of
 * cron names that should NOT fire from the NestJS scheduler:
 *
 *   EXTERNALIZED_CRONS=xapi.flush,zoom.attendance-sync
 *
 * Any @Cron method that starts with `if (isCronExternalized('xapi.flush')) return;`
 * will no-op when its name is in the list. The corresponding Cloud Run
 * Job (triggered by Cloud Scheduler) runs the same logic instead.
 *
 * Rollback: remove the cron's name from EXTERNALIZED_CRONS and redeploy.
 * The in-container @Cron resumes firing on its original schedule. The
 * Cloud Scheduler job should also be paused so it doesn't double-fire.
 */
export function isCronExternalized(cronName: string): boolean {
  const list = (process.env.EXTERNALIZED_CRONS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(cronName);
}
