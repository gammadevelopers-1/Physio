import { NELC_EXTENSION, NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext, XapiLearnerProfile } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildPlatformExtension,
  buildVerb,
  nowIso,
  type PlatformBlock,
} from './helpers';

export interface RegisteredStatementInput extends XapiBaseContext {
  /** Optional learner-profile fields NELC expects ONLY on this verb.
   *  Any field missing is simply omitted from the extension map. */
  profile?: XapiLearnerProfile;
}

/**
 * Course enrolment statement. Fires when an enrollment row is created.
 *
 * NELC matches this against the validator's "enrolment" step. The
 * learner-profile extensions (mobile, full name, nationality, DOB)
 * are best-effort — NELC accepts the statement with any subset.
 */
export function buildRegisteredStatement(
  input: RegisteredStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  const extensions: Record<string, unknown> = {
    [NELC_EXTENSION.PLATFORM]: buildPlatformExtension(platform),
    [NELC_EXTENSION.LMS_URL]: platform.identifier,
  };

  const profile = input.profile;
  if (profile?.courseDuration) {
    extensions[NELC_EXTENSION.DURATION] = profile.courseDuration;
  }
  if (profile?.mobileNo) {
    extensions[NELC_EXTENSION.LEARNER_MOBILE_NO] = profile.mobileNo;
  }
  if (profile?.fullName) {
    extensions[NELC_EXTENSION.LEARNER_FULL_NAME] = profile.fullName;
  }
  if (profile?.nationality) {
    extensions[NELC_EXTENSION.LEARNER_NATIONALITY] = profile.nationality;
  }
  if (profile?.dateOfBirth) {
    extensions[NELC_EXTENSION.DATE_OF_BIRTH] = profile.dateOfBirth;
  }
  if (profile?.programUrl) {
    extensions[NELC_EXTENSION.PROGRAM_URL] = profile.programUrl;
  }

  return {
    verb: buildVerb(NELC_VERB.REGISTERED),
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
      extensions,
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
