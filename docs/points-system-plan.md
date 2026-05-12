# Points System — Implementation Plan

> **Status**: Active build, Phase 1 starting
> **Last updated**: 2026-05-08
> **Owner**: Claude (with abubakar-dev-1)

This is the source-of-truth plan for the Points System feature. It tracks both
the design and live implementation progress. Update the **Progress** section
at the bottom of this file as work lands.

---

## TL;DR

A **ledger-based points system** with:
- An append-only `point_transactions` table (source of truth, no race conditions, full audit)
- A NestJS `points` module owning all award/redeem logic
- 3 automatic award hooks (signup, course completion, review approval)
- "My Points" page replacing the mocked Invite Friends page
- "Points System" admin section in admin-dashboard for all config

---

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where rules live | NestJS DB tables | Transactional integrity with the ledger, FK constraints, audit columns |
| Admin UI placement | All in **Admin dashboard** (single section) | Simpler v1; one place for all points config |
| Phasing | Ship Phases 1+2 now; Phase 3 waits for real payments | Engagement loop closes immediately |
| Expirations | Per-rule configurable (`expires_after_days` on each rule) | Manager flexibility |
| Referrals | Out of scope | Stay focused on client spec |
| Strapi involvement | None | Strapi is for content, not transactional logic |

---

## Current state of the project (audit at planning time)

| Thing | Status |
|---|---|
| `/dashboard/student/invite-friends` | Fully mocked — hardcoded referral code + 3 fake invites, no API |
| `users.points` column | Doesn't exist |
| Coupon / discount system | Doesn't exist anywhere |
| `CheckoutContent.tsx` | Mocked — hardcoded course, no real payment |
| Course enrollment | One endpoint `POST /courses/:id/enroll`, no payment gate |
| `course-completion.cron.ts` | Daily cron — natural hook for award |
| `POST /courses/:id/complete` | Manual completion endpoint — second hook |
| Course ratings | Exist with moderation workflow (`pending → approved`) — third hook |
| Notifications module | Generic `type` field, extensible |
| Audit log | `metadata jsonb`, extensible |
| Currency | Hardcoded SAR everywhere |
| Strapi `site-setting` singleton | Holds theme/payment-method config |

---

## Architecture

### Why an append-only ledger (not a `users.points` integer)

A single `users.points` integer **breaks under concurrency** and gives no audit
trail. Race conditions on parallel redemptions, no way to reverse refunded
courses, no answer to "why did this user lose 50 pts last Tuesday."

Correct pattern:

```
┌───────────────────────────────────────────────────────────────┐
│  Earn triggers (3)                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Signup       │  │ Course completed │  │ Review approved│  │
│  │ (auth.svc)   │  │ (cron + manual)  │  │ (review.svc)   │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬───────┘  │
│         └───────────────────┴────────────────────┬┘          │
│                                                  ▼           │
│                            ┌────────────────────────────┐    │
│                            │  PointsService.award()      │    │
│                            │  • idempotency check        │    │
│                            │  • read active rule         │    │
│                            │  • insert ledger row        │    │
│                            │  • emit notification        │    │
│                            └─────────────┬───────────────┘    │
└──────────────────────────────────────────┼────────────────────┘
                                           ▼
                ┌──────────────────────────────────┐
                │   point_transactions (ledger)    │
                └──────────────────────────────────┘
                                           │
                ┌──────────────────────────┴────────────┐
                │  Read paths:                          │
                │  • GET /me/points (balance + history) │
                │  • POST /redeem-course (free unlock)  │
                │  • POST /checkout/quote (Phase 3)     │
                └───────────────────────────────────────┘
```

**Balance = SUM(delta) of unexpired rows.** Stripe-style.

### Two redemption modes are actually one

A "free course" is just "discount = full price". One code path with two UI
presentations:
- "Apply N points → reduce total by X SAR" (partial discount, Phase 3)
- "Apply M points → unlock course free" (full discount, where M points × conversion rate = course price, Phase 2)

---

## Database schema

5 new tables in `backends/src/database/schema/`.

### 1. `point_rules` — admin-configured earn rules

