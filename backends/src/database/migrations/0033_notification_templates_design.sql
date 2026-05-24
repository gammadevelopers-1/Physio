-- 0033_notification_templates_design.sql
--
-- Adds two columns to support the admin Templates page:
--   - design_json: the Unlayer drag-drop editor design (so the admin
--     can re-open an edited email in the visual editor without parsing
--     HTML back into blocks).
--   - preheader: the inbox preview snippet shown under the subject
--     line in most email clients.
--
-- Nullable for backward compat — existing rows (none in production yet
-- but defensive) and the in-code defaults keep working unchanged.

ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS design_json JSONB,
  ADD COLUMN IF NOT EXISTS preheader TEXT;
