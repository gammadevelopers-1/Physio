-- Fix #2: role-tagged categories. Prior custom categories (created via
-- the supervisor Categories panel before applicableRoles existed) get
-- a clean slate so the supervisor can recreate them properly with the
-- new role multi-select UI.
--
-- 1. Reassign any tickets that reference a custom category to 'other'
--    so the category label still renders after we delete the row.
--    (Built-in slugs are not in support_config, so they are untouched.)
-- 2. Delete the support_config entry holding the custom category list.

UPDATE tickets
SET category = 'other'
WHERE category IN (
  SELECT (cat ->> 'slug')::text
  FROM support_config sc
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(sc.value::jsonb) = 'array' THEN sc.value::jsonb
      ELSE '[]'::jsonb
    END
  ) AS cat
  WHERE sc.key = 'ticket_categories'
);

DELETE FROM support_config WHERE key = 'ticket_categories';