```sql
CREATE TABLE point_rules (
  id UUID PRIMARY KEY,
  rule_key VARCHAR(50) UNIQUE NOT NULL,    -- 'signup', 'course_completed', 'review_approved'
  points_amount INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  max_per_user INT,                         -- null = unlimited
  cooldown_seconds INT,                     -- anti-abuse
  description TEXT,
  description_ar TEXT,
  expires_after_days INT,                   -- null = never expires
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

Seed defaults: `signup=50` (max_per_user=1), `course_completed=200`, `review_approved=25`.

### 2. `point_transactions` — the ledger (append-only)

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  delta INT NOT NULL,                       -- +50, -100, etc.
  reason VARCHAR(50) NOT NULL,              -- 'earn:signup', 'earn:course_completed', 'redeem:course', 'reverse:refund', 'admin:grant'
  rule_id UUID REFERENCES point_rules(id),
  source_entity_type VARCHAR(50),           -- 'enrollment', 'rating', 'redemption'
  source_entity_id UUID,
  idempotency_key VARCHAR(120) UNIQUE,      -- e.g., 'course_completed:enrollment-uuid'
  expires_at TIMESTAMPTZ,                   -- null = never
  metadata JSONB,
  created_by UUID REFERENCES users(id),     -- null for system, set for admin grants
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pt_user_active ON point_transactions(user_id) WHERE expires_at IS NULL OR expires_at > NOW();
```

`idempotency_key UNIQUE` is the key correctness invariant: cron retries cannot double-award.

### 3. `point_redemptions` — pending hold + commit

```sql
CREATE TABLE point_redemptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  points_used INT NOT NULL,
  discount_amount_sar NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,              -- 'pending' | 'applied' | 'released' | 'reversed'
  enrollment_id UUID REFERENCES enrollments(id),
  expires_at TIMESTAMPTZ NOT NULL,          -- pending holds expire after 30 min
  applied_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Two-phase pattern: ledger debit happens at hold creation; commit on payment success or release on failure/timeout. **No one loses points to a failed payment.**

### 4. `points_config` — singleton row

```sql
CREATE TABLE points_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  conversion_rate_points_per_sar INT NOT NULL DEFAULT 10,  -- 10 pts = 1 SAR
  min_redemption_points INT NOT NULL DEFAULT 100,
  max_redemption_pct INT NOT NULL DEFAULT 50,
  combinable_with_coupons BOOLEAN DEFAULT FALSE,
  default_expiration_days INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

### 5. `course_redemption_settings` — per-course override

```sql
CREATE TABLE course_redemption_settings (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  redeemable_for_free BOOLEAN DEFAULT FALSE,
  free_unlock_cost_points INT,
  max_redemption_pct INT,                   -- override global cap
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Opt-in by default**: only courses the admin explicitly enables can be redeemed.

---

## Backend module layout

```
backends/src/modules/points/
├── points.module.ts
├── points.controller.ts        ← public-facing student endpoints
├── points-admin.controller.ts  ← admin-only config + override
├── points.service.ts           ← award, redeem, balance, reverse
├── points-ledger.service.ts    ← ledger reads/writes
└── dto/
    ├── apply-redemption.dto.ts
    ├── update-rule.dto.ts
    └── update-config.dto.ts
