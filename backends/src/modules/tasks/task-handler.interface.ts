/**
 * Contract every deferred-event handler must implement.
 *
 * The dispatch endpoint (POST /internal/tasks/dispatch) receives a
 * TaskEnvelope, looks up the handler by its `name`, and calls `run()`
 * with the entityId + payload.
 *
 * Handler guarantees to uphold (in this order of importance):
 *
 *   1. **Idempotent**. Cloud Tasks retries on 5xx. A handler that runs
 *      twice must produce the same end state — check "did-it" columns
 *      before writing (e.g. `if (row.reminderSentAt) return;`).
 *
 *   2. **Version-aware**. Payload includes `taskVersion`. If the row's
 *      current version doesn't match, no-op — a fresher task is queued
 *      or the row's state has moved on.
 *
 *   3. **Fast**. Cloud Tasks connection has a 30-min deadline but you
 *      should return within seconds. Fan out heavy work to BullMQ.
 *
 *   4. **Deterministic errors**. Throw with a message the dispatch
 *      endpoint can translate to 4xx (permanent, no retry) or 5xx
 *      (retryable). Use `PermanentTaskError` for the former.
 */
export interface TaskHandler<TPayload = unknown> {
  /** Unique handler slug — must match `TaskEnvelope.handler` */
  readonly name: string;

  /** Called by the dispatch endpoint for each delivery */
  run(input: { entityId: string; payload: TPayload; taskVersion: number }): Promise<void>;
}

/**
 * Throw from a handler to signal a permanent failure. The dispatch
 * endpoint responds 400 so Cloud Tasks stops retrying and the task
 * moves to the dead-letter queue (if configured).
 */
export class PermanentTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentTaskError';
  }
}
