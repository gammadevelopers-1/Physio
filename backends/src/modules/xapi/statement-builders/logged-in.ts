import { NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildVerb,
  nowIso,
  type PlatformBlock,
} from './helpers';

/**
 * Login statement. NOT in the msaaq SDK (their journey skips login)
 * but Amna's checklist lists "User Login (National ID)" as step 1
 * so we send it.
 *
 * Differs from other statements in two ways:
 *   1. No instructor (login is platform-level, not course-level).
 *   2. Object = the platform itself (the LMS URL) with activity-type
 *      'module' as a safe default.
 *
 * Per NELC checklist 3.2: no context.extensions on non-register.
 */
export function buildLoggedInStatement(
  input: XapiBaseContext,
  platform: PlatformBlock,
): Record<string, unknown> {
  return {
    verb: buildVerb(NELC_VERB.LOGGED_IN),
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    context: {
      platform: platform.identifier,
      language: input.language,
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
