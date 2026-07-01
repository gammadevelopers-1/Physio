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

export interface ProgressedStatementInput extends XapiBaseContext {
  /** True when this progress update represents completion. */
  completed: boolean;
}

/**
 * Progress update statement. Per NELC checklist 1.4: "Ensure progress
 * statements exist and their values increase monotonically over time."
 * Caller is responsible for monotonicity (don't emit unless new
 * progress > previous progress).
 *
 * Per NELC checklist 3.2: no context.extensions on non-register
 * statements.
 */
export function buildProgressedStatement(
  input: ProgressedStatementInput,
  platform: PlatformBlock,
): Record<string, unknown> {
  if (!input.activity.score) {
    throw new Error('ProgressedStatement requires activity.score');
  }
  const score = buildScore(input.activity.score);
  return {
    verb: buildVerb(NELC_VERB.PROGRESSED),
    actor: buildActor(input.actor),
    object: buildActivity(input.activity),
    context: {
      instructor: buildInstructor(input.instructor),
      platform: platform.identifier,
      language: input.language,
    },
    result: {
      completion: input.completed,
      score: { scaled: score.scaled },
    },
    timestamp: input.timestamp ?? nowIso(),
  };
}
