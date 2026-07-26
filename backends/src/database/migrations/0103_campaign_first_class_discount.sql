-- Campaign becomes a first-class discount owner
-- ============================================================
-- Before this migration:
--   coupon_campaigns was just a container. All discounting happened via
--   attached discount_codes. Even a site-wide festival flat-off had to be
--   implemented as an auto-apply code.
--
-- After this migration:
--   Campaigns can carry their own (type, value, scope) and apply directly
--   at checkout without a code. Existing behavior is preserved because new
--   rows default to `discount_type = 'none'` + `scope = 'code_only'`,
--   which matches the pre-migration "wrapper-only" semantics.
--
--   Two behavioral additions:
--     1. `campaign_type` distinguishes standard vs early_bird — powers the
--        Early Bird tab (filtered view of the same table).
--     2. `allows_coupon` gates whether a coupon can stack on top of a
--        campaign discount at checkout (same pattern as courses.sale_allows_coupon).
-- ============================================================

BEGIN;

-- ─── 1. New columns ────────────────────────────────────────────────────
ALTER TABLE coupon_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type varchar(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS discount_type varchar(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value numeric(10, 2),
  ADD COLUMN IF NOT EXISTS scope varchar(20) NOT NULL DEFAULT 'code_only',
  ADD COLUMN IF NOT EXISTS scope_delivery_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scope_course_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allows_coupon boolean NOT NULL DEFAULT false;

-- ─── 2. Guards ─────────────────────────────────────────────────────────
-- Campaign type
ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_campaign_type_check;
ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_campaign_type_check
  CHECK (campaign_type IN ('standard', 'early_bird'));

-- Discount type
ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_discount_type_check;
ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_discount_type_check
  CHECK (discount_type IN ('none', 'percentage', 'fixed'));

-- Scope
ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_scope_check;
ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_scope_check
  CHECK (scope IN ('code_only', 'all_paid', 'by_delivery_type', 'specific_courses'));

-- Discount value must be present when discount_type != 'none'
ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_discount_value_check;
ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_discount_value_check
  CHECK (
    (discount_type = 'none' AND discount_value IS NULL)
    OR (discount_type IN ('percentage', 'fixed') AND discount_value IS NOT NULL AND discount_value > 0)
  );

-- Percentage must be 1..100
ALTER TABLE coupon_campaigns
  DROP CONSTRAINT IF EXISTS coupon_campaigns_percentage_range_check;
ALTER TABLE coupon_campaigns
  ADD CONSTRAINT coupon_campaigns_percentage_range_check
  CHECK (
    discount_type != 'percentage'
    OR (discount_value >= 1 AND discount_value <= 100)
  );

-- ─── 3. Indexes for the new hot paths ──────────────────────────────────
CREATE INDEX IF NOT EXISTS coupon_campaigns_campaign_type_idx
  ON coupon_campaigns (campaign_type);
-- Partial index on active + non-code-only campaigns — the autoApply query
-- filters here. Keeps the index small and hot.
CREATE INDEX IF NOT EXISTS coupon_campaigns_active_direct_discount_idx
  ON coupon_campaigns (starts_at, ends_at)
  WHERE is_active = true AND discount_type != 'none';

-- ─── 4. Backfill Early Bird campaigns from existing codes ──────────────
-- Any existing discount_code with early_bird=true that ISN'T already
-- attached to a campaign gets its own "Early Bird — <CODE>" wrapper.
-- If a code is already in a campaign, we just mark that parent campaign
-- as campaign_type='early_bird' so it surfaces in the Early Bird tab.
--
-- We're intentionally NOT converting the code's discount into the campaign's
-- direct discount here — the code still owns the discount value and stays
-- an auto-apply code as before. The campaign is just a re-labelled wrapper
-- so managers see it in the Early Bird tab immediately.

-- 4a. Codes already in a campaign → flip parent type
UPDATE coupon_campaigns c
SET campaign_type = 'early_bird'
FROM discount_codes dc
WHERE dc.campaign_id = c.id
  AND dc.early_bird = true
  AND c.campaign_type = 'standard';

-- 4b. Standalone early_bird codes → create wrapper campaigns
WITH orphaned_codes AS (
  SELECT
    dc.id             AS code_id,
    dc.code           AS code,
    dc.valid_from     AS starts_at,
    dc.valid_until    AS ends_at,
    dc.created_by     AS created_by,
    dc.created_at     AS created_at
  FROM discount_codes dc
  WHERE dc.early_bird = true
    AND dc.campaign_id IS NULL
), inserted_campaigns AS (
  INSERT INTO coupon_campaigns (
    name,
    description,
    starts_at,
    ends_at,
    is_active,
    show_on_site,
    campaign_type,
    discount_type,
    scope,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    'Early Bird — ' || oc.code,
    'Auto-created wrapper for early-bird code ' || oc.code || ' (migration 0103).',
    oc.starts_at,
    oc.ends_at,
    true,
    false,
    'early_bird',
    'none',
    'code_only',
    oc.created_by,
    oc.created_at,
    NOW()
  FROM orphaned_codes oc
  RETURNING id, name
)
UPDATE discount_codes dc
SET campaign_id = ic.id
FROM inserted_campaigns ic, orphaned_codes oc
WHERE dc.id = oc.code_id
  AND ic.name = 'Early Bird — ' || oc.code;

COMMIT;
