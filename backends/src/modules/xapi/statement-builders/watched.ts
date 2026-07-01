import { NELC_EXTENSION, NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildPlatformExtension,
  buildVerb,
  nowIso,
  secondsToIso8601Duration,
  type PlatformBlock,
} from './helpers';

export interface WatchedStatementInput extends XapiBaseContext {
  /** True when the learner finished the video; false on partial views. */
  completed: boolean;
}

/**
 * Video watched statement. Object = the video activity (with duration).
 * Parent (contextActivities) = the lesson/module that owns the video.
 * Result carries completion flag + total video duration (ISO 8601).
 *
 * Per NELC official sample #3: context.extensions carries the platform
 * name block only. `parent` is an array per xAPI spec and carries no
 * description (checklist 3.10).
 */
export function buildWatchedStatement(
  input: WatchedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  if (input.activity.durationSeconds === undefined) {
    throw new Error('WatchedStatement requires activity.durationSeconds');
  }
  if (!input.parent) {
    throw new Error('WatchedStatement requires parent (lesson/module)');
  }

  return {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.WATCHED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
      contextActivities: {
        parent: [buildActivity(input.parent)],
      },
      extensions: {
        [NELC_EXTENSION.PLATFORM]: buildPlatformExtension(platform),
      },
    },
    result: {
      completion: input.completed,
      duration: secondsToIso8601Duration(input.activity.durationSeconds),
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
