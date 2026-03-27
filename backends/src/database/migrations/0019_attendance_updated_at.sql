ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
