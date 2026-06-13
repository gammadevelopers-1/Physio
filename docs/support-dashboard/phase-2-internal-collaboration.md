# Phase 2 — Internal Collaboration on Support Tickets

**Status:** Locked for implementation (2026-06-13)
**Origin:** Amna's feedback (June 2026) — the support module should serve as the org's centralized internal ticketing system, not just a customer helpdesk.
**Owner:** Ghulam / Claude (Opus 4.7)

---

## 1. Concept

Hub-and-spoke collaboration. **Support is the broker on every ticket.**

- Any role files a ticket (already shipped in Phase 1 — all 6 dashboards have `/support` pages).
- Support reads, triages, and **loops in** the relevant department(s) as **collaborators**.
- Collaborators discuss with Support via an **internal channel** on the ticket. They never see the public thread's composer, and they never message the requester directly.
- Requester only ever sees Support's voice in the public channel. Support relays department input.

**Out of scope (deferred — explicitly rejected this round):**

- Team queues / pool routing
- Severity ladder (P0–P3)
- `is_internal` flag on tickets themselves
- Reports split (internal ops vs learner sat)
- KB workflow as a first-class queue
- Auto-loop on category

---

## 2. Categories — role-aware, course-aware

Stored in existing `support_config.ticket_categories` JSON column. Shape extended:

```json
{
  "slug": "refund",
  "labelEn": "Refund / Invoice",
  "labelAr": "...",
  "requiresCourse": true,
  "roles": ["student", "finance", "manager"],
  "suggestedDepartment": "finance"
}
```

### Seed list

| Slug                 | Course required | Visible to roles                       | Suggested dept |
|----------------------|:---------------:|----------------------------------------|----------------|
| `general_inquiry`    | ❌              | all                                    | support        |
| `account`            | ❌              | all                                    | support        |
| `platform_bug`       | ❌              | all                                    | admin          |
| `application`        | ❌              | all                                    | admin          |
| `feedback`           | ❌              | all                                    | support        |
| `other`              | ❌              | all                                    | support        |
| `enrollment`         | ✅              | student, manager                       | course_manager |
| `refund_invoice`     | ✅              | student, finance, manager              | finance        |
| `payment_system`     | ❌              | finance, admin                         | admin          |
| `course_content`     | ✅              | student, instructor, ta, manager       | instructor     |
| `assessment`         | ✅              | student, instructor, ta                | instructor     |
| `certificate_cme`    | ✅              | student, instructor, manager           | course_manager |
| `attendance_webinar` | ✅              | student, instructor, ta, manager       | instructor     |
| `course_approval`    | ✅              | instructor, manager                    | course_manager |
| `trainer_query`      | ✅              | instructor, ta                         | course_manager |
| `kb_update_request`  | ❌              | all staff (excl. student)              | admin          |

Admin can edit, add, reorder, disable via Settings → Categories.

---

## 3. Ticket creation — role-aware form

- Category dropdown filters by `roles[]` — student sees only categories tagged `student`, etc.
- If selected category has `requiresCourse=true`, the **Course** field appears and is required (server-validated).
- Course dropdown scoped per role:
  - **Student** → courses they're enrolled in
  - **Instructor** → courses they teach
  - **TA** → courses they assist (via `course_assistants`)
  - **Manager** → courses they manage
  - **Finance / Admin / Support** → full search (rare for them; allowed)
- Form validation: if `category.requiresCourse=true` and `dto.courseId` missing → 400 `course_required_for_category`.

---

## 4. Collaborators — schema

```sql
CREATE TABLE ticket_collaborators (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department  varchar(30) NOT NULL,
  added_by    uuid REFERENCES users(id),
  added_at    timestamp NOT NULL DEFAULT now(),
  removed_at  timestamp,
  UNIQUE (ticket_id, user_id)
);
CREATE INDEX ticket_collab_ticket_idx ON ticket_collaborators(ticket_id) WHERE removed_at IS NULL;
CREATE INDEX ticket_collab_user_idx   ON ticket_collaborators(user_id)   WHERE removed_at IS NULL;
```

