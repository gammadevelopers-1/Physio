CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"link" varchar(500),
	"is_read" boolean DEFAULT false NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"meeting_id" varchar(100) NOT NULL,
	"recording_type" varchar(50) NOT NULL,
	"download_url" text,
	"play_url" text,
	"file_size" integer,
	"file_type" varchar(20),
	"recording_start" timestamp,
	"recording_end" timestamp,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"password" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "recording_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notif_recipient_idx" ON "user_notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "user_notif_recipient_read_idx" ON "user_notifications" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "user_notif_created_idx" ON "user_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "session_recordings_session_id_idx" ON "session_recordings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_recordings_meeting_id_idx" ON "session_recordings" USING btree ("meeting_id");