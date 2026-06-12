-- Migration 0071 — drop dead escalation_paths table
--
-- The escalation_paths table was modeled but never wired into
-- runtime behavior. The SLA-breach cron in sla-monitor.service.ts
-- uses a hardcoded "next agent → supervisor" path, which is what
-- most teams actually use. Carrying an unused configuration table
-- (plus its CRUD endpoints, DTOs, and FK from support_macros) is
-- worse than re-adding it later if a real spec needs it.
--
-- Drop order matters:
--   1. Drop the FK column on support_macros (escalation_path_id)
--   2. Drop the table itself
--
-- If configurable multi-step escalation paths come back as a
-- requirement, rebuild as a proper feature (settings UI to edit
-- paths, breach cron reads + applies steps, default path seeded).

ALTER TABLE support_macros
  DROP COLUMN IF EXISTS escalation_path_id;

DROP TABLE IF EXISTS escalation_paths;
