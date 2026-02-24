# Implementation Plan: Section 8 — Support & Help Center

## Context

Sections 1–7 of the Learner Dashboard spec are complete. This plan implements **Submit a Ticket (8.1)** and **My Tickets (8.2)** from Section 8.

**FAQ & Self-Help (8.3)** already exists — a public FAQ page at `/faq` integrated with Strapi CMS with expandable accordion UI.

### What Already Exists

| Component | Status |
|-----------|--------|
| Support Agent Dashboard | Full UI with mock data (components, pages, translations) |
| Public FAQ page (`/faq`) | Strapi CMS integration, expandable accordion |
| Interventions schema | Has `type: 'ticket'` placeholder but wrong data model |
| Support dashboard translations | `supportDashboard.*` keys in en.json/ar.json |
| StorageService | `uploadPublic()` for file attachments |
| Email notifications | Infrastructure ready |

### What's Missing

1. **No `tickets` table** — no database schema for support tickets
2. **No `ticket_replies` table** — no schema for ticket reply threads
3. **No backend tickets module** — no controller/service/DTOs
4. **No student support page** — no `/dashboard/student/support` route
5. **No student support components** — no ticket form, ticket list, ticket detail
6. **No sidebar "Support" link** — not in student sidebar navigation
7. **No frontend types/hooks/API** for student tickets
8. **No API proxy** at `/api/student/tickets`
9. **No student support translations**

---

## Implementation Steps

### Step 1: Create Database Schema — `tickets` and `ticket_replies`

**Create:** `backends/src/database/schema/tickets.ts`

```sql
tickets table:
- id (UUID, PK)
- studentId (UUID, FK → users, NOT NULL)
- category (varchar 30, NOT NULL) — billing | login | content | certificate | technical | other
- priority (varchar 10, NOT NULL, default 'medium') — high | medium | low
- subject (varchar 200, NOT NULL)
- description (text, NOT NULL)
- attachmentUrl (varchar 500, nullable)
- courseId (UUID, FK → courses, nullable)
- status (varchar 20, NOT NULL, default 'new') — new | in_progress | resolved | closed
- assigneeId (UUID, FK → users, nullable)
- satisfactionRating (integer, nullable) — 1-5 after resolved
- createdAt (timestamp, NOT NULL)
- updatedAt (timestamp, NOT NULL)
- resolvedAt (timestamp, nullable)
- closedAt (timestamp, nullable)

ticket_replies table:
- id (UUID, PK)
- ticketId (UUID, FK → tickets, NOT NULL, cascade)
- userId (UUID, FK → users, NOT NULL)
- message (text, NOT NULL)
- isStaffReply (boolean, NOT NULL, default false)
- createdAt (timestamp, NOT NULL)
```

**Update:** `backends/src/database/schema/index.ts` — add `export * from './tickets';`

### Step 2: Push Schema to Database

Run `npx drizzle-kit push` inside the backend container to create the tables.

### Step 3: Create Backend Tickets Module

**Create directory:** `backends/src/modules/tickets/`

**Files:**

1. **`dto/create-ticket.dto.ts`**: category, priority, subject, description, courseId (optional)
2. **`dto/reply-ticket.dto.ts`**: message
3. **`dto/rate-ticket.dto.ts`**: rating (1-5)
4. **`tickets.service.ts`**: CRUD + replies + rating
5. **`tickets.controller.ts`**: Student-scoped endpoints under `/student/tickets`
6. **`tickets.module.ts`**: Module registration

**Student Endpoints (all under `@Controller('student')` or separate `@Controller('student/tickets')`):**

Since the student controller is already large, I'll add ticket endpoints directly to `StudentController` + `StudentService` for consistency with the existing pattern. All student features live in the student module.

**Endpoints:**
- `POST /student/tickets` — Create ticket (with optional file upload)
- `GET /student/tickets` — List student's tickets (with status filter)
- `GET /student/tickets/:id` — Get ticket detail with replies
- `POST /student/tickets/:id/reply` — Add reply to ticket
- `POST /student/tickets/:id/rate` — Rate resolved ticket (1-5)

### Step 4: Create Frontend Types

