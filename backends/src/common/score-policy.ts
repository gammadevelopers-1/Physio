/**
 * Score policy helper — applies an assessment's `retakeScorePolicy` to a
 * student's list of attempts and returns the effective score plus which
 * attempt (if any) is the "winning" one.
 *
 * Used everywhere the system needs ONE score per (student, assessment) when
 * the student may have multiple attempts (original + manager-granted retakes):
 * - certificate eligibility
 * - course completion / NELC reports
 * - instructor student-detail page
 * - manager submissions list (which row is the effective one)
 *
 * For 'average' policy, no single attempt is "effective" — the score is the
 * mean across attempts. The result returns `effectiveAttemptId: null` and
 * `isAggregate: true` in that case.
 *
 * Attempts with `score === null` (still pending grading, or in_progress drafts)
 * are excluded from the calculation.
 */

export type ScorePolicy = 'highest' | 'latest' | 'average';

export interface AttemptForPolicy {
  id: string;
  score: number | null;
  // Used as tiebreaker for 'latest' and to order attempts. Either submittedAt
  // (preferred) or createdAt works.
  orderedAt: Date | string | null;
}

export interface EffectiveScoreResult<T extends AttemptForPolicy> {
  /** The effective score per the policy, or null if no scored attempts exist. */
  score: number | null;
  /**
   * The attempt that supplied the score for 'highest' / 'latest'. Null for
   * 'average' (the score is computed across attempts), or when no attempts
   * have been scored yet.
   */
  effectiveAttempt: T | null;
  /** True for 'average' — the score is computed, not pulled from one attempt. */
  isAggregate: boolean;
}

/**
 * Pick the effective score per the given policy.
 *
 * @param attempts Array of attempts for one (student, assessment). Order
 *   doesn't matter — the helper sorts internally.
 * @param policy 'highest' | 'latest' | 'average'. Falls back to 'highest' for
 *   any unrecognized value to mirror the schema default.
 */
export function computeEffectiveScore<T extends AttemptForPolicy>(
  attempts: T[],
  policy: string | null | undefined,
): EffectiveScoreResult<T> {
  const normalized: ScorePolicy =
    policy === 'latest' || policy === 'average' || policy === 'highest'
      ? policy
      : 'highest';

  const scored = attempts.filter((a) => a.score !== null);

  if (scored.length === 0) {
    return { score: null, effectiveAttempt: null, isAggregate: false };
  }

  if (normalized === 'highest') {
    let best = scored[0];
    for (const a of scored) {
      if ((a.score ?? -Infinity) > (best.score ?? -Infinity)) best = a;
    }
    return { score: best.score, effectiveAttempt: best, isAggregate: false };
  }

  if (normalized === 'latest') {
    // Sort by orderedAt descending. Nulls sort last.
    const sorted = [...scored].sort((a, b) => {
      const da = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
      const db = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
      return db - da;
    });
    const latest = sorted[0];
    return { score: latest.score, effectiveAttempt: latest, isAggregate: false };
  }

  // average
  const total = scored.reduce((s, a) => s + (a.score ?? 0), 0);
  const avg = total / scored.length;
  return { score: Math.round(avg), effectiveAttempt: null, isAggregate: true };
}

/**
 * Convenience: group a flat list of attempts by a key, then apply the policy
 * to each group. Returns a map of key → effective result.
 */
export function computeEffectiveScoresByGroup<T extends AttemptForPolicy>(
  attempts: T[],
  groupKey: (a: T) => string,
  policy: string | null | undefined,
): Map<string, EffectiveScoreResult<T>> {
  const groups = new Map<string, T[]>();
  for (const a of attempts) {
    const k = groupKey(a);
    const list = groups.get(k);
    if (list) list.push(a);
    else groups.set(k, [a]);
  }
  const result = new Map<string, EffectiveScoreResult<T>>();
  for (const [k, list] of groups) {
    result.set(k, computeEffectiveScore(list, policy));
  }
  return result;
}
