import { NELC_EXTENSION, NELC_VERB } from '../nelc-spec';
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

export interface AttemptedStatementInput extends XapiBaseContext {
  /** True when the submission has been finalised (graded or submitted),
   *  false for "started but not yet submitted" attempt-start statements. */
  completed: boolean;
  /** True when the learner achieved a passing score. Required even on
   *  attempt-start (pass false until graded). */
  succeeded: boolean;
  /** Per-attempt sequential identifier (1, 2, 3...). NELC checklist 1.6
   *  requires monotonic increment per learner per assessment, NOT a
   *  random UUID. Caller computes this from the count of prior
   *  submissions for (student, assessment) + 1. */
  attemptId: number;
}

/**
 * Assessment attempted statement. Object = the assessment activity
 * (activity-type UNIT_TEST, with passing-marks as score.min so NELC's
 * success rule "raw ≥ min" matches our pass logic). Result carries
 * score + pass flag + completion flag.
 *
 * Per NELC official sample #6: attempt-id lives in context.extensions
 * (not result.extensions). Object/parent descriptions are omitted
 * (checklist 3.10) — caller passes description: undefined for both.
 */
export function buildAttemptedStatement(
  input: AttemptedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  if (!input.parent) {
    throw new Error('AttemptedStatement requires parent (course)');
  }
  if (!input.activity.score) {
    throw new Error('AttemptedStatement requires activity.score');
  }

  return {
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    verb: buildVerb(NELC_VERB.ATTEMPTED),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
      contextActivities: {
        parent: [buildActivity(input.parent)],
      },
      extensions: {
        [NELC_EXTENSION.ATTEMPT_ID]: input.attemptId,
      },
    },
    result: {
      completion: input.completed,
      success: input.succeeded,
      score: buildScore(input.activity.score),
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