**File:** `frontend/src/types/student-dashboard.ts`

```typescript
interface SupportTicket {
  id: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  courseId: string | null;
  courseTitle: string | null;
  status: string;
  satisfactionRating: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  message: string;
  isStaffReply: boolean;
  createdAt: string;
}

interface TicketDetail extends SupportTicket {
  replies: TicketReply[];
}
```

### Step 5: Add API Methods to `studentApi`

**File:** `frontend/src/lib/api.ts`

Add to `studentApi`:
- `getTickets(params?)` → `GET /student/tickets`
- `getTicketDetail(id)` → `GET /student/tickets/:id`
- `createTicket(data)` → `POST /student/tickets`
- `replyToTicket(id, message)` → `POST /student/tickets/:id/reply`
- `rateTicket(id, rating)` → `POST /student/tickets/:id/rate`

### Step 6: Create API Proxy Routes

**Create:** `frontend/src/app/api/student/tickets/route.ts` — GET (list) + POST (create)
**Create:** `frontend/src/app/api/student/tickets/[id]/route.ts` — GET (detail)
**Create:** `frontend/src/app/api/student/tickets/[id]/reply/route.ts` — POST (reply)
**Create:** `frontend/src/app/api/student/tickets/[id]/rate/route.ts` — POST (rate)

### Step 7: Create Hook

**Create:** `frontend/src/hooks/useStudentTickets.ts`

Fetches ticket list. Returns `{ data, loading, error, refetch }`.

### Step 8: Create SupportContent Component

**Create:** `frontend/src/components/student-dashboard/SupportContent.tsx`

Two-tab layout:
1. **Submit a Ticket** tab — form with:
   - Category dropdown (billing, login, content, certificate, technical, other)
   - Priority dropdown (high, medium, low — default medium)
   - Subject input (max 200 chars)
   - Description textarea (max 2000 chars)
   - Attachment file upload (optional, max 5MB, images/docs)
   - Related Course dropdown (from enrolled courses)
   - Submit button

2. **My Tickets** tab — ticket list with:
   - Status filter tabs: All, New (blue), In Progress (yellow), Resolved (green), Closed (gray)
   - Card per ticket showing: subject, category badge, priority badge, status badge, created date
   - Click to expand/navigate to detail view

### Step 9: Create TicketDetailView Component

**Create:** `frontend/src/components/student-dashboard/TicketDetailView.tsx`

Shows within SupportContent when a ticket is selected:
- Ticket info header (subject, status, category, priority, created date)
- Reply thread (chronological, staff replies styled differently)
- Reply input textarea + send button
- Satisfaction rating (1-5 stars) — shown only when status is "resolved"
- Back button to return to list

### Step 10: Add Support Sidebar Link

**Files:** `DashboardSidebar.tsx`, `MobileSidebar.tsx`

Add after "Settings" (last before logout):
```typescript
import { HelpCircle } from "lucide-react";
{
  label: t("sidebar.support"),
  href: `/${locale}/dashboard/student/support`,
  icon: HelpCircle,
},
```

### Step 11: Create Page Route

**Create:** `frontend/src/app/[locale]/(dashboards)/dashboard/student/support/page.tsx`

### Step 12: Update Barrel Export

**File:** `frontend/src/components/student-dashboard/index.ts`

Add: `export { default as SupportContent } from "./SupportContent";`

### Step 13: All Translations (EN + AR)

Add `sidebar.support`:
- EN: `"support": "Support"`
- AR: `"support": "الدعم"`

Add `supportPage` section under `studentDashboard`:
- Tab labels (submitTicket, myTickets)
- Form fields (category, priority, subject, description, attachment, relatedCourse)
- Category options (billing, login, content, certificate, technical, other)
- Priority options (high, medium, low)
- Status labels (new, inProgress, resolved, closed)
- Ticket detail labels (reply, send, rateExperience)
- Star rating labels
- Empty states, success/error messages
- SLA messages

---