```

### Endpoints — student

| Endpoint | Purpose |
|---|---|
| `GET /points/me/balance` | `{ balance, expiringSoon }` |
| `GET /points/me/transactions?page=1&limit=20` | Paginated ledger history |
| `GET /points/me/redeemable-courses` | Courses user can fully redeem (cost ≤ balance) |
| `POST /points/redeem-course` (Phase 2) | Body: `{ courseId }` → debits ledger, creates enrollment |
| `POST /checkout/quote` (Phase 3) | Body: `{ courseId, applyPoints }` → returns hold |
| `POST /checkout/confirm` (Phase 3) | Commits hold + creates enrollment |
| `POST /checkout/cancel` (Phase 3) | Releases pending hold |

### Endpoints — admin

| Endpoint | Purpose |
|---|---|
| `GET /admin/points/rules` | List all earn rules |
| `PATCH /admin/points/rules/:key` | Update rule |
| `GET /admin/points/config` | Singleton config |
| `PATCH /admin/points/config` | Update conversion rate, caps, etc. |
| `GET /admin/points/courses` | List courses with redemption settings |
| `PATCH /admin/points/courses/:id` | Set redemption flags per course |
| `POST /admin/points/grant` | Manual grant/deduction with reason |
| `GET /admin/points/transactions?userId=...` | Audit a user's full history |

### 3 award integration points

#### Hook 1: Signup
File: `backends/src/modules/auth/auth.service.ts`
```ts
await this.pointsService.award(newUser.id, 'signup', { idempotencyKey: `signup:${newUser.id}` });
```

#### Hook 2: Course completion
Files: `backends/src/modules/courses/course-completion.cron.ts:75-84`
       AND `backends/src/modules/courses/courses.service.ts` (manual completion endpoint)
```ts
await this.pointsService.award(enrollment.studentId, 'course_completed', {
  idempotencyKey: `course_completed:${enrollment.id}`,
  sourceEntityType: 'enrollment',
  sourceEntityId: enrollment.id,
});
```

#### Hook 3: Review approved
File: `backends/src/modules/courses/courses.service.ts` (rating approve method)
```ts
await this.pointsService.award(rating.studentId, 'review_approved', {
  idempotencyKey: `review_approved:${rating.id}`,
  sourceEntityType: 'rating',
  sourceEntityId: rating.id,
});
```
Approved-only earning is built-in spam protection.

### Anti-abuse / edge cases

| Risk | Mitigation |
|---|---|
| Cron re-runs award twice | `idempotency_key UNIQUE` on transactions |
| User refunds course → keeps points | Reversal endpoint inserts compensating `-N` |
| Failed payment loses points | Hold pattern (Phase 3) — only commits on payment success |
| Review spam farming | Points only on `approved` (manager moderation) + max_per_user per rule |
| Stale balance display | Balance computed from ledger; cache 60s on user-points view |
| Discount stack with coupons | `combinable_with_coupons` flag; default false |
| Premium course unlocked cheap | Per-course `max_redemption_pct` + `redeemable_for_free` opt-in |

---

## Frontend changes

### 1. Replace `InviteFriendsContent` → `MyPointsContent`

Path: `frontend/src/components/student-dashboard/MyPointsContent.tsx`
Route: keep `/dashboard/student/invite-friends` URL OR rename to `/my-points` (TBD; sidebar already says "My Points")

Sections:
- **Balance card** (big: "350 points · ≈35 SAR value · ⚠ 50 expire in 30d")
- **How to earn** (rules list with current points amounts)
- **Redeem** (two CTAs: "Discount at checkout" — Phase 3 / "Free courses" — Phase 2)
- **History** (paginated ledger entries)

### 2. Course card "redeem for free" badge (Phase 2)

When the user has enough points + the course is redemption-eligible, show a "Redeem free (X pts)" button on:
- Course detail page
- Public course card

### 3. Checkout integration (Phase 3)

`frontend/src/components/CheckoutContent.tsx` — add slider before "Place Order":
```
[ ] Apply my points       Available: 350 pts (≈35 SAR)
    └─ Slider: 0 ──●──── 350  → Apply 200 pts (-20 SAR)
