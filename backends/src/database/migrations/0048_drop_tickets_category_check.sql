-- ===========================================
-- 0048: Drop tickets_category_check
--
-- Categories are now admin-extensible via support_config.ticket_categories
-- (see SupportService.addTicketCategory). The DB-level CHECK that froze
-- the slug list to the 6 built-ins blocked every admin-created category
-- at insert time. Validation now happens at the service layer against
-- listTicketCategories(), which can grow at runtime without a migration.
--
-- The column itself stays varchar(30) and indexed; only the CHECK goes.
-- ===========================================

ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_category_check";