## Implementation Order

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 1 | Create tickets schema | `tickets.ts`, `schema/index.ts` | Small |
| 2 | Push DB schema | `drizzle-kit push` | Small |
| 3 | Backend ticket endpoints | `student.service.ts`, `student.controller.ts`, DTOs | Large |
| 4 | Frontend types | `student-dashboard.ts` | Small |
| 5 | API methods | `api.ts` | Small |
| 6 | API proxy routes | `api/student/tickets/*` | Small |
| 7 | Hook | `useStudentTickets.ts` | Small |
| 8 | SupportContent component | `SupportContent.tsx` | Large |
| 9 | TicketDetailView component | `TicketDetailView.tsx` | Medium |
| 10 | Sidebar link | `DashboardSidebar.tsx`, `MobileSidebar.tsx` | Small |
| 11 | Page route | `support/page.tsx` | Small |
| 12 | Barrel export | `index.ts` | Small |
| 13 | Translations | `en.json`, `ar.json` | Medium |

Steps 1-3 first (backend). Steps 4-7 next (frontend infrastructure). Steps 8-9 (components). Steps 10-13 (wiring).

---

## Critical Files

| File | Action |
|------|--------|
| `backends/src/database/schema/tickets.ts` | NEW — schema |
| `backends/src/database/schema/index.ts` | Add export |
| `backends/src/modules/student/student.service.ts` | Add ticket CRUD methods |
| `backends/src/modules/student/student.controller.ts` | Add ticket endpoints |
| `backends/src/modules/student/dto/create-ticket.dto.ts` | NEW — DTO |
| `backends/src/modules/student/dto/reply-ticket.dto.ts` | NEW — DTO |
| `backends/src/modules/student/dto/rate-ticket.dto.ts` | NEW — DTO |
| `frontend/src/types/student-dashboard.ts` | Add ticket types |
| `frontend/src/lib/api.ts` | Add studentApi ticket methods |
| `frontend/src/hooks/useStudentTickets.ts` | NEW — hook |
| `frontend/src/app/api/student/tickets/route.ts` | NEW — proxy |
| `frontend/src/app/api/student/tickets/[id]/route.ts` | NEW — proxy |
| `frontend/src/app/api/student/tickets/[id]/reply/route.ts` | NEW — proxy |
| `frontend/src/app/api/student/tickets/[id]/rate/route.ts` | NEW — proxy |
| `frontend/src/components/student-dashboard/SupportContent.tsx` | NEW |
| `frontend/src/components/student-dashboard/TicketDetailView.tsx` | NEW |
| `frontend/src/components/student-dashboard/DashboardSidebar.tsx` | Add support link |
| `frontend/src/components/student-dashboard/MobileSidebar.tsx` | Add support link |
| `frontend/src/components/student-dashboard/index.ts` | Add export |
| `frontend/src/app/[locale]/(dashboards)/dashboard/student/support/page.tsx` | NEW |
| `frontend/messages/en.json` | Translations |
| `frontend/messages/ar.json` | Translations |

## Reused Utilities

- `StorageService.uploadPublic()` — for ticket attachment upload
- `useStudentProfile` hook — for sidebar user data
- `studentApi` pattern — extending existing API client
- Standard dashboard layout pattern from other content components
- `globalThis.fetch` pattern for API proxy routes

## Deferred / Out of Scope

- **SLA countdown**: Requires real-time countdown timer infrastructure. Can show static "Expected response within X hours" text based on priority.
- **Connecting support agent dashboard to real API**: Agent dashboard currently uses mock data. Wiring it to the real tickets table is a separate task.
- **Email notifications to support team**: Would need a support team email config. Can be added later.
- **File attachment storage**: Will use `StorageService.uploadPublic()` for now. Proper private file handling can be enhanced later.

## Verification

1. Navigate to `/dashboard/student/support` — see two tabs (Submit Ticket / My Tickets)
2. Fill out ticket form with category, priority, subject, description → submit → success toast
3. Switch to "My Tickets" tab → see the created ticket in the list
4. Click ticket → see detail view with full info
5. Add a reply → see it appear in the thread
6. Filter tickets by status → list updates
7. Sidebar has "Support" link, active state when on support page
8. RTL: Switch to Arabic → forms and lists render correctly
9. `npx tsc --noEmit` in both frontend and backend — zero errors
10. `npx drizzle-kit push` creates tickets + ticket_replies tables
