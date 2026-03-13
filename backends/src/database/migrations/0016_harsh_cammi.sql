ALTER TABLE "course_assistants" DROP CONSTRAINT "course_assistants_status_check";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "priority" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "deactivation_scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_status_check" CHECK ("course_assistants"."status" IN ('suggested', 'pre_assigned', 'approved', 'rejected'));