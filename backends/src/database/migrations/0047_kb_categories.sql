-- ===========================================
-- 0047: Help Center — dynamic categories
--
-- Replaces the hardcoded CHECK on kb_articles.category with a real
-- kb_categories table so admins can add / rename / delete categories.
-- Existing slugs are seeded so historical articles keep their category.
--
-- Idempotent — safe to re-run.
-- ===========================================

CREATE TABLE IF NOT EXISTS "kb_categories" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"        varchar(60) NOT NULL UNIQUE,
  "name_en"     varchar(120) NOT NULL,
  "name_ar"     varchar(120),
  "icon"        varchar(40) NOT NULL DEFAULT 'BookOpen',
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_by"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamp NOT NULL DEFAULT now(),
  "updated_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "kb_categories_sort_idx"
  ON "kb_categories" ("sort_order");

-- Seed default categories (matching the legacy CHECK list).
INSERT INTO "kb_categories" ("slug", "name_en", "name_ar", "icon", "sort_order")
VALUES
  ('billing',     'Billing',     'الفواتير',        'CreditCard', 10),
  ('login',       'Login',       'تسجيل الدخول',     'KeyRound',   20),
  ('certificate', 'Certificate', 'الشهادات',         'Award',      30),
  ('content',     'Content',     'المحتوى',          'BookOpen',   40),
  ('technical',   'Technical',   'تقني',             'Wrench',     50),
  ('other',       'Other',       'أخرى',             'HelpCircle', 60)
ON CONFLICT ("slug") DO NOTHING;

-- Drop the old CHECK constraint so admins can add new slugs.
ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_category_check";
