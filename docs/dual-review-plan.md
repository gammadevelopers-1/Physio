# Dual-Review System + Certificate Gate

Status: in progress (started 2026-05-09)

## Goal

After a student completes a course, they must submit two reviews — one for the course, one for the instructor — before they can request the certificate. Both flow through the same manager moderation pipeline (approve/reject/publish). Points reward fires once per enrollment when both reviews are approved.

## Locked decisions

| Question | Answer |
|---|---|
| Cert gate trigger | Both reviews **submitted** (regardless of approval state) |
| Points reward | **Single award when both approved**, idempotency key per enrollment |
| Existing completed enrollments | Treat same as new (test data only) |
| Public surface for instructor reviews | **Backend + admin only** for now; no public render |
| Multi-instructor courses | Not applicable — `courses.instructor_id` is a single FK |

## Edge cases (calling them out, may revisit)

- A **rejected** review still satisfies the cert gate. Otherwise a hostile/unresponsive manager could block a student forever.
- If `course.instructor_id` is null (data anomaly), instructor-review submission is skipped and gate falls back to course-review only.

## Implementation steps

### 1. Schema

New table `instructor_ratings` parallel to `course_ratings`:

```
id              uuid PK
course_id       uuid FK -> courses (context)
instructor_id   uuid FK -> users   (target)
student_id     uuid FK -> users
rating          int 1..5 (CHECK)
review_text     text NULL
moderation_status varchar default 'pending'  -- pending | approved | rejected
is_published    boolean default false
reviewed_by     uuid FK -> users NULL
reviewed_at     timestamp NULL
created_at, updated_at timestamps

UNIQUE (course_id, student_id)
INDEX  course_id, instructor_id, student_id, moderation_status, is_published
```

Idempotent migration SQL: `backends/src/database/scripts/apply-instructor-ratings-migration.sql` (CREATE TABLE IF NOT EXISTS pattern, applied to prod manually like points migration).

### 2. Backend module changes

`backends/src/modules/courses/` (extend existing module — instructor reviews are course-scoped):

- `courses.service.ts`:
  - `submitInstructorRating(courseId, studentId, dto)` — UPSERT semantics like course rating
  - `getMyInstructorRating(courseId, studentId)`
  - `listInstructorReviewsForManager(managerUserId, params)` — moderation queue
  - `approveInstructorReview(courseId, ratingId, manager)` — flips status, runs dual-approval points check
  - `rejectInstructorReview(courseId, ratingId, manager)`
  - `setInstructorReviewPublished(courseId, ratingId, isPublished)`
  - `deleteInstructorRating(courseId, ratingId)`
  - `listReviewsForInstructor(instructorId)` — for side-sheet

- `courses.controller.ts`:
  - `POST   /courses/:id/instructor-ratings`
  - `GET    /courses/:id/instructor-ratings/me`
  - `GET    /courses/instructor-reviews/manager`
  - `POST   /courses/:id/instructor-ratings/:ratingId/approve`
  - `POST   /courses/:id/instructor-ratings/:ratingId/reject`
  - `PATCH  /courses/:id/instructor-ratings/:ratingId/publish`
  - `DELETE /courses/:id/instructor-ratings/:ratingId`

- `instructor.controller.ts` (existing): `GET /instructor/:id/reviews` — list approved instructor reviews with course tag.

### 3. Points trigger refactor

In `points.service.ts` or `courses.service.ts`:

- Old key: `review_approved:{ratingId}` (per-review)
- New key: `review_approved:{enrollmentId}` (per-enrollment, deduped)
- New helper: `tryAwardDualReviewApproval(courseId, studentId)` — checks both `course_ratings` AND `instructor_ratings` are status='approved' for this pair. Called from both approve endpoints. The award is idempotent — second call is no-op.

Existing `review_approved:{ratingId}` keys in production: not present yet (course is fresh; nothing has fired this rule with the new id). Safe to change without migration of ledger rows.

### 4. Certificate gate

`certificates.service.ts` `createCertificateRequest()`:
- Pre-check: course rating exists for (courseId, studentId)? if no → 400 `errors.courseReviewRequired`
- Pre-check: instructor rating exists OR course has no instructor? if no → 400 `errors.instructorReviewRequired`
- Otherwise proceed as today.

### 5. Student-side UI

- `MyCoursesContent.tsx`: completed-course card now shows two review pills ("Course Review ✓/—", "Instructor Review ✓/—"). "Request Certificate" disabled until both submitted with helper text.
- New `LeaveInstructorReviewModal.tsx` (clone of existing review modal, takes instructor name + courseId).
- API hooks fetch both ratings to determine state.

### 6. Manager Reviews page

`ManagerAllReviewsContent.tsx`:
- Add top-level segmented control **Course Reviews | Instructor Reviews** with pending counts.
- Existing All/Pending/Approved/Rejected tabs scoped to active segment.
- Two endpoints fetched depending on segment.

### 7. Manager course detail — Student Reviews block

`CourseManagerCourseDetailContent.tsx`:
- Add `mt-8` top margin to block.
- Add segmented switch **Course | Instructor** above the avg/histogram/cards layout.
- Reuse layout for both.

### 8. Manager instructors — side sheet

`InstructorDetailPanel.tsx`:
- New "Reviews" section: rating + text + student + date + course tag chip.
- Sources from `GET /instructor/:id/reviews`.

### 9. Instructor rating linkage

- `instructor.service.ts` `getInstructorRoster()`: switch `avgRating` source from `course_ratings` to `instructor_ratings` (approved + published).
- Instructor's own dashboard: add a rating widget powered by same source.

### 10. Frontend API client

`frontend/src/lib/api.ts` additions:
- `submitInstructorRating(courseId, rating, reviewText)`
- `getMyInstructorRating(courseId)`
- `getManagerInstructorReviews(params)`
- `approveInstructorReview / rejectInstructorReview / setInstructorReviewPublished / deleteInstructorRating`
- `getReviewsForInstructor(instructorId)`

### 11. i18n

`en.json` + `ar.json` — new keys for: instructor review labels, segmented control labels, modal copy, error messages.

### 12. Deployment

Apply schema migration to prod via direct connection, then deploy backend + frontend like the points rollout.

## Out of scope (NOT touched)

- Public course detail page — no instructor reviews section
- Public instructor profile page — no reviews section
- Home carousel — no instructor reviews
- Existing course review behavior — unchanged
- Certificate approval flow on manager side — unchanged
- Multi-instructor support — single FK, no support needed

## Progress log

- 2026-05-09: plan saved, starting implementation
- 2026-05-09: backend complete — schema, service methods, controller endpoints, certificate gate, dual-review points trigger, instructor-roster rating switched to instructor_ratings, instructor side-sheet endpoint
- 2026-05-09: frontend complete — API client wrappers, shared `ReviewModal`, MyCoursesContent dual-CTA, StudentCourseDetailContent cert gate with checklist, ManagerAllReviewsContent segmented control with cross-type pending counts, CourseManagerCourseDetailContent switch + mt-8, InstructorDetailPanel reviews section
- 2026-05-09: i18n keys added (`leaveInstructorReview`, `instructorReviewTitle`) en + ar; rest of strings inline locale-conditional
- 2026-05-09: backend `nest build` clean, frontend `tsc --noEmit` clean
- pending: prod migration `apply-instructor-ratings-migration.sql`, deploy backend + frontend (awaiting user "deploy")
