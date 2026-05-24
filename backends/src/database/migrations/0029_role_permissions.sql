-- Dynamic per-role permissions matrix. Previously the admin Roles page
-- rendered a hardcoded SYSTEM_PERMISSIONS const on the frontend; this
-- moves the data to the DB so it can be edited via API/admin UI without
-- a redeploy. Shape per role:
--   {
--     "users": { "view": true, "create": false, "edit": false, "delete": false },
--     "courses": { ... },
--     ...
--   }
-- Categories: users, courses, content, assessments, certificates, finance,
-- reports, settings, security. Roles without an entry fall back to "all false".

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed defaults for the 7 system roles. Mirrors what the frontend used to
-- hardcode. Idempotent: only updates rows whose permissions are still empty,
-- so re-running the migration won't clobber operator edits.

UPDATE roles SET permissions = '{
  "users":        {"view": true, "create": true, "edit": true, "delete": true},
  "courses":      {"view": true, "create": true, "edit": true, "delete": true},
  "content":      {"view": true, "create": true, "edit": true, "delete": true},
  "assessments":  {"view": true, "create": true, "edit": true, "delete": true},
  "certificates": {"view": true, "create": true, "edit": true, "delete": true},
  "finance":      {"view": true, "create": true, "edit": true, "delete": true},
  "reports":      {"view": true, "create": true, "edit": true, "delete": true},
  "settings":     {"view": true, "create": true, "edit": true, "delete": true},
  "security":     {"view": true, "create": true, "edit": true, "delete": true}
}'::jsonb
WHERE name = 'SUPER_ADMIN' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": true, "create": true, "edit": true, "delete": true},
  "courses":      {"view": true, "create": true, "edit": true, "delete": true},
  "content":      {"view": true, "create": true, "edit": true, "delete": true},
  "assessments":  {"view": true, "create": true, "edit": true, "delete": true},
  "certificates": {"view": true, "create": true, "edit": true, "delete": true},
  "finance":      {"view": true, "create": true, "edit": true, "delete": true},
  "reports":      {"view": true, "create": true, "edit": true, "delete": true},
  "settings":     {"view": true, "create": true, "edit": true, "delete": true},
  "security":     {"view": true, "create": true, "edit": true, "delete": false}
}'::jsonb
WHERE name = 'ADMIN' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": true,  "create": false, "edit": false, "delete": false},
  "courses":      {"view": true,  "create": true,  "edit": true,  "delete": false},
  "content":      {"view": true,  "create": true,  "edit": true,  "delete": true},
  "assessments":  {"view": true,  "create": true,  "edit": true,  "delete": false},
  "certificates": {"view": true,  "create": false, "edit": false, "delete": false},
  "finance":      {"view": true,  "create": false, "edit": false, "delete": false},
  "reports":      {"view": true,  "create": true,  "edit": false, "delete": false},
  "settings":     {"view": false, "create": false, "edit": false, "delete": false},
  "security":     {"view": false, "create": false, "edit": false, "delete": false}
}'::jsonb
WHERE name = 'MANAGER' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": false, "create": false, "edit": false, "delete": false},
  "courses":      {"view": true,  "create": true,  "edit": true,  "delete": false},
  "content":      {"view": true,  "create": true,  "edit": true,  "delete": false},
  "assessments":  {"view": true,  "create": true,  "edit": true,  "delete": false},
  "certificates": {"view": true,  "create": false, "edit": false, "delete": false},
  "finance":      {"view": false, "create": false, "edit": false, "delete": false},
  "reports":      {"view": true,  "create": false, "edit": false, "delete": false},
  "settings":     {"view": false, "create": false, "edit": false, "delete": false},
  "security":     {"view": false, "create": false, "edit": false, "delete": false}
}'::jsonb
WHERE name = 'INSTRUCTOR' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": false, "create": false, "edit": false, "delete": false},
  "courses":      {"view": true,  "create": false, "edit": false, "delete": false},
  "content":      {"view": true,  "create": false, "edit": false, "delete": false},
  "assessments":  {"view": true,  "create": false, "edit": false, "delete": false},
  "certificates": {"view": true,  "create": false, "edit": false, "delete": false},
  "finance":      {"view": false, "create": false, "edit": false, "delete": false},
  "reports":      {"view": false, "create": false, "edit": false, "delete": false},
  "settings":     {"view": false, "create": false, "edit": false, "delete": false},
  "security":     {"view": false, "create": false, "edit": false, "delete": false}
}'::jsonb
WHERE name = 'STUDENT' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": true,  "create": false, "edit": false, "delete": false},
  "courses":      {"view": true,  "create": false, "edit": false, "delete": false},
  "content":      {"view": false, "create": false, "edit": false, "delete": false},
  "assessments":  {"view": false, "create": false, "edit": false, "delete": false},
  "certificates": {"view": true,  "create": false, "edit": false, "delete": false},
  "finance":      {"view": true,  "create": true,  "edit": true,  "delete": false},
  "reports":      {"view": true,  "create": true,  "edit": false, "delete": false},
  "settings":     {"view": false, "create": false, "edit": false, "delete": false},
  "security":     {"view": false, "create": false, "edit": false, "delete": false}
}'::jsonb
WHERE name = 'FINANCE' AND permissions = '{}'::jsonb;

UPDATE roles SET permissions = '{
  "users":        {"view": true,  "create": false, "edit": false, "delete": false},
  "courses":      {"view": true,  "create": false, "edit": false, "delete": false},
  "content":      {"view": true,  "create": false, "edit": false, "delete": false},
  "assessments":  {"view": false, "create": false, "edit": false, "delete": false},
  "certificates": {"view": false, "create": false, "edit": false, "delete": false},
  "finance":      {"view": false, "create": false, "edit": false, "delete": false},
  "reports":      {"view": true,  "create": false, "edit": false, "delete": false},
  "settings":     {"view": false, "create": false, "edit": false, "delete": false},
  "security":     {"view": false, "create": false, "edit": false, "delete": false}
}'::jsonb
WHERE name = 'SUPPORT' AND permissions = '{}'::jsonb;