### Departments

`course_manager`, `finance`, `admin`, `instructor`, `ta`, `supervisor`

### Loop-in flow

1. Support clicks **+ Loop in** on the ticket detail page.
2. Modal opens:
   - Step 1: Department picker (chips).
   - Step 2: User dropdown (filtered):
     - **Course-bound roles** (Instructor, TA, Manager) → only people tied to ticket's `courseId`. Each option labelled with their relationship to that course ("Instructor of <Course Title>", "TA of <Course Title>", "Manager of <Course Title>").
     - **Non-course-bound roles** → full member list with search.
   - When ticket has no `courseId` → Instructor/TA/Manager department options are **hidden** entirely.
3. On confirm:
   - Row inserted in `ticket_collaborators`.
   - Target user gets email + in-app badge.
   - Audit log entry.

### Removal

- Plain support agents: cannot remove others' adds.
- Supervisor + Admin: can remove any collaborator on any ticket.
- Sets `removed_at = now()` (soft delete — preserves audit trail).

### Auto-add via escalation

When Escalate (Fix #12) is invoked:

- All admin users get added as collaborators with `department='admin'`, `added_by=<escalator>`.
- Idempotent: re-escalation skips users already active in `ticket_collaborators`.

---

## 5. Visibility & posting matrix

| Actor                       | Read public | Read internal | Post public | Post internal | Change status |
|-----------------------------|:-----------:|:-------------:|:-----------:|:-------------:|:-------------:|
| Requester                   | ✅          | ❌            | ✅          | ❌            | ❌            |
| Collaborator (any dept)     | ✅          | ✅            | ❌          | ✅            | ❌            |
| Support agent               | ✅          | ✅            | ✅          | ✅            | ✅            |
| Supervisor / Admin          | ✅          | ✅            | ✅          | ✅            | ✅            |

Reuses existing `ticket_replies.is_internal` boolean. Service layer enforces matrix on read (`getTicketDetail`, `getTicketReplies`) and write (`addReply`).

---

## 6. Transfer ticket

`POST /tickets/:id/transfer` with body:

```ts
{
  toCategory: string,         // new category slug
  toDepartment: string,       // department to loop in
  userId?: string,            // specific person, optional (else all dept members or first member)
  noteToRequester?: string,   // optional override for the system message
}
```

On confirm:

1. Update `tickets.category` to `toCategory`.
2. Insert (or re-activate) collaborator row for target user(s) in `toDepartment`.
3. Post a **system message** (greyed-out, no Support attribution) in the public thread. Template from `support_config.transfer_message_template_en` / `_ar`. Variables: `{department}`, `{categoryLabel}`. Default:
   - EN: *"Your ticket has been routed to our {department} team for the {categoryLabel} matter. Support remains your point of contact."*
   - AR: equivalent.
4. Email the requester with the same copy.
5. Audit log `TICKET_TRANSFERRED { fromCategory, toCategory, toDepartment, toUserId }`.
6. **Assignee unchanged.** Support stays the broker.

---

## 7. CSAT skip for staff requesters

`resolveTicket` skips CSAT survey creation when the requester's role is not `STUDENT`. Implementation: lookup `requester.role` at resolve time; bail before survey insert.

No new flag on `tickets`. Derived behaviour.

---

## 8. Retire public guest form

**Delete:**

- `frontend/src/app/[locale]/support/page.tsx` (PublicTicketForm host)
- `frontend/src/app/[locale]/support/track/[token]/page.tsx`
- `frontend/src/components/support/PublicTicketForm.tsx`
- `frontend/src/components/support/GuestTicketTracker.tsx`
- `backends/src/modules/support/support.controller.ts`: `POST /tickets/guest`, `GET /tickets/guest/:token`
- `backends/src/modules/support/support.service.ts`: `createGuestTicket`, related guest helpers
- ReCAPTCHA wiring used only on this path
- Public-facing routes that link to it

**Keep:**

- `GUEST_USER_ID` row (audit integrity for historical tickets)
- Existing guest tickets in DB (read-only)

**Repoint:**

- Public landing "Contact support" / "Help" links → `/auth/signin?returnTo=/dashboard/student/support`.

---

## 9. Endpoints — final list

```
POST    /tickets/:id/collaborators              { department, userId }
DELETE  /tickets/:id/collaborators/:userId
GET     /tickets/:id/collaborators
POST    /tickets/:id/transfer                   { toCategory, toDepartment, userId?, noteToRequester? }
GET     /tickets?involved=true                  collaborator "Looped In" view
GET     /support/departments/:dept/members?courseId=<uuid?>
GET     /support/categories?role=<role>
GET     /support/my-courses                     role-aware (consolidates per-role lookups)
```

Visibility-aware existing endpoints:

- `GET /tickets/:id` — strip `is_internal=true` replies + collaborators list when caller is the requester
- `GET /tickets/:id/replies` — same filter
- `POST /tickets/:id/replies` — enforce posting matrix from §5

---

## 10. UI — fullscreen ticket chat

The current ticket detail page becomes a true fullscreen view — no dashboard sidebar, no role profile, no left navigation.

### Layout

- **Top bar**: `✕ Close` (returns to previous list) · ticket reference · subject · status chip · priority chip · escalation chip if any.
- **Main panel (left)**: chat thread + composer.
- **Right panel** (~320px): Ticket meta + Collaborators + Actions + Activity.

### Channel toggle (top of main panel)

- Single radio chip: `● Public  ○ Internal · 3 new`
- Switches thread + composer default lane.
- **Public lane**: white background, blue accent, banner *"Visible to requester"*.
- **Internal lane**: light amber background, amber accent, banner *"Internal — not visible to requester"*.

### Composer

- Always shows "Posting: Public ▾" dropdown (Support/Supervisor/Admin only).
- Collaborators: locked to Internal, no dropdown, label reads "Internal note".
- Requesters: locked to Public, no dropdown.
- Border colour matches the lane (blue/amber) as a safety cue.
- Attachment chips appear inline above Send button.

### Right panel

- **Ticket**: category, course (if any), requester (name + role badge).
- **Collaborators**: grouped by department. Each row: user name + relationship label + ⊘ remove (sup/admin only). `+ Loop in` button at the bottom.
- **Actions**: `Transfer`, `Escalate`, `Resolve`, `On hold ▾` (Support/Supervisor/Admin only).
- **Activity**: last 5 events (transferred, escalated, looped in <user>, status change). Inline timestamps.

### Role-aware ticket detail rendering

The same `/dashboard/.../support/[id]` page renders differently depending on the viewer's relationship to the ticket:

| Viewer is | Sees toggle | Sees right panel | Sees actions | Composer locked to |
|-----------|:-----------:|:----------------:|:------------:|--------------------|
| Requester | ❌          | minimal (no collaborators, no actions) | ❌ | Public |
| Collaborator | ✅       | collaborators (read-only), no actions | ❌ | Internal |
| Support / Supervisor / Admin | ✅ | full | ✅ | (default Public, toggle to Internal) |

Cross-role banner at top:
- "You are the requester on this ticket"
- "You are a collaborator on this ticket — replies are internal only"

---

## 11. UI — attachment chip (uniform shape)

Single shared component: `frontend/src/components/support/AttachmentChip.tsx`.

Used across:
- Ticket creation form
- Reply composer
- Sent message bubbles (both public + internal)
- Right-panel attachment list (if applicable)

### Shape

- All chips render at uniform height (~56px) and wrap nicely in a flex row.
- **File chip** (240×56): rounded, mime-typed icon (PDF / Doc / Sheet / Generic), filename mid-elided, size, `×` remove on hover (composer) or download icon (sent).
- **Image chip** (240×56): 56×56 thumbnail on the left + filename + size on the right.
- Click → fullscreen preview modal with download button.
- Drop-shadow hover state for affordance.

### Replaces

The current oversized PDF cards and large 250×150 image previews in `TicketDetailContent`.

---

## 12. UI — destructive confirm dialogs

All `window.confirm()` calls in the support module replaced with shadcn `<AlertDialog>`.

Standard shape:
- Title (e.g. "Remove attachment?")
- Description naming the thing (e.g. "INV_Template.pdf will be removed from this message.")
- Cancel (default outline)
- Destructive confirm (red bg)

Applies to:
- Remove attachment from composer
- Remove collaborator
- Cancel mid-transfer
- Discard unsent reply on close
- Delete macro / tag / category in Settings

i18n keys under `supportCommon.confirm.*`.

---

## 13. Sidebar — "Looped In" tab + badge

New entry on every staff dashboard sidebar (Instructor, Manager, Finance, TA, Admin, Support, Supervisor):

```
Support
  ├─ My Tickets         (badge: new replies on tickets I filed)
  ├─ Looped In   · 5    (badge: unread internal replies on tickets I'm collab on)
  └─ Knowledge Base
```

- Reuses badge framework from Phase 1 Fix #11.
- Adds one tab key to `sidebar_views`: `support_looped_in`.
- Backend feeds the badge from `ticket_collaborators` × `ticket_replies.is_internal=true` × `created_at > last_viewed_at`.

Student dashboard: no Looped In tab (students aren't collaborators).

---

## 14. Notifications matrix

| Event                                                  | Email | In-app badge                       |
|--------------------------------------------------------|:-----:|------------------------------------|
| Looped in (added as collaborator)                      | ✅    | ✅ Looped In tab                    |
| New internal reply on a ticket I'm collab on           | ✅    | ✅ Looped In tab                    |
| Ticket transferred (requester)                         | ✅    | ✅ My Tickets tab                   |
| Removed as collaborator                                | —     | —                                  |
| Escalation auto-added me as collab (admin team)        | ✅    | ✅ Looped In tab                    |

---

## 15. Audit events (new)

All capture IP via the request-context middleware from Fix #10.

- `TICKET_COLLABORATOR_ADDED` `{ ticketId, userId, department, addedBy }`
- `TICKET_COLLABORATOR_REMOVED` `{ ticketId, userId, removedBy }`
- `TICKET_TRANSFERRED` `{ ticketId, fromCategory, toCategory, toDepartment, toUserId }`

---

## 16. i18n

EN + AR keys, RTL verified:

- `ticketDetail.collaborators.*`
- `ticketDetail.transfer.*`
- `ticketDetail.loopIn.*`
- `ticketDetail.composer.public`, `.internal`
- `ticketDetail.attachments.*`
- `ticketDetail.banner.requester`, `.collaborator`
- `supportCommon.confirm.*`
- `support.categories.<slug>` (one per seeded category)
- `support.departments.<key>` (course_manager, finance, admin, instructor, ta, supervisor)
- `support.sidebar.loopedIn`

---

## 17. Migration sequence

### `0072_phase2_internal_collaboration.sql`

- `CREATE TABLE ticket_collaborators` + 2 partial indexes.
- `UPDATE support_config SET value = ...` to extend `ticket_categories` JSON entries with `requiresCourse`, `roles`, `suggestedDepartment`. Idempotent via JSONB jsonb_set per slug.
- Insert any missing category slugs from the §2 seed list.
- Insert default `transfer_message_template_en` / `_ar` rows.
- Extend audit-events check constraint to include the 3 new event types.

### `0073_retire_guest_support.sql`

- No schema change — code-only removals tracked under this migration number for sequencing/journal consistency.

**No backfill.** Existing tickets keep working. No auto-collaborators.

---

## 18. Effort plan — 5 days

| Day | Focus |
|-----|-------|
| 1 | Migration 0072 + Drizzle schema + collaborators service/controller + reply visibility enforcement |
| 2 | Transfer endpoint + course-aware member endpoint + role-aware category endpoint + role-aware my-courses + escalation→collaborator wiring + CSAT staff skip |
| 3 | Fullscreen `TicketDetailContent` rebuild: chat layout, Public/Internal toggle, banners, color cues, right panel rebuild, Loop-in modal, Transfer modal |
| 4 | `AttachmentChip` component (shared) + shadcn AlertDialog confirm wrapper + Looped In tab + sidebar badge wiring + role-aware ticket creation form |
| 5 | Retire public guest form + i18n EN/AR sweep + RTL pass + cross-role banners + QA + verify against this doc |

---

## 19. Verification checklist (post-build)

Walk this list before signalling "ready to deploy."

### Schema

- [ ] `ticket_collaborators` table exists with 2 partial indexes
- [ ] `support_config.ticket_categories` entries have `requiresCourse`, `roles`, `suggestedDepartment`
- [ ] `support_config.transfer_message_template_en` + `_ar` exist
- [ ] Audit-events check constraint includes 3 new types

### Backend behaviour

- [ ] `POST /tickets` rejects when `category.requiresCourse=true` and `courseId` missing
- [ ] `GET /tickets/:id` filters internal replies + collaborator list when caller is requester
- [ ] `POST /tickets/:id/replies` rejects requester posting internal, rejects collaborator posting public
- [ ] `POST /tickets/:id/collaborators` works for support/sup/admin; rejects plain dept members
- [ ] `DELETE /tickets/:id/collaborators/:userId` works for sup/admin; rejects plain support
- [ ] `POST /tickets/:id/transfer` updates category, adds collab, posts system message, emails requester, logs audit
- [ ] Escalate auto-adds admin team as collabs (idempotent)
- [ ] `GET /support/departments/instructor/members?courseId=…` returns only that course's instructor(s)
- [ ] Without `courseId`, course-bound dept endpoints return empty or 400
- [ ] CSAT skipped when requester role ≠ STUDENT
- [ ] Public guest endpoints respond 404 (removed)

### Frontend behaviour

- [ ] Ticket detail page is fullscreen (no dashboard chrome)
- [ ] `✕` close returns to previous list
- [ ] Public/Internal toggle visible to support/sup/admin/collaborator
- [ ] Color cues: blue (public), amber (internal)
- [ ] Composer locked to Public for requester, locked to Internal for collaborator
- [ ] Cross-role banner shows when viewer is requester OR collaborator
- [ ] Right panel hidden for requester (or minimal)
- [ ] Loop-in modal shows course-scoped members for Instructor/TA/Manager when courseId set
- [ ] Loop-in modal hides Instructor/TA/Manager dept options when no courseId
- [ ] Transfer modal posts system message + emails requester
- [ ] AttachmentChip used in: creation form, composer, sent message bubbles
- [ ] All confirm prompts use shadcn AlertDialog (no `window.confirm()` left in support code)
- [ ] Looped In tab appears in every staff sidebar with badge
- [ ] Category dropdown filters by role
- [ ] Course field appears + is required when category has `requiresCourse=true`
- [ ] Course dropdown shows role-scoped courses
- [ ] Public guest form pages return 404
- [ ] AR/RTL: all new UI mirrors correctly

### Cross-role smoke (manual)

- [ ] Login as student → file ticket about a course → only see public thread
- [ ] Login as support → see ticket, loop in Finance member, post internal note → requester doesn't see it
- [ ] Login as Finance member → see ticket in Looped In tab → can read both threads but can only post internal
- [ ] Login as support → Transfer ticket → requester sees system message + email
- [ ] Login as supervisor → escalate ticket → all admins appear as collaborators
- [ ] All audit log entries show IP address

---

## 20. Open follow-ups (post-Phase 2)

Out of scope this round but worth noting:

- Queues / team-pool routing
- Severity ladder (P0–P3)
- Reports split (internal ops vs learner sat) with `is_internal` flag on tickets
- KB workflow as first-class queue
- Slack/webhook integration for admin queue P0 alerts
- Per-queue SLA policies
