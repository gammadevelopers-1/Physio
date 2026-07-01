import { NELC_VERB } from '../nelc-spec';
import type { XapiBaseContext } from '../types';
import {
  buildActivity,
  buildActor,
  buildInstructor,
  buildScore,
  buildVerb,
  nowIso,
  type PlatformBlock,
} from './helpers';

export interface RatedStatementInput extends XapiBaseContext {
  /** Rating in 0–1 range per NELC checklist 5.3: "Ensure rating
   *  statements have a score between 0 and 1." Caller converts a
   *  5-star rating by dividing (e.g. 4 stars → raw=0.8, min=0, max=1). */
  rating: { raw: number; min: number; max: number };
  /** Free-text review per NELC checklist 5.4 — required. Caller passes
   *  empty string if the learner skipped, but synthesizing a default
   *  ("Course rating: X/5") is preferable. */
  reviewText: string;
}

/**
 * Rating / feedback statement. Object = the course (no description per
 * NELC 3.10). Result carries score (0–1) + the review text.
 *
 * Per NELC checklist 3.2: no context.extensions on non-register
 * statements.
 */
export function buildRatedStatement(
  input: RatedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  return {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.RATED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
    },
    result: {
      score: buildScore(input.rating),
      response: input.reviewText,
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
