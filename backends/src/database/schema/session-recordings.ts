import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions';

export const sessionRecordings = pgTable(
  'session_recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    meetingId: varchar('meeting_id', { length: 100 }).notNull(),
    recordingType: varchar('recording_type', { length: 50 }).notNull(),
    downloadUrl: text('download_url'),
    playUrl: text('play_url'),
    fileSize: integer('file_size'),
    fileType: varchar('file_type', { length: 20 }),
    recordingStart: timestamp('recording_start'),
    recordingEnd: timestamp('recording_end'),
    status: varchar('status', { length: 20 }).notNull().default('available'),
    password: varchar('password', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('session_recordings_session_id_idx').on(table.sessionId),
    index('session_recordings_meeting_id_idx').on(table.meetingId),
  ],
);

export const sessionRecordingsRelations = relations(
  sessionRecordings,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionRecordings.sessionId],
      references: [sessions.id],
    }),
  }),
);

export type SessionRecording = typeof sessionRecordings.$inferSelect;
export type NewSessionRecording = typeof sessionRecordings.$inferInsert;
