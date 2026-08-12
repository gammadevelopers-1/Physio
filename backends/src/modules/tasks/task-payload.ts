/**
 * Envelope for every task the dispatch endpoint receives.
 *
 * Cloud Tasks POSTs the JSON body verbatim to /internal/tasks/dispatch.
 * The endpoint uses `handler` to route into TaskHandlerRegistry and
 * passes `payload` (typed by each handler) to the handler.
 *
 * `taskVersion` is echoed from the task name so the handler can compare
 * against the row's current version and no-op if this is a stale event
 * (rare — Cloud Tasks task-name dedup should prevent this, but the check
 * is cheap and closes any race window during reschedules).
 *
 * `entityId` is redundant with the task name but included in the body so
 * handlers don't need to parse the task name to know what to work on.
 */
export interface TaskEnvelope<TPayload = unknown> {
  handler: string;
  entityId: string;
  payload: TPayload;
  taskVersion: number;
  enqueuedAt: string;
}
