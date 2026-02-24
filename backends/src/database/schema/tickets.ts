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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    closedAt: timestamp('closed_at'),
  },
  (table) => [
    index('tickets_student_id_idx').on(table.studentId),
    index('tickets_status_idx').on(table.status),
    index('tickets_category_idx').on(table.category),
    index('tickets_assignee_id_idx').on(table.assigneeId),
    check(
      'tickets_status_check',
      sql`${table.status} IN ('new', 'in_progress', 'resolved', 'closed')`,
    ),
    check(
      'tickets_category_check',
      sql`${table.category} IN ('billing', 'login', 'content', 'certificate', 'technical', 'other')`,
    ),
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

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type NewTicketReply = typeof ticketReplies.$inferInsert;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];
export type TicketCategory =
  (typeof TICKET_CATEGORY)[keyof typeof TICKET_CATEGORY];
export type TicketPriority =
  (typeof TICKET_PRIORITY)[keyof typeof TICKET_PRIORITY];
