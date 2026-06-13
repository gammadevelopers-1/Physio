-- Migration 0072 — Phase 2: ticket collaborators (hub-and-spoke internal collaboration)
--
-- Adds the `ticket_collaborators` table so Support agents can loop in
-- other departments (Finance, Course Manager, Admin, Instructor, TA,
-- Supervisor) as internal collaborators on a per-ticket basis.
--
-- Collaborators only see + post on the INTERNAL channel (the existing
-- ticket_replies.is_internal column). The requester never sees the
-- collaborator list or any internal replies.
--
-- Soft-delete via `removed_at` preserves the audit trail of who was
-- looped in / removed when. The `UNIQUE (ticket_id, user_id)`
-- constraint plus removed_at = NULL filter in the partial indexes is
-- what enforces "one active collaborator row per (ticket, user)".
-- A user removed and re-added gets the same row re-activated (removed_at
-- = NULL again), preserving the original added_at + added_by.

CREATE TABLE IF NOT EXISTS ticket_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department  VARCHAR(30) NOT NULL,
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMP,
  UNIQUE (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS ticket_collab_ticket_idx
  ON ticket_collaborators (ticket_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS ticket_collab_user_idx
  ON ticket_collaborators (user_id)
  WHERE removed_at IS NULL;

-- System-reply flag on ticket_replies. Phase-2 transfers post a thread
-- message that should render greyed-out without a Support attribution
-- ("your ticket has been routed to our Finance team..."). Adding a
-- column avoids in-band markers in the message text. Defaults to
-- false so every existing reply remains a normal reply.

ALTER TABLE ticket_replies
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Default transfer-system-message templates. Stored in support_config so
-- the supervisor can edit copy without a deploy. {department} and
-- {categoryLabel} are the supported template variables — see
-- SupportService.transferTicket for substitution.

INSERT INTO support_config (key, value, updated_at)
VALUES
  (
    'transfer_message_template_en',
    '"Your ticket has been routed to our {department} team for the {categoryLabel} matter. Support remains your point of contact."'::json,
    NOW()
  ),
  (
    'transfer_message_template_ar',
    '"تمت إحالة تذكرتك إلى فريق {department} لمعالجة موضوع {categoryLabel}. يبقى الدعم نقطة التواصل الخاصة بك."'::json,
    NOW()
  )
ON CONFLICT (key) DO NOTHING;
