import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';

// ─── Tickets ──────────────────────────────────────────────

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Human-readable reference (e.g. T-000123). Auto-populated by a
    // sequence-backed DB default (migration 0050) so application code
    // never has to assign it on insert.
    referenceNumber: varchar('reference_number', { length: 20 })
      .notNull()
      .unique()
      .default(
        sql`'T-' || LPAD(nextval('tickets_reference_seq')::text, 6, '0')`,
      ),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 30 }).notNull(),
    priority: varchar('priority', { length: 10 }).notNull().default('medium'),
    subject: varchar('subject', { length: 200 }).notNull(),
    description: text('description').notNull(),
    attachmentUrl: varchar('attachment_url', { length: 500 }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 20 }).notNull().default('new'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    satisfactionRating: integer('satisfaction_rating'),
    firstResponseAt: timestamp('first_response_at'),
    slaBreachedFrt: boolean('sla_breached_frt').notNull().default(false),
    slaBreachedTtr: boolean('sla_breached_ttr').notNull().default(false),
    onHoldReason: varchar('on_hold_reason', { length: 100 }),
    onHoldAt: timestamp('on_hold_at'),
    onHoldTotalMinutes: integer('on_hold_total_minutes').notNull().default(0),
    onHoldResumedAt: timestamp('on_hold_resumed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    closedAt: timestamp('closed_at'),
    openedBy: uuid('opened_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Migration 0040 already created a partial unique index on this
    // column for non-null values. Mirror that uniqueness here so a
    // future `drizzle-kit generate` doesn't drop it on diff.
    guestTrackingToken: varchar('guest_tracking_token', { length: 100 }).unique(),
    guestName: varchar('guest_name', { length: 100 }),
    guestEmail: varchar('guest_email', { length: 255 }),
    // Populated when a supervisor merges this ticket into another one.
    // The source row stays for audit; the target becomes the live
    // ticket. See migration 0053 + SupportService.mergeTicket.
    mergedIntoTicketId: uuid('merged_into_ticket_id'),
  },
  (table) => [
    index('tickets_student_id_idx').on(table.studentId),
    index('tickets_status_idx').on(table.status),
    index('tickets_category_idx').on(table.category),
    index('tickets_assignee_id_idx').on(table.assigneeId),
    index('tickets_reference_number_idx').on(table.referenceNumber),
    check(
      'tickets_status_check',
      sql`${table.status} IN ('new', 'in_progress', 'on_hold', 'resolved', 'closed')`,
    ),
    // tickets_category_check intentionally absent — categories are
    // admin-extensible via support_config.ticket_categories (see
    // migration 0048). Validation lives in SupportService against the
    // live list so admins can grow the taxonomy without migrations.
    check(
      'tickets_priority_check',
      sql`${table.priority} IN ('high', 'medium', 'low')`,
    ),
    check(
      'tickets_rating_check',
      sql`${table.satisfactionRating} IS NULL OR (${table.satisfactionRating} >= 1 AND ${table.satisfactionRating} <= 5)`,
    ),
  ],
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  student: one(users, {
    fields: [tickets.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [tickets.courseId],
    references: [courses.id],
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
  }),
  replies: many(ticketReplies),
}));

// ─── Ticket Replies ──────────────────────────────────────

export const ticketReplies = pgTable(
  'ticket_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    isStaffReply: boolean('is_staff_reply').notNull().default(false),
    isInternal: boolean('is_internal').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ticket_replies_ticket_id_idx').on(table.ticketId),
    index('ticket_replies_user_id_idx').on(table.userId),
  ],
);

export const ticketRepliesRelations = relations(ticketReplies, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketReplies.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketReplies.userId],
    references: [users.id],
  }),
}));

// ─── Constants ──────────────────────────────────────────

export const TICKET_STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const TICKET_CATEGORY = {
  BILLING: 'billing',
  LOGIN: 'login',
  CONTENT: 'content',
  CERTIFICATE: 'certificate',
  TECHNICAL: 'technical',
  OTHER: 'other',
} as const;

export const TICKET_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

/**
 * Whitelisted on-hold reasons. Kept as a closed enum so the auto-close
 * cron in `sla-monitor.service.ts` can literal-match without breaking
 * on supervisor typos (e.g. "waitng for student" no longer auto-closes).
 * Add new reasons here AND update any cron that literal-matches them.
 */
export const ON_HOLD_REASONS = {
  WAITING_FOR_STUDENT_RESPONSE: 'waiting for student response',
  WAITING_FOR_THIRD_PARTY: 'waiting for third party',
  WAITING_FOR_INTERNAL_TEAM: 'waiting for internal team',
  PENDING_INVESTIGATION: 'pending investigation',
  OTHER: 'other',
} as const;
export type OnHoldReason =
  (typeof ON_HOLD_REASONS)[keyof typeof ON_HOLD_REASONS];

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type NewTicketReply = typeof ticketReplies.$inferInsert;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];
export type TicketCategory =
  (typeof TICKET_CATEGORY)[keyof typeof TICKET_CATEGORY];
export type TicketPriority =
  (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];

// Alias for the new support module (same table, clearer naming)
export const ticketComments = ticketReplies;
export const ticketCommentsRelations = ticketRepliesRelations;
export type TicketComment = TicketReply;

// Sentinel user ID for guest tickets (created via migration 0021)
export const GUEST_USER_ID = '00000000-0000-0000-0000-000000000001';
