# Support Dashboard — Work Plan

Origin: audit of the support dashboard after merging `haseeb/support-dashboard` (2-month-old branch) into `main` on 2026-06-03.
Current state: deployed to production (backend revision `physioguidance-api-00268-meq`, frontend `physioguidance-web-00279-tbs`) but with significant rework needed before it's truly usable.

Categories: 🔴 Blockers · 🟡 Needs Work · ⚪ Nice to Have · ✅ Done · ➖ Decided / Architectural

Use this list as the source of truth for sequencing support-dashboard work. Update statuses as items land.

---

## ➖ Decided / Architectural

### NPS feature removal
**Decision (2026-06-03):** the merged NPS implementation duplicates the existing 1–5 star course rating (`course_ratings` table, `ReviewModal.tsx`). The existing in-app review flow has higher response rate (modal vs email), covers both course + instructor, has a moderation workflow, and is widely integrated. NPS would be a parallel, weaker survey for the same signal.

**Action:**
- Delete `NpsRatingPage.tsx`, `surveys/nps/[surveyId]/page.tsx`, `nps-survey.template.ts`
- Remove `createNpsSurvey`, `submitNpsScore`, `getNpsSummary` from `support.service.ts`
- Remove `POST /tickets/nps/:id` route
- Remove `createNpsSurvey` trigger from `certificates.service.ts:766-774`
- Remove `sendNpsSurvey` from `email.service.ts`
- Drop NPS card / panel from `SupportRightSidebar.tsx` and `SupportReportsContent.tsx`
- For supervisor KPI display: derive NPS-equivalent from `course_ratings` (1-2★ = detractor, 3★ = passive, 4-5★ = promoter, NPS = ((promoters - detractors) / total) × 100)
- Keep `nps_surveys` table on disk for historical data integrity; new code stops using it

### CSAT feature retention
**Decision (2026-06-03):** CSAT (support-ticket satisfaction, 1–5★ post-resolution) is legitimate and measures a distinct signal from course rating. **Keep the data model + the email trigger.** Only the survey page needs fixes (i18n, already-submitted check, rate limit, noindex) — see 🔴 BLOCKERS.

---

## 🔴 Blockers — fix before this feature can be trusted in production

### Backend

