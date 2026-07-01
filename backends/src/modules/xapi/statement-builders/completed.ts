import { NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildVerb,
  nowIso,
  type PlatformBlock,
} from './helpers';

/**
 * "Completed" statement. Same verb across:
 *   - lesson completed (activity.type = LESSON, parent = course)
 *   - module completed (activity.type = MODULE, parent = course)
 *   - course completed (activity.type = COURSE, parent omitted)
 *
 * NELC keys on the activity-type IRI in object.definition.type to
 * distinguish them; the verb stays 'completed' for all three. Webinars
 * use the dedicated `attended` verb (see attended.ts), NOT this.
 *
 * Per NELC samples #4/#7/#9: no context.extensions; no description on
 * object or parent (caller must pass description: undefined).
 */
export function buildCompletedStatement(
  input: XapiBaseContext,
  platform: PlatformBlock,
): Record<string, unknown> {
  const statement: Record<string, unknown> = {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.COMPLETED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
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
