-- Migration 0052: Knowledge Base search analytics
--
-- One row per search performed on the public help center. The point
-- is not to identify users — it's to surface what learners are looking
-- for and how often the KB has nothing to show them. The user_id is
-- nullable to keep guests in the dataset.
--
-- We DON'T store the actual matched article ids here — for an
-- analytics question ("which queries dead-end?") we only need the
-- count. If we ever need per-query click-through, that becomes a
-- separate `kb_search_clicks` table.

CREATE TABLE IF NOT EXISTS "kb_search_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lowercased query string. We trim + lowercase before insert to
  -- aggregate variants ("Login" vs "login") into one bucket.
  "query" VARCHAR(200) NOT NULL,

  -- en / ar — surfaces in the public KB tab toggle. Lets us split
  -- "what are Arabic learners searching for" from English.
  "locale" VARCHAR(5) NOT NULL,

  -- 0 means the search returned nothing — the most actionable signal
  -- because it indicates a content gap.
  "results_count" INTEGER NOT NULL,

  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,

  "searched_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Hot-path indexes for the analytics queries:
-- - aggregate-by-query needs the (query) index
-- - the date filter on the admin report needs (searched_at) so the
--   scan is bounded to the requested window
CREATE INDEX IF NOT EXISTS "kb_search_events_query_idx"
  ON "kb_search_events" ("query");

CREATE INDEX IF NOT EXISTS "kb_search_events_searched_at_idx"
  ON "kb_search_events" ("searched_at");
