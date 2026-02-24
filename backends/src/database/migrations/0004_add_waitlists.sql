CREATE TABLE "waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"position" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"notified_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "waitlists_status_check" CHECK ("waitlists"."status" IN ('waiting', 'notified', 'enrolled', 'expired', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlists_course_student_unique" ON "waitlists" USING btree ("course_id","student_id");
--> statement-breakpoint
CREATE INDEX "waitlists_course_id_idx" ON "waitlists" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "waitlists_student_id_idx" ON "waitlists" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX "waitlists_status_idx" ON "waitlists" USING btree ("status");
