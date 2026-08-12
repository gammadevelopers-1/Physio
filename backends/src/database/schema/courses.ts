import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  check,
  boolean,
  numeric,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id),
    managerId: uuid('manager_id').references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }),
    description: text('description'),
    descriptionAr: text('description_ar'),
    deliveryType: varchar('delivery_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    thumbnail: varchar('thumbnail', { length: 500 }),
    maxEnrollment: integer('max_enrollment'),
    price: numeric('price', { precision: 10, scale: 2 }).default('0'),
    // Course-level sale (no coupon needed). `price` stays the canonical original
    // price; the effective price is derived. Exactly one of salePercent /
    // saleAmount may be set at a time — a DB CHECK enforces it. salePercent
    // 1..100 (100 = free). saleAmount is a positive SAR value ≤ price
    // (validated at write time). Optional window — null start = already
    // active, null end = until cleared.
    salePercent: integer('sale_percent'),
    saleAmount: numeric('sale_amount', { precision: 10, scale: 2 }),
    saleStartsAt: timestamp('sale_starts_at'),
    saleEndsAt: timestamp('sale_ends_at'),
    // Finance-manager toggle: may a coupon ALSO be applied on top of this sale?
    // false (default) = sale OR coupon (mutually exclusive); true = stack.
    saleAllowsCoupon: boolean('sale_allows_coupon').notNull().default(false),
    // Safety cap: even if a coupon would discount more than this percentage
    // of the course price, the discount is capped at this %. 100 = no cap
    // (full discount allowed). Lets finance set "max 30% off this premium
    // course" without auditing every coupon's scope.
    maxDiscountPct: numeric('max_discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('100'),
    // Per-course VAT treatment override. 'standard' uses the global rate
    // from system_settings.tax; 'exempt' charges no VAT and prints no VAT
    // line on the invoice; 'zero_rated' charges 0% VAT but still prints a
    // "Zero-rated (0%)" line for ZATCA reporting. Default 'standard' keeps
    // existing behavior for all current rows.
    vatTreatment: varchar('vat_treatment', { length: 20 })
      .notNull()
      .default('standard'),
    cmeHours: integer('cme_hours').default(0),
    enrollmentDeadline: timestamp('enrollment_deadline'),
    isCmeAccredited: boolean('is_cme_accredited').default(false),
    language: varchar('language', { length: 10 }).default('en'),
    // start_date / end_date carry the full course window as UTC-stored
    // naive timestamps (same convention as enrollment_deadline). Frontend
    // reads via toRiyadhLocal() and writes via fromRiyadhLocal() so users
    // always pick and see Asia/Riyadh time regardless of viewer tz.
    // Historically these were `date` columns — migration 0114 widened
    // them to timestamp and backfilled existing rows to midnight Riyadh.
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    // At-risk thresholds
    atRiskAttendanceThreshold: integer('at_risk_attendance_threshold').default(70),
    atRiskScoreThreshold: integer('at_risk_score_threshold').default(60),
    atRiskInactivityDays: integer('at_risk_inactivity_days').default(7),
    // Cohort
    cohort: varchar('cohort', { length: 100 }),
    // Optional accreditation number (e.g. "ACA-20260000133").
    // When set, surfaced on every course-detail view AND embedded on the
    // issued certificate. When null/empty, hidden everywhere — no labels.
    accreditationNumber: varchar('accreditation_number', { length: 100 }),
    // External NELC (National eLearning Center) program-evaluation URL.
    // Surfaced on the student course-detail page above the certificate
    // button after completion — students click through to NELC's hosted
    // form. Stored verbatim; never validated, transformed, or proxied.
    nelcReviewLink: varchar('nelc_review_link', { length: 500 }),
    // Webinar Course toggle: when true, the webinar recording is surfaced
    // in enrolled students' dashboards after the event finishes (Zoom
    // typically takes 5–60 min to process). Default false — the manager
    // opts in per course. Non-Webinar courses ignore this field.
    recordingShareEnabled: boolean('recording_share_enabled').default(false).notNull(),
    // Course content fields (managed by course manager)
    overview: text('overview'),
    overviewAr: text('overview_ar'),
    objectives: jsonb('objectives').$type<string[]>(),
    objectivesAr: jsonb('objectives_ar').$type<string[]>(),
    features: jsonb('features').$type<string[]>(),
    featuresAr: jsonb('features_ar').$type<string[]>(),
    targetAudience: jsonb('target_audience').$type<string[]>(),
    targetAudienceAr: jsonb('target_audience_ar').$type<string[]>(),
    requirements: text('requirements'),
    requirementsAr: text('requirements_ar'),
    notices: text('notices'),
    noticesAr: text('notices_ar'),
    venue: varchar('venue', { length: 255 }),
    venueAr: varchar('venue_ar', { length: 255 }),
    // Per-course FAQ list — only rendered for zoom/online courses.
    // Each item is { question, questionAr, answer, answerAr }.
    faqs: jsonb('faqs').$type<Array<{
      question?: string;
      questionAr?: string;
      answer?: string;
      answerAr?: string;
    }>>(),
    showContents: boolean('show_contents').default(true),
    sectionsOrder: jsonb('sections_order').$type<string[]>(),
    // Per-course heading overrides for the public course-detail sections.
    // Any missing key/locale falls back to the Strapi course-detail-page
    // default. Keys mirror the section IDs used by the public renderer.
    sectionHeadings: jsonb('section_headings').$type<Partial<Record<
      | 'overview'
      | 'objectives'
      | 'features'
      | 'contents'
      | 'schedule'
      | 'requirements'
      | 'notices'
      | 'reviews'
      | 'targetAudience'
      | 'courseDetails'
      | 'faqs',
      { en?: string; ar?: string }
    >>>(),
    // Per-course custom sections authored by the manager. Each entry gets a
    // stable `id`; the section slots into the public page via the key
    // `custom:<id>` inside `sectionsOrder`, so it reorders alongside the
    // fixed sections without any special-case rendering paths.
    customSections: jsonb('custom_sections').$type<Array<{
      id: string;
      titleEn: string;
      titleAr?: string;
      contentEn?: string;
      contentAr?: string;
    }>>(),
    visibleOnPublicSite: boolean('visible_on_public_site').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    // Per-course SEO overrides. Empty fields fall back to title /
    // description / thumbnail in the metadata helper.
    seoTitle: varchar('seo_title', { length: 150 }),
    seoDescription: varchar('seo_description', { length: 300 }),
    seoKeywords: varchar('seo_keywords', { length: 500 }),
    seoOgImage: varchar('seo_og_image', { length: 500 }),
    seoNoindex: boolean('seo_noindex').default(false),
    // Course-level assessment defaults (per-assessment can override)
    assessmentProctoringEnabled: boolean('assessment_proctoring_enabled').default(false),
    assessmentTimeLimitEnforced: boolean('assessment_time_limit_enforced').default(true),
    assessmentMaxRetakes: integer('assessment_max_retakes').default(0),
    assessmentRetakeCoolingHours: integer('assessment_retake_cooling_hours').default(24),
    assessmentRetakeScorePolicy: varchar('assessment_retake_score_policy', { length: 20 }).default('highest'),
    assessmentRetakeScope: varchar('assessment_retake_scope', { length: 20 }).default('full'),
    // Review workflow
    reviewNote: varchar('review_note', { length: 1000 }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    // Cancellation audit (Phase A). Populated by the Cancel service; the
    // reason is mandatory at the service layer even though the column is
    // nullable (legacy rows have NULL).
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: uuid('cancelled_by').references(() => users.id),
    cancelReason: text('cancel_reason'),
    // Reschedule audit. `originalStartDate` snapshots the first known start
    // so the UI can show the pre-reschedule date after any number of moves.
    rescheduledAt: timestamp('rescheduled_at'),
    rescheduleReason: text('reschedule_reason'),
    originalStartDate: timestamp('original_start_date'),
    // End Course audit (Amna 2026-08). Populated when a manager/admin
    // clicks "End Course" on an active course (Active → Ended). Parallel
    // to the cron path that also produces `ended` but without a human
    // author. Reason is optional (client-confirmed 2026-08-01) — the
    // "why did you end this early?" field is a courtesy, not a gate.
    endedAt: timestamp('ended_at'),
    endedBy: uuid('ended_by').references(() => users.id),
    endReason: text('end_reason'),
    // preArchiveStatus captures the status the course held just before
    // it was archived. Set by the deactivate service, cleared by the
    // activate service when unarchiving. Enables ended → archived →
    // unarchive to return to ended (and completed → archived →
    // unarchive to return to completed) instead of always resetting to
    // active. Legacy rows archived before migration 0115 have NULL and
    // fall back to active on unarchive.
    preArchiveStatus: varchar('pre_archive_status', { length: 20 }),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by').references(() => users.id),
    // When true, a soft-deleted course row is hidden from admin / manager /
    // instructor listings but STILL resolvable by student-facing certificate
    // and verification routes. Set by the archive-then-delete path so that
    // learners keep working certificates + CME records for compliance even
    // after admins clean the course out of their views. Not set (false) by
    // any other delete path — ended-course deletion fully hides the row.
    hideFromAdminOnly: boolean('hide_from_admin_only').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('courses_instructor_id_idx').on(table.instructorId),
    index('courses_manager_id_idx').on(table.managerId),
    index('courses_status_idx').on(table.status),
    index('courses_deleted_at_idx').on(table.deletedAt),
    index('courses_cancelled_at_idx').on(table.cancelledAt),
    check(
      'courses_delivery_type_check',
      sql`${table.deliveryType} IN ('zoom', 'onsite', 'blended', 'self-paced', 'webinar')`,
    ),
    check(
      'courses_status_check',
      sql`${table.status} IN ('draft', 'pending_review', 'changes_requested', 'active', 'ended', 'completed', 'archived', 'cancelled')`,
    ),
    check(
      'courses_vat_treatment_check',
      sql`${table.vatTreatment} IN ('standard', 'exempt', 'zero_rated')`,
    ),
  ],
);

export const coursesRelations = relations(courses, ({ one }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
    relationName: 'courseInstructor',
  }),
  manager: one(users, {
    fields: [courses.managerId],
    references: [users.id],
    relationName: 'courseManager',
  }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export const COURSE_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  CHANGES_REQUESTED: 'changes_requested',
  ACTIVE: 'active',
  // ENDED — auto-set by course-completion.cron once endDate has passed
  // (or manually by manager/admin). A transitional "done teaching but not
  // yet reviewed" state. NO fanout fires here — certificates, CME awards,
  // xAPI completion, and student reviews all stay locked until a
  // manager/admin explicitly clicks Mark Completed to move ended → completed.
  // This lets managers decide when compliance artefacts get generated
  // instead of the calendar deciding for them.
  ENDED: 'ended',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
} as const;

export type CourseStatus =
  (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const DELIVERY_TYPE = {
  ZOOM: 'zoom',
  ONSITE: 'onsite',
  BLENDED: 'blended',
  SELF_PACED: 'self-paced',
  WEBINAR: 'webinar',
} as const;

export type DeliveryType =
  (typeof DELIVERY_TYPE)[keyof typeof DELIVERY_TYPE];

export const VAT_TREATMENT = {
  STANDARD: 'standard',
  EXEMPT: 'exempt',
  ZERO_RATED: 'zero_rated',
} as const;

export type VatTreatment = (typeof VAT_TREATMENT)[keyof typeof VAT_TREATMENT];
