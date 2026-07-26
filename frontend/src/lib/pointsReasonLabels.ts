/**
 * Point-ledger reason code → i18n key map.
 *
 * Every reason string inserted into `point_transactions` (see the backend
 * schema comment at `backends/src/database/schema/point-transactions.ts`)
 * must have an entry here. Missing entries fall back to the raw reason
 * string at render time so a new reason introduced backend-first still
 * shows something readable-ish rather than blowing up.
 *
 * Callers (admin User History tab, student RecentActivityList, etc.) look
 * up the key here and pass it to `useTranslations()` — i18n copy lives in
 * `messages/{en,ar}.json` under the namespace listed against each key.
 */
export const POINT_REASON_I18N_KEYS: Record<string, string> = {
  // Earn rules — awarded by `PointsService.award()` for the seeded rule keys.
  'earn:signup': 'earnSignup',
  'earn:course_completed': 'earnCourseCompleted',
  'earn:review_approved': 'earnReviewApproved',
  // Admin manual grants (positive or negative delta).
  'admin:grant': 'adminGrant',
  'admin:deduct': 'adminDeduct',
  // Redemption saga (course unlocks + reward-catalog redemptions).
  'redeem:hold': 'redeemHold',
  'redeem:committed': 'redeemCommitted',
  'redeem:course:committed': 'redeemCourseCommitted',
  'redeem:released': 'redeemReleased',
  // Course cancellation → reverse the `earn:course_completed` credit.
  'reverse:course_cancelled': 'reverseCourseCancelled',
  // Daily cron-authored expiry marker (delta=0 tombstone).
  'system:expire': 'systemExpire',
};
