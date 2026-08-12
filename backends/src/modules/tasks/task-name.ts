/**
 * Deterministic Cloud Tasks task-name builder.
 *
 * Cloud Tasks deduplicates by task name globally per queue: enqueueing
 * a task with a name that already exists (or was deleted <1h ago) is
 * a hard error. That guarantee is the ONLY correctness anchor for our
 * "enqueue-on-write" pattern — without deterministic names, a race
 * between two concurrent updates on the same row would double-enqueue.
 *
 * Scheme: `{entity}--{id}--{event}--v{version}`
 *
 *   entity   Lowercase kebab identifier for the row type (e.g. "session")
 *   id       Row primary key. Any string that survives the character class
 *            (UUIDs and integers are both fine)
 *   event    Lowercase kebab lifecycle event (e.g. "remind", "end", "close")
 *   version  Monotonic version number for this (entity,id,event) triple.
 *            Convention: use the row's `updated_at` epoch milliseconds so
 *            any DB update naturally invalidates prior task names.
 *
 * Task IDs must match Cloud Tasks' allowed character class `[A-Za-z0-9_-]`
 * and are capped at 500 chars. This builder normalises anything invalid.
 */

const TASK_NAME_CHARSET = /[^A-Za-z0-9_-]/g;

export interface TaskNameParts {
  entity: string;
  id: string | number;
  event: string;
  version: number | bigint | Date;
}

export function buildTaskName(parts: TaskNameParts): string {
  const entity = sanitize(parts.entity);
  const id = sanitize(String(parts.id));
  const event = sanitize(parts.event);
  const version = normaliseVersion(parts.version);

  const name = `${entity}--${id}--${event}--v${version}`;

  if (name.length > 500) {
    throw new Error(
      `Task name exceeds 500 chars: ${name.slice(0, 80)}... (${name.length})`,
    );
  }

  return name;
}

/** Prefix used for `cancelByPrefix` — matches every version of one event. */
export function buildTaskNamePrefix(
  parts: Pick<TaskNameParts, 'entity' | 'id' | 'event'>,
): string {
  return `${sanitize(parts.entity)}--${sanitize(String(parts.id))}--${sanitize(
    parts.event,
  )}--v`;
}

/** Parse a task name back into its parts (best-effort — for logging). */
export function parseTaskName(name: string): TaskNameParts | null {
  const match = name.match(/^([^-]+(?:-[^-]+)*?)--(.+)--([^-]+(?:-[^-]+)*?)--v(\d+)$/);
  if (!match) return null;
  return {
    entity: match[1],
    id: match[2],
    event: match[3],
    version: Number(match[4]),
  };
}

function sanitize(input: string): string {
  const cleaned = input.replace(TASK_NAME_CHARSET, '_');
  if (!cleaned) {
    throw new Error(`Task name part is empty after sanitisation: "${input}"`);
  }
  return cleaned;
}

function normaliseVersion(version: number | bigint | Date): string {
  if (version instanceof Date) return String(version.getTime());
  if (typeof version === 'bigint') return version.toString();
  if (typeof version === 'number' && Number.isFinite(version)) {
    return String(Math.trunc(version));
  }
  throw new Error(`Invalid task version: ${String(version)}`);
}
