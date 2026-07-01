import { NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildVerb,
  nowIso,
  secondsToIso8601Duration,
  type PlatformBlock,
} from './helpers';

export interface AttendedStatementInput extends XapiBaseContext {
  /** Webinar attendance duration in seconds. Goes into result.duration
   *  (ISO-8601). */
  durationSeconds: number;
}

/**
 * Live webinar / virtual classroom attendance statement. Object = the
 * session activity (activity-type VIRTUAL_CLASSROOM, per NELC official
 * sample #5). Parent (contextActivities) = the parent course/program.
 *
 * Per NELC sample #5: no context.extensions; object + parent carry no
 * description (caller passes description: undefined).
 */
export function buildAttendedStatement(
  input: AttendedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  const statement: Record<string, unknown> = {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.ATTENDED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
    },
    result: {
      completion: true,
      duration: secondsToIso8601Duration(input.durationSeconds),
    },
    timestamp: input.timestamp ?? nowIso(),
  };

  if (input.parent) {
    (statement.context as Record<string, unknown>).contextActivities = {
      parent: [buildActivity(input.parent)],
    };
  }

  return statement;
}
