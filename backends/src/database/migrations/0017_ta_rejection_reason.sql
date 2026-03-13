ALTER TABLE "course_assistants" ADD COLUMN "rejection_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "rejected_at" timestamp;