```

### 4. Admin: Points System section

Path: `frontend/src/components/admin-dashboard/PointsSystemContent.tsx`

5 tabs:
1. **Earn Rules** — editable table (signup/completion/review)
2. **Redemption Config** — conversion rate, min, max %, expirations
3. **Eligible Courses** — per-course toggle + free-unlock cost
4. **Manual Grants** — grant/deduct with reason
5. **User History** — search user → full ledger view

Plus sidebar entry in admin-dashboard.

---

## Review system (FAQ)

**What "review" means**: 1-5 star rating + optional written text on a course.
**Where written**: My Courses page → "Leave a Review" button on course card → `LeaveReviewModal`.
**API**: `POST /courses/:id/ratings { rating, reviewText }` (file: `frontend/src/lib/api.ts:2535`).
**Constraint**: One review per course per student (DB unique on `(courseId, studentId)`).

**Flow**:
1. Student submits → `course_ratings` row inserted with `moderationStatus='pending'`, `isPublished=false`
2. Manager reviews → approves or rejects
3. **On approve**: `moderationStatus='approved'`, `isPublished=true`, **points awarded**
4. On reject: nothing visible publicly, no points

**Why approval-gated**: prevents spam farming. Approval matches existing moderation flow already in code.

**Idempotency**: key = `review_approved:{ratingId}` — even if a manager re-approves, no double award.

---

## Phasing

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Schema, ledger, 3 award hooks, balance + history page, admin Earn Rules tab | ✅ Done |
| **Phase 2** | Free course redemption (per-course unlock), admin Eligible Courses tab | ✅ Done |
| **Phase 3** | Discount at checkout (hold pattern + integration) | ⛔ Blocked on real payment integration |
| **Phase 4** | Expiration cron, manual grants, refund-reversal hook | ✅ Mostly done — refund-reversal endpoint TODO when refund flow exists |

---

## Build order (Phase 1 + 2)

1. ✅ Schema migration — 5 tables + seed default rules
2. ✅ NestJS `points` module — service + ledger + DTOs
3. ✅ Award hook 1: signup
4. ✅ Award hook 2: course completion (cron + manual)
5. ✅ Award hook 3: review approval
6. ✅ Student API endpoints (balance, transactions, redeemable-courses)
7. ✅ MyPoints page (replaces InviteFriendsContent)
8. ✅ Free unlock flow (POST /points/redeem-course + course-detail UI)
9. ✅ Admin: Points System section (5 tabs)
10. ✅ Expiration cron (daily) + redemption-hold sweeper (every 5 min)
11. ✅ Translations (en + ar)
12. ✅ Notifications: `points_earned` + `points_redeemed` types added to STUDENT_NOTIFICATION_TYPES allowlist

---

## Build status: Phases 1+2 complete ✅

All 12 build steps done. The Points System is fully integrated end-to-end:
- Students earn from signup / completion / approved reviews automatically
- Students see their balance + history at `/dashboard/student/invite-friends`
- Students can redeem points to unlock courses on the public course detail page
- Admins control everything from `/dashboard/admin/points` (5 tabs)
- Cron auto-releases stale 30-min holds + logs daily expirations as history tombstones
- Notifications fire on earn + redeem, surfaced via the navbar bell

Estimate: 8–10 working days end-to-end for Phases 1+2.

---

## Progress log

> Append-only. Update as steps land.

### 2026-05-08
- ✅ Plan researched, designed, decisions locked, saved to `docs/points-system-plan.md`
- ✅ Step 1: 5 schema files added + seed updated + migration generated
  - `backends/src/database/schema/point-rules.ts`
  - `backends/src/database/schema/point-transactions.ts`
  - `backends/src/database/schema/point-redemptions.ts`
  - `backends/src/database/schema/points-config.ts`
  - `backends/src/database/schema/course-redemption-settings.ts`
  - `backends/src/database/schema/index.ts` — barrel updated
  - `backends/src/database/seeds/index.ts` — `seedPointsDefaults()` added (idempotent)
  - `backends/src/database/migrations/0018_real_steve_rogers.sql` — migration generated by drizzle-kit
  - Backend typecheck: clean
- ✅ Step 2: NestJS `points` module — module, controllers, services, DTOs
  - `backends/src/modules/points/points.module.ts`
  - `backends/src/modules/points/points.controller.ts` — `GET /points/me/balance`, `GET /points/me/transactions`
  - `backends/src/modules/points/points-admin.controller.ts` — admin endpoints (rules CRUD, config patch, manual grant, user audit)
  - `backends/src/modules/points/points.service.ts` — `award()` with idempotency + cap + cooldown + notification
  - `backends/src/modules/points/points-ledger.service.ts` — pure ledger I/O (insert with dup-key handling, balance, history, expiring-soon)
  - `backends/src/modules/points/dto/` — 5 DTOs (UpdateRule, UpdateConfig, UpdateCourseRedemption, GrantPoints, RedeemCourse)
  - Wired into `app.module.ts`
  - Backend typecheck: clean
- ✅ Step 3: Signup hook in `auth.service.ts` (uses ModuleRef pattern to avoid circular dep)
- ✅ Step 4: Course-completion hook in BOTH `course-completion.cron.ts` AND `courses.service.ts:finalizeEnrollments` — shared idempotency key `course_completed:{enrollmentId}` ensures no double-award when both run
  - `CoursesModule` now imports `PointsModule`
- ✅ Step 5: Review-approval hook in `courses.service.ts:approveReview` — only fires on approval (rejected reviews earn nothing); idempotency key `review_approved:{ratingId}`
- All hooks are best-effort (`.catch()` swallows errors so points failures never break the user-facing action)
- Backend typecheck clean
- ✅ Step 6: Added `GET /points/me/redeemable-courses` — returns balance + filtered course list (only `redeemable_for_free=true`, excludes already-enrolled, sorts affordable-first). Cost = per-course override OR `price × conversion_rate`.
- ✅ Step 7: MyPoints page replaces InviteFriendsContent
  - `frontend/src/components/student-dashboard/MyPointsContent.tsx` — gold balance card, "How to earn", "Redeem for free course" grid, paginated history
  - `frontend/src/lib/api.ts` — `pointsApi` (student) + `pointsAdminApi` (admin) clients with full types
  - Old `InviteFriendsContent.tsx` deleted; `inviteFriends.*` translations replaced with `myPoints.*` (en + ar)
  - Route `/dashboard/student/invite-friends` now renders `<MyPointsContent />`
- ✅ Step 8: Free-unlock flow (Phase 2 climax)
  - `POST /points/redeem-course` endpoint
  - `PointsService.redeemCourseForFree()` saga: insert pending redemption + ledger debit (atomic via `db.transaction`), call existing `EnrollmentsService.createEnrollment()` (preserves capacity / waitlist / re-activation logic), then mark redemption `applied`. On enrollment failure, compensating credit + redemption `released`.
  - `PointsModule` now imports `EnrollmentsModule`
  - Course detail page: "Redeem with X points" button rendered next to Buy/Add-to-cart for paid courses, only when student is logged in + course is in their redeemable list. Disabled state shows "Need X points to redeem". Reuses `enrollResult` for unified success/error feedback.
  - 3 new translation keys: `enrollment.redeemWithPoints`, `enrollment.needMorePoints`, `enrollment.redeemSuccess` (en + ar)
  - Backend + frontend typecheck clean
- ✅ Step 9: Admin Points System dashboard section
  - Backend: added `GET /admin/points/courses`, `PATCH /admin/points/courses/:id`, `GET /admin/points/users/search` endpoints
  - Frontend: `frontend/src/components/admin-dashboard/PointsSystemContent.tsx` with 5 tabs (Earn Rules, Redemption Config, Eligible Courses, Manual Grants, User History)
  - Route: `dashboard/admin/points/page.tsx`
  - Sidebar entries (desktop + mobile) added with Coins icon
  - `pointsAdminApi` extended in `lib/api.ts` with `listCourses`, `updateCourseRedemption`, `searchUsers`
  - Full translations en + ar (`adminDashboard.points.*`)
  - Backend + frontend typecheck clean
- ✅ Step 10: Expiration cron + redemption-hold sweep
  - `backends/src/modules/points/points.cron.ts` with two cron methods
  - `sweepStaleRedemptionHolds` — every 5 minutes, releases pending redemptions past `expires_at` by inserting compensating credit + flipping status to `released`
  - `logExpiredEarnings` — daily, inserts zero-delta `system:expire` tombstone rows so users see expirations in their history (balance read already filters expired rows automatically)
  - `PointsCronService` registered in `PointsModule` providers
- ✅ Step 11: Notification types
  - Added `points_earned` + `points_redeemed` to `STUDENT_NOTIFICATION_TYPES` allowlist so the bell shows them
  - No central notification-type enum on the backend; the free-form `type` field already accepts new values
- ✅ Step 12: Translation polish
  - Replaced invalid `t(key, { default: fallback })` pattern in PointsSystemContent with a typed `KNOWN_RULE_KEYS` whitelist + explicit string fallback
  - Frontend typecheck clean

**🎉 Points System v1 build complete.** Awaiting deploy.

<!-- Add new dated entries below this line as work lands -->
