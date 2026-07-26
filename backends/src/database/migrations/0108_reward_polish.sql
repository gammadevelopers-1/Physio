-- Rewards polish pass (Milestone 10 follow-up)
--
-- 1) Coupon-campaign source trail — every campaign row can optionally trace
--    back to the points-reward redemption that minted it. Populated by
--    RewardsService.fulfillDiscountCoupon / fulfillFixedDiscountCoupon so the
--    finance dashboard can surface a "Points Reward" tab on coupons that were
--    NOT hand-crafted by a finance manager.
--
-- 2) Data migration for the free-course reward payload shape change. Prior
--    schema stored `{ courseId: "..." }`; the new schema is
--    `{ courseIds: ["...", ...] }` so an admin can bundle several courses
--    into a single reward and let the student pick one at redeem time.

ALTER TABLE coupon_campaigns
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_reward_id uuid,
  ADD COLUMN IF NOT EXISTS source_redemption_id uuid,
  ADD COLUMN IF NOT EXISTS source_user_id uuid;

CREATE INDEX IF NOT EXISTS coupon_campaigns_source_reward_id_idx
  ON coupon_campaigns (source_reward_id) WHERE source_reward_id IS NOT NULL;

-- Data migration: convert every existing free_course reward's payload from
-- {courseId: "..."} to {courseIds: ["..."]}. Idempotent — skips rows that
-- already have courseIds.
UPDATE reward_catalog
   SET payload = jsonb_build_object(
         'courseIds', jsonb_build_array(payload->>'courseId')
       )
 WHERE type = 'free_course'
   AND payload ? 'courseId'
   AND NOT (payload ? 'courseIds');
