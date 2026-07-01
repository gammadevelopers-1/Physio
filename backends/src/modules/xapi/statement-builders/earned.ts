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

export interface EarnedStatementInput extends XapiBaseContext {
  /** Public URL to the issued certificate PDF/image. Per NELC checklist
   *  6.1 ("Certificate ID and certificate URL are distinct fields"),
   *  object.id is the per-learner certificate INSTANCE id; this URL
   *  goes in context.extensions[jws-certificate-location] alongside the
   *  platform extension (per NELC official sample #11).
   *  Per 6.3, this URL MUST be publicly accessible (no LMS login). */
  certificateUrl: string;
}

/**
 * Certificate earned statement. Object = the certificate-instance
 * activity (per-learner — checklist 6.2). Parent (contextActivities)
 * = the course that produced it.
 *
 * Per NELC official sample #11: context.extensions carries both the
 * jws-certificate-location and the platform name block.
 */
export function buildEarnedStatement(
  input: EarnedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  if (!input.parent) {
    throw new Error('EarnedStatement requires parent (course)');
  }

  const extensions: Record<string, unknown> = {
    [NELC_EXTENSION.PLATFORM]: buildPlatformExtension(platform),
  };
  if (input.certificateUrl) {
    extensions[NELC_EXTENSION.JWS_CERTIFICATE_LOCATION] = input.certificateUrl;
  }

  return {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.EARNED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
      contextActivities: {
        parent: [buildActivity(input.parent)],
      },
      extensions,
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
