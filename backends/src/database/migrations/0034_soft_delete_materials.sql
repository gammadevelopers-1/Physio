-- 0034_soft_delete_materials.sql
--
-- Two-layer soft delete for course materials so the admin "Recently
-- deleted materials" panel can restore a material end-to-end (DB row
-- + GCS objects) and have it reappear in the instructor / manager
-- content list exactly where it was.
--
-- Behavior:
--   - DELETE on a material now sets `deleted_at = NOW(), deleted_by`.
--     The row stays in the table; all list queries filter
--     `WHERE deleted_at IS NULL`.
--   - GCS objects (main file, captions, transcript, every variant) are
--     still sent to GCS soft-delete on remove(), so the storage URLs
--     stop serving 200s — preserves the existing security posture.
--   - Restore = clear deleted_at on the row + restore each GCS object
--     from its latest soft-deleted generation.
--   - After the 90-day GCS soft-delete window, a separate purge job
--     (future cron) will hard-delete the rows.
--
-- Idempotent — safe to re-run.

ALTER TABLE course_materials
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

DO $$ BEGIN
  ALTER TABLE course_materials
    ADD CONSTRAINT course_materials_deleted_by_users_id_fk
    FOREIGN KEY (deleted_by) REFERENCES public.users(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS course_materials_deleted_at_idx
  ON course_materials USING btree (deleted_at);
