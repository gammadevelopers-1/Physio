-- Store the Zoom webinar panelist join URL on each session_assistants
-- row so TAs can hit "Join session" and land directly on the panelist
-- (presenter) rights view — no extra registration required. Populated
-- lazily on TA approval / new-session propagation via
-- CourseAssistantsService.autoRegisterTAAsPanelist.
--
-- Nullable because: (a) meeting-only sessions never populate it, and
-- (b) webinar sessions populate it lazily — an assignment row can
-- exist before Zoom has been contacted.
ALTER TABLE session_assistants
  ADD COLUMN zoom_panelist_join_url text;
