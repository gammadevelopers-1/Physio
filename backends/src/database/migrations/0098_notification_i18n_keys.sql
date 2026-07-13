-- Add i18n key + params columns to notification tables.
--
-- Before this change, notification bodies were stored as pre-rendered strings
-- ("Instructor profile updated", "تمت الموافقة على الدورة", ...). Writers had
-- to branch on the recipient's language and store one of two literals, which
-- (a) didn't cover the admin_notifications flow at all (always English) and
-- (b) couldn't reflect a user changing their locale after the fact.
--
-- The new columns let writers store a translation KEY plus a params blob and
-- have the client render in the viewer's current UI locale. Legacy rows with
-- NULL keys still render via the raw title/description fallback.

ALTER TABLE admin_notifications
  ADD COLUMN IF NOT EXISTS title_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS title_params JSONB,
  ADD COLUMN IF NOT EXISTS description_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS description_params JSONB;

ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS title_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS title_params JSONB,
  ADD COLUMN IF NOT EXISTS message_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS message_params JSONB;
