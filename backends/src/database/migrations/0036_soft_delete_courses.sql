-- 0036_soft_delete_courses.sql
--
-- Soft delete for courses so the admin can delete courses in ANY
-- status (draft, active, completed, archived, etc.) and recover
-- them later from the "Recently deleted courses" panel in the
-- Backups tab.
--
-- Same shape as the materials soft-delete (0034):
--   - DELETE sets deleted_at + deleted_by; row stays in the table.
--   - All course list / detail queries filter `deleted_at IS NULL`,
--     so deleted courses disappear from every UI surface (admin
--     dashboard, student catalog, instructor list, public site).
--   - Restore clears deleted_at; the course reappears exactly where
--     it was, with its modules, materials, enrollments, sessions,
--     payments, and certificates intact (those rows are never
--     touched on delete).
--   - Cascade FKs on dependent tables remain — they only fire on a
--     true hard delete (not used by the app), so the soft-delete
--     is non-destructive end to end.
--
-- Idempotent — safe to re-run.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

DO $$ BEGIN
  ALTER TABLE courses
    ADD CONSTRAINT courses_deleted_by_users_id_fk
    FOREIGN KEY (deleted_by) REFERENCES public.users(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS courses_deleted_at_idx
  ON courses USING btree (deleted_at);
