-- Migration 0069 — sidebar_views
--
-- Tracks the last time each user "saw" a given sidebar tab. Drives
-- the sidebar alert badges across every dashboard: a tab's badge is
-- the count of items created/changed since the user's viewed_at row
-- for that tab. Visiting the tab bumps viewed_at = now() so the badge
-- clears naturally.
--
-- One row per (user_id, tab_key). tab_key is a stable identifier
-- owned by the API (e.g. "tickets:mine", "applications", "alerts").
-- Length 64 leaves headroom for future composite keys without a
-- schema change.

CREATE TABLE IF NOT EXISTS sidebar_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_key VARCHAR(64) NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sidebar_views_user_tab_unique
  ON sidebar_views (user_id, tab_key);

CREATE INDEX IF NOT EXISTS sidebar_views_user_id_idx
  ON sidebar_views (user_id);
