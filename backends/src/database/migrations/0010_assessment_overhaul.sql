ALTER TABLE "assessments" ADD COLUMN "assignment_files" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submission_files" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "instructor_comment" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_comments" jsonb;
