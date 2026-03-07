CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"gateway" varchar(20) NOT NULL,
	"gateway_charge_id" varchar(255),
	"payment_method" varchar(20),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"gateway_response" jsonb,
	"error_code" varchar(50),
	"paid_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_gateway_check" CHECK ("payments"."gateway" IN ('tap', 'moyasar', 'tamara', 'tabby', 'mock')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback')),
	CONSTRAINT "payments_method_check" CHECK ("payments"."payment_method" IS NULL OR "payments"."payment_method" IN ('card', 'mada', 'apple_pay', 'bnpl'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(20) NOT NULL,
	"payment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"due_date" timestamp,
	"pdf_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid,
	"requested_by" uuid NOT NULL,
	"processed_by" uuid,
	"reason" varchar(30) NOT NULL,
	"reason_note" text,
	"original_amount" numeric(10, 2) NOT NULL,
	"deduction_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"deduction_reason" text,
	"refund_amount" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"gateway_refund_id" varchar(255),
	"approved_at" timestamp,
	"completed_at" timestamp,
	"rejected_at" timestamp,
	"rejection_note" text,
	"approval_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_reason_check" CHECK ("refunds"."reason" IN ('policy', 'cancelled', 'technical', 'duplicate', 'other')),
	CONSTRAINT "refunds_status_check" CHECK ("refunds"."status" IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"min_order_amount" numeric(10, 2),
	"applicable_courses" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_type_check" CHECK ("discount_codes"."type" IN ('percentage', 'fixed'))
);
--> statement-breakpoint
CREATE TABLE "discount_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_saved" numeric(10, 2) NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_status_check";--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "performed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "assignment_files" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submission_files" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "instructor_comment" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_comments" jsonb;--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "auto_transcribe" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_discount_id_discount_codes_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discount_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_course_id_idx" ON "payments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_gateway_idx" ON "payments" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_gateway_charge_id_idx" ON "payments" USING btree ("gateway_charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_user_id_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_payment_id_idx" ON "invoices" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_id_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_requested_by_idx" ON "refunds" USING btree ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_unique" ON "discount_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discount_codes_is_active_idx" ON "discount_codes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "discount_usage_unique" ON "discount_usage" USING btree ("discount_id","user_id","payment_id");--> statement-breakpoint
CREATE INDEX "discount_usage_discount_id_idx" ON "discount_usage" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_usage_user_id_idx" ON "discount_usage" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_status_check" CHECK ("enrollments"."status" IN ('pending_payment', 'active', 'completed', 'dropped', 'suspended'));