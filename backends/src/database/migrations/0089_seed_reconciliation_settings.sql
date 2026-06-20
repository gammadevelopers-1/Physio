-- ===========================================
-- Phase E.5 — seed reconciliation cron defaults
-- ===========================================
-- The cron service falls back to compile-time defaults if the key is
-- missing, so these inserts are just to make the defaults visible/editable
-- in the admin Settings tab. ON CONFLICT DO NOTHING keeps them safe to
-- re-run if a future migration is re-applied.

INSERT INTO reconciliation_settings (key, value) VALUES
  ('cron.scan_window_hours',
    to_jsonb(26)),
  ('cron.daily_digest_enabled',
    to_jsonb(true)),
  ('cron.stale_reminder.pending_hours',
    to_jsonb(24)),
  ('cron.stale_reminder.in_progress_hours',
    to_jsonb(72)),
  ('auto_escalate.missing_local',
    '{"afterHours": 6, "urgency": "high"}'::jsonb),
  ('auto_escalate.paid_no_receipt',
    '{"afterHours": 24, "urgency": "high"}'::jsonb),
  ('auto_escalate.orphan_receipt',
    '{"afterHours": 24, "urgency": "normal"}'::jsonb),
  ('auto_escalate.stuck_approval',
    '{"afterHours": 336, "urgency": "normal"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
