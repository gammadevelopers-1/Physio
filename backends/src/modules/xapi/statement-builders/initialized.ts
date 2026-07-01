import { NELC_EXTENSION, NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildPlatformExtension,
  buildVerb,
  nowIso,
  type PlatformBlock,
} from './helpers';

/**
 * Course/session "started" statement. Fires the first time a learner
 * opens course content after enrolling. Object = the course (or session).
 *
 * Per NELC official sample #2: object has NO description, but
 * context.extensions carries the platform name block. Caller passes
 * activity.description = undefined.
 */
export function buildInitializedStatement(
  input: XapiBaseContext,
  platform: PlatformBlock,
): Record<string, unknown> {
  return {
    verb: buildVerb(NELC_VERB.INITIALIZED),
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
      extensions: {
        [NELC_EXTENSION.PLATFORM]: buildPlatformExtension(platform),
      },
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