- [ ] **SLA TTR-breach reassignment will crash** — `sla_events.event_type` CHECK doesn't include `'ttr_breach_reassigned'` but `sla-monitor.service.ts:307` writes that value. Add the event type to migration 0038 + schema `sla.ts:56`.
- [ ] **`support_config.value` JSON column gets plain-string writes** — `support.service.ts:1208,1213,1228` does `String(newPointer)` into a JSON column. Wrap in `JSON.stringify(...)` or change column type.
- [ ] **No reCAPTCHA on guest ticket creation** — `PublicTicketForm.tsx:86` doesn't send a token; `createGuestTicket` doesn't validate one. Mirror the signin/signup ReCAPTCHA pattern with `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. Validate server-side.
- [ ] **Public endpoints have no per-route rate limits** — guest tickets, ticket tracking, CSAT, NPS all on default 600/min. Add `@Throttle()` decorators (e.g. 3-10/min). The 3-per-24h email cap is bypassable by varying email.
- [ ] **`GUEST_USER_ID` sentinel password hash is non-functional** — Migration 0040:9 inserts a placeholder string. Set `is_active=false` or use a deliberately invalid hash; document why.
- [ ] **Guest ticket category not server-side enforced** — DTO restricts to `'login'`, service accepts any. Add a service-level guard in `createGuestTicket`.
- [ ] **Score validation throws wrong HTTP status** — `controller:113,144,408,624` throws `ForbiddenException` (403) for invalid scores; should be `BadRequestException` (400).
- [ ] **KB body search omits `bodyAr` column** — `support.service.ts:2958` only searches `titleEn`, `titleAr`, `bodyEn`. Arabic users searching by body text get zero results.

### Frontend — support dashboard

- [ ] **`KnowledgeBaseContent.tsx` crashes on first real article** — line 406-443 reads `article.views.toLocaleString()`, `article.helpful`, `article.title`, `article.visibility`, `article.status`. Real shape from API is `viewCount`, `published`, `titleEn`/`titleAr`. `null.toLocaleString()` throws. Map backend shape to display shape.
- [ ] **Mobile sidebar drawer is unreachable** — `SupportMobileSidebar.tsx:39` `isOpen=false`, no trigger anywhere opens it. SupportNavbar's mobile menu is a separate state. Mobile users can't navigate the support dashboard. Lift `isOpen` to context or render an open button, or remove this component entirely and reuse SupportNavbar's menu.
- [ ] **`/dashboard/support/supervisor/*` pages lack role guard** — agent who types URL sees Team, Reports, supervisor-only Tickets, Settings shells. Add server-side check `if user.supportSubRole !== 'supervisor' redirect(/agent)` in each `supervisor/*/page.tsx`.
- [ ] **`AllTicketsContent` always navigates to `/supervisor/tickets/`** — `lines 409, 492`. Agents land on supervisor URLs. Derive `basePath` from `user.supportSubRole` like `TicketsBoardWidget.tsx:33` does.
- [ ] **"New Ticket" button has no `onClick`** — `AllTicketsContent.tsx:344`. Dead UI in production. Wire to a create-ticket modal or remove.
- [ ] **`MyTicketsContent` open-ticket link hardcodes `/agent/`** — `line 200`. Supervisors sent to wrong URL. Branch on `user.supportSubRole`.
- [ ] **`SupportNavbar` hardcoded badge counts `23` and `8`** — `lines 66, 72`. Literal numbers next to nav items in mobile menu. Drive from API or remove badges.

### Public survey pages

- [ ] **CSAT/NPS pages bypass i18n + LocaleLayout** — `surveys/csat/[surveyId]/page.tsx` and `surveys/nps/[surveyId]/page.tsx` are `"use client"`, no `setRequestLocale`, no Navbar/Footer, no `dir`. Wrap in proper layout. *(NPS will be removed — fix only CSAT.)*
- [ ] **CSAT "already submitted" check is broken** — `CsatRatingPage.tsx:62` reads `data.respondedAt`; backend returns `alreadySubmitted` + `submittedAt`. Use `data.alreadySubmitted` and `data.score`/`submittedAt` in the thank-you message.
- [ ] **Survey + track pages have no `robots: noindex`** — one-use tokenized URLs WILL get indexed if shared. Add `export const metadata = { robots: { index: false, follow: false } }` to `surveys/csat/[surveyId]/page.tsx` and `support/track/[token]/page.tsx`.

---

## 🟡 Needs Work — functional but incomplete

### Backend integrity

- [ ] No DB transactions wrapping `createTicket`, `resolveTicket`, `addComment`. Crash mid-flow leaves orphan rows. Wrap in `db.transaction(async (tx) => { ... })`.
- [ ] Round-robin pointer races in `support.service.ts:1203-1214`. Wrap in transaction or `UPDATE … RETURNING` with atomic increment.
- [ ] `addComment` runs 2 sequential `UPDATE tickets` when NEW→IN_PROGRESS (`service:653-714`). Consolidate.
- [ ] `updateSlaPolicy.escalateAfterMinutes` is dead — DTO accepts it but cron never reads. Either wire into escalation cron or drop from DTO.
- [ ] `onHoldReason` is free string — auto-close cron literal-matches `'waiting for student response'`. Typos break auto-close. Use `@IsIn([...])` whitelist.
- [ ] `exportReport` CSV header→key inference fragile (`service:2362-2369`). `"Avg FRT (min)"` strips to `avg_frt_min`, real key is `avgFrtMinutes`. Cells empty. Same logic in PDF export at `:2527`.
- [ ] `createNpsSurvey` error swallowed in cert flow (`certificates.service.ts:767-774`) — log with `this.logger.warn`. *(Removed as part of NPS removal.)*
- [ ] `tickets.guestTrackingToken` lacks `.unique()` in Drizzle schema — partial unique index in 0040 will be dropped on next `drizzle-kit generate`.
- [ ] Verify `EmailModule` is `@Global()` — `SupportModule` doesn't import it explicitly but injects `EmailService`. If not global, boot will fail.
- [ ] Hot paths missing indexes: `tickets.guestEmail`, `tickets.firstResponseAt`, `tickets.resolvedAt`.

### Frontend — translation debt

Every freshly-merged Haseeb block has hardcoded English. Replace literals with `t("...")` keys.

- [ ] `SupportSettingsContent.tsx` — Profile Info section, Upload/Remove Photo, field labels, Save Changes, "Coming Soon" copy, full SLA/Macros/Escalation panels
- [ ] `MyTicketsContent.tsx` — toast strings, "Open"/"Replying to"/"Clear selection"/"Apply Macro"
- [ ] `SupportReportsContent.tsx` — "Top Issues", "Export"/"Download CSV/PDF", "From"/"To", "No tickets found", SLA + Agent Performance + CSAT + NPS panels
- [ ] `TeamContent.tsx` — "Add New Agent" + modal labels, "No data yet" placeholders
- [ ] `KnowledgeBaseContent.tsx` — toasts + form labels
- [ ] `TicketDetailContent.tsx` — "Back to Tickets", "Ticket not found", "Staff", "Internal", "Reply", panel labels, action buttons
- [ ] `AgentDashboardContent.tsx` — stat labels, page title, table headers
- [ ] `CsatRatingPage.tsx` — 100% hardcoded
- [ ] `GuestTicketTracker.tsx` — status labels, dates (use `Intl.DateTimeFormat(locale)`), all copy
- [ ] `PublicKBContent.tsx` — categories hardcoded EN/AR inline; pull from `useTranslations`
- [ ] `BusinessHoursIndicator.tsx` — hours/timezone hardcoded (also see config-driven fix below)
- [ ] `SupportPageContent.tsx:166-184` — sign-in card overlay
- [ ] `PublicTicketForm.tsx:62` — email regex error, "Save this link"/"Bookmark this link" copy

### Frontend — mock/stale data leaking

- [ ] `AllTicketsContent.tsx:84,91` — `resolvedThisWeek`, `avgResolution` hardcoded `"--"`, no fetch. Add to KPI endpoint or compute client-side.
- [ ] `AllTicketsContent.tsx:143` — `assignee: null` always; "Assigned To" column shows "--". Include `assigneeName` in list response.
- [ ] `MyTicketsContent.tsx:111` — `slaRemaining: "--"` literal; `parseFloat("--")` → `NaN` fed to SLA color/urgency logic. Compute from ticket's remaining minutes.
- [ ] `SLAPerformanceWidget.tsx:84-85` — hardcoded `FRT_TARGET_MINUTES=120`, `TTR_TARGET_MINUTES=360`. Read from configured SLA policies.
- [ ] `TeamContent.tsx:73-115` — agent stats fully stubbed: `openTickets:0`, `csat:0`, all agents "online". Merge with `getAgentPerformance()` data (already used by `SLAPerformanceWidget`). Drop online/away/offline presence tabs until presence is implemented.
- [ ] `SupportSettingsContent.tsx:437-450` — static `macros`/`categories` arrays with fake counts (`tickets: 45/38/28/22/18`) behind `{false &&}` dead gates. Delete the arrays + dead state.
- [ ] `AgentDashboardContent.tsx:59-81` — stats labels hardcoded; tie to `t("myTicketsPage.stats.*")`.

### Frontend — dead handlers / unwired UI

- [ ] `TeamContent.tsx:436-453` — agent card Message/Stats/More buttons have no `onClick`. Wire or remove.
- [ ] `KnowledgeBaseContent.tsx:369` — "View" article action has no `onClick`. Open detail view or remove.
- [ ] `SupportSettingsContent.tsx:1142-1254` — Notifications + Categories tabs behind `{false &&}` but state (`emailNotif`, `smsNotif`, etc.) still declared. Delete dead branches + state.
- [ ] `AllTicketsContent.tsx:344` — "New Ticket" button (also in 🔴 BLOCKERS).

### Frontend — error states

- [ ] Most components: error → toast + leave empty/spinner state. No retry buttons except `SupportSettingsContent.tsx:687` (SLA tab only). Add error state + retry button to each report/list panel.
- [ ] `SupportReportsContent.tsx:209` reads `process.env.NEXT_PUBLIC_API_URL` directly. Move export download into `lib/api`.

### Public pages — config & SEO

- [ ] `BusinessHoursIndicator.tsx:7-27` — AST UTC+3, Sun–Thu, 09:00–18:00 hardcoded. Pull from admin-settings (parallel to `whatsappNumber` wiring).
- [ ] `GuestTicketTracker.tsx:96` — 60s polling burns API even when tab hidden. Add `document.visibilityState` guard.
- [ ] CSAT `?score=` URL param auto-selects rating but doesn't auto-submit (`CsatRatingPage.tsx:48-55`). Either auto-submit for one-click flow or remove the param logic.
- [ ] `getSupportPageData()` has no `.catch` — Strapi outage = 500. Compare with `layout.tsx:49` `.catch(() => null)`.
- [ ] `support.controller.ts:139-148` — guest reply endpoint has no length cap server-side. Add max length (e.g. 5000) in DTO.

### NPS removal tasks (Decided)

- [ ] Delete `frontend/src/components/support/NpsRatingPage.tsx`
- [ ] Delete `frontend/src/app/[locale]/surveys/nps/[surveyId]/page.tsx`
- [ ] Delete `backends/src/modules/email/templates/nps-survey.template.ts`
- [ ] Remove `createNpsSurvey`, `submitNpsScore`, `getNpsSummary` from `support.service.ts`
- [ ] Remove `POST /tickets/nps/:id` route from `support.controller.ts`
- [ ] Remove `createNpsSurvey` trigger in `certificates.service.ts:766-774`
- [ ] Remove `sendNpsSurvey` method + import from `email.service.ts`
- [ ] Update `SupportRightSidebar.tsx` NPS card → derive from `course_ratings` or remove
- [ ] Update `SupportReportsContent.tsx` NPS panel → derive from `course_ratings` or remove
- [ ] Update `getKPIs.npsScore` in `support.service.ts:1089` to read from `course_ratings`
- [ ] Remove NPS strings from `frontend/messages/en.json` + `ar.json`
- [ ] Leave `nps_surveys` table on disk for historical data

---

## ⚪ Nice to Have — polish

- [ ] Extract status/priority palettes to CSS vars (currently raw hex in `priorityStyles`/`statusStyles` across most files)
- [ ] `AgentDashboardContent.tsx:101` raw `bg-[#F9FAFB]` → token
- [ ] Icon-only `MoreVertical` buttons missing `aria-label` everywhere
- [ ] `<span onClick>` instead of `<button>` (`AllTicketsContent.tsx:407`, `MyTicketsContent.tsx:337`)
- [ ] `window.location.assign` → `router.push` (full page reloads)
- [ ] Native `confirm()` dialogs untranslated, doesn't match Sonner pattern
- [ ] N+1 in `getAgentPerformance` (`service:2202-2291`) — replace with grouped aggregate
- [ ] `getKbArticles` returns full body in list — truncate
- [ ] `require('pdfkit')` runtime → top-level import
- [ ] `closeTicket` reuses `ticket.resolved` email template — separate "closed" template
- [ ] `getKPIs` silent 500-ticket cap drifts averages on large tenants
- [ ] KB page metadata English-only (`generateMetadata` not used)
- [ ] Many `any[]` types in state — `MyTicketsContent.tsx:48`, `AllTicketsContent.tsx:49`, `KnowledgeBaseContent.tsx:40`, `SupportSettingsContent.tsx:263+`, `TicketDetailContent.tsx:85`. Typed shapes exist in `types/support.ts` but unused.
- [ ] `ticket.id.substring(0,8)` in `GuestTicketTracker.tsx:186` leaks partial UUID — use a human-readable ticket number

---

## ✅ Done

- [x] Merge `haseeb/support-dashboard` (2 months old) into main (22 conflicts resolved)
- [x] Renumber Haseeb migrations 0018-0023 → 0037-0042
- [x] Apply migrations to prod DB
- [x] Deploy backend + frontend to production
- [x] Drop dead "badge" rendering from sidebars (was unfinished scaffolding)
- [x] Strip `WhatsAppButton` from public support pages (already injected globally via `WhatsAppChatWidget`)
- [x] Move planning PDFs from repo root to `docs/support-dashboard/`
- [x] Theme-color migration on support-dashboard files (grayscale hex → CSS vars)

---

## Recommended sequencing

1. **Crash fixers (1 day)** — 🔴 backend items 1, 2 + KB display crash. Will throw in production the moment users hit them.
2. **Security pass (1 day)** — 🔴 reCAPTCHA + rate limits + guest sentinel + noindex.
3. **Role guards (½ day)** — 🔴 supervisor route guards + correct basePath in AllTicketsContent / MyTicketsContent.
4. **NPS removal (½ day)** — decided architectural change.
5. **Wire dead/mock data (2-3 days)** — TeamContent stats, AllTickets stubs, SLA target reads, KB shape mapping, hardcoded badges.
6. **i18n debt (2-3 days)** — translate all hardcoded English in freshly-merged blocks. Tedious but mechanical.
7. **Polish (1-2 days)** — error states + retry buttons + a11y + hex→tokens + dead-code removal.

Total: ~8-10 focused days of work.
