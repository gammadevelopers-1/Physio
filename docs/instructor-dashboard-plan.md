# Instructor Dashboard — Full Functional Implementation Plan

**Project:** PhysioGuidance eLearning Platform
**Date:** February 16, 2026
**Version:** 1.0
**Prepared for:** Development Team

---

## 1. Executive Summary

The instructor dashboard currently has a **complete UI prototype** (11 pages, 27 components, fully bilingual EN/AR, responsive) but operates entirely on hardcoded mock data. No backend tables, API endpoints, or real data integration exist.

This document details the full plan to make the instructor dashboard **production-ready** — from database schema design through API development to frontend integration.

**Scope:** 17 tickets across 3 epics
**Total Estimate:** ~20 dev days (2.5-3 weeks with 2 developers)
**Prerequisite:** RBAC Phase 1 (real authentication) must be completed first — the instructor dashboard needs a real logged-in user to know which courses/sessions to show.

---

## 2. Current State Analysis

### 2.1 What EXISTS (Frontend UI — All Mocked)

**Pages (11):**

| Page | File Path | Status |
|------|-----------|--------|
| Dashboard Home | `(dashboards)/dashboard/instructor/page.tsx` | UI complete, mock data |
| My Courses | `instructor/courses/page.tsx` | UI complete, mock data |
| Course Detail | `instructor/courses/[courseId]/page.tsx` | UI complete, mock data |
| Students List | `instructor/students/page.tsx` | UI complete, mock data |
| Student Detail | `instructor/students/[studentId]/page.tsx` | UI complete, mock data |
| Assessments | `instructor/assessments/page.tsx` | UI complete, mock data |
| Sessions | `instructor/sessions/page.tsx` | UI complete, mock data |
| Certificates | `instructor/certificates/page.tsx` | UI complete, mock data |
| Content Mgmt | `instructor/content/page.tsx` | UI complete, mock data |
| Reports | `instructor/reports/page.tsx` | UI complete, mock data |
| Settings | `instructor/settings/page.tsx` | UI complete, mock data |

**Components (27):** All in `frontend/src/components/instructor-dashboard/`

| Category | Components |
|----------|-----------|
| Layout/Nav | InstructorNavbar, InstructorSidebar, InstructorMobileSidebar |
| Dashboard Widgets | InstructorDashboardContent, InstructorKPICards, TodaysSessions, CoursePerformance, AssessmentAnalysisWidget, RecentFeedbackWidget, InstructorNotificationsWidget, InstructorCalendarWidget, AtRiskLearners, CertificateQueue, SessionsCalendarWidget, InstructorTabs |
| Page Content | MyCoursesContent, CourseDetailContent, SessionsContent, StudentsContent, StudentDetailContent, AssessmentsContent, CertificatesContent, ContentManagementContent, ReportsContent, SettingsContent, SessionCard |

### 2.2 What DOES NOT EXIST (Backend — Needs to Be Built)

- No `courses` or `course_modules` table
- No `sessions` table
- No `enrollments` table
- No `attendance` table
- No `assessments`, `questions`, or `submissions` tables
- No `course_materials` table
- No `certificate_requests` table
- No API endpoints for any instructor functionality
- No file upload integration for content/materials
- No report generation logic
- No Zoom/meeting integration

### 2.3 Mock Data Patterns in Current UI

Every component defines its own mock data inline. Example pattern:

```typescript
// Inside MyCoursesContent.tsx
const courses = [
  { id: 1, title: "Advanced Physical Therapy", status: "active", delivery: "zoom", enrolled: 45, completion: 78 },
  { id: 2, title: "Sports Rehabilitation", status: "completed", delivery: "onsite", enrolled: 32, completion: 95 },
  // ...
];
```

All button handlers are no-ops:
```typescript
const handleSubmit = () => {
  console.log("Form submitted:", formData);
  // NO ACTUAL API CALL
};
```

---

## 3. Architecture Overview

### 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS |
| Backend | NestJS 10 + Drizzle ORM |
| Database | PostgreSQL 15 (via Docker) |
| File Storage | Local filesystem (dev) / GCP Cloud Storage (prod) |
| Auth | JWT access token (in-memory) + httpOnly refresh cookie |
| i18n | next-intl (en/ar) + Strapi i18n |

### 3.2 Data Flow

```
[Instructor Browser]
       │
       ▼
[Next.js Frontend]  ──(fetch with JWT)──▶  [NestJS Backend]
                                                  │
                                      ┌───────────┼───────────┐
                                      ▼           ▼           ▼
                                [PostgreSQL]  [File Storage]  [Email Service]
```

### 3.3 Authorization Model

- Every instructor endpoint checks `@Roles('INSTRUCTOR')` guard
- Instructors can ONLY access their own courses/sessions/students
- Ownership is enforced at the service level: `WHERE instructorId = currentUser.id`
- Admin/Super Admin can access all instructor data (for oversight)

---

## 4. Database Schema Design

### 4.1 Entity Relationship Summary

```
users (existing)
  │
  ├── 1:N ──▶ courses
  │              │
  │              ├── 1:N ──▶ course_modules
  │              ├── 1:N ──▶ sessions ──── 1:N ──▶ attendance
  │              ├── 1:N ──▶ enrollments
  │              ├── 1:N ──▶ assessments ── 1:N ──▶ questions
  │              │                          1:N ──▶ submissions
  │              ├── 1:N ──▶ course_materials
  │              └── 1:N ──▶ certificate_requests
  │
  └── (studentId) ──▶ enrollments, attendance, submissions, certificate_requests
```

### 4.2 Table: courses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| instructorId | UUID | FK → users.id, NOT NULL | Course owner |
| title | VARCHAR(255) | NOT NULL | English title |
| titleAr | VARCHAR(255) | | Arabic title |
| description | TEXT | | English description |
| descriptionAr | TEXT | | Arabic description |
| deliveryType | VARCHAR(20) | NOT NULL, CHECK (zoom/onsite/blended) | How course is delivered |
| status | VARCHAR(20) | DEFAULT 'draft', CHECK (draft/active/completed/archived) | Course lifecycle |
| thumbnail | VARCHAR(500) | | Thumbnail image URL |
| maxEnrollment | INTEGER | | Max students allowed |
| startDate | DATE | | Course start date |
| endDate | DATE | | Course end date |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| updatedAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `instructorId`, `status`

### 4.3 Table: course_modules

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | Parent course |
| title | VARCHAR(255) | NOT NULL | Module title |
| titleAr | VARCHAR(255) | | Arabic title |
| orderIndex | INTEGER | NOT NULL DEFAULT 0 | Display order |
| type | VARCHAR(20) | CHECK (video/document/quiz/mixed) | Module content type |
| durationMinutes | INTEGER | | Estimated duration |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| updatedAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `courseId`, `(courseId, orderIndex)`

### 4.4 Table: sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | Parent course |
| instructorId | UUID | FK → users.id | Session instructor |
| title | VARCHAR(255) | NOT NULL | Session title |
| type | VARCHAR(20) | NOT NULL, CHECK (zoom/onsite/hybrid) | Delivery method |
| scheduledAt | TIMESTAMP | NOT NULL | When the session starts |
| durationMinutes | INTEGER | NOT NULL DEFAULT 60 | Planned duration |
| zoomLink | VARCHAR(500) | | Zoom meeting URL |
| meetingId | VARCHAR(100) | | External meeting ID |
| roomName | VARCHAR(255) | | Physical room name |
| venueAddress | TEXT | | Physical venue address |
| status | VARCHAR(20) | DEFAULT 'scheduled', CHECK (scheduled/live/completed/cancelled) | |
| actualStartedAt | TIMESTAMP | | When instructor clicked "Start" |
| actualEndedAt | TIMESTAMP | | When session actually ended |
| cancelReason | TEXT | | Why cancelled |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| updatedAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `courseId`, `instructorId`, `scheduledAt`, `status`

### 4.5 Table: enrollments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | |
| studentId | UUID | FK → users.id ON DELETE CASCADE | |
| status | VARCHAR(20) | DEFAULT 'active', CHECK (active/completed/dropped/suspended) | |
| progress | INTEGER | DEFAULT 0, CHECK (0-100) | Overall progress percentage |
| enrolledAt | TIMESTAMP | DEFAULT NOW() | |
| completedAt | TIMESTAMP | | When student finished |
| lastAccessedAt | TIMESTAMP | | Last activity |
| UNIQUE | | (courseId, studentId) | One enrollment per student per course |

**Indexes:** `courseId`, `studentId`, `status`

### 4.6 Table: attendance

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| sessionId | UUID | FK → sessions.id ON DELETE CASCADE | |
| studentId | UUID | FK → users.id ON DELETE CASCADE | |
| status | VARCHAR(20) | DEFAULT 'absent', CHECK (present/absent/late/excused) | |
| joinedAt | TIMESTAMP | | When student joined |
| leftAt | TIMESTAMP | | When student left |
| durationMinutes | INTEGER | | Actual time in session |
| markedBy | UUID | FK → users.id | Who marked the attendance |
| note | TEXT | | Reason for late/excused |
| UNIQUE | | (sessionId, studentId) | One record per student per session |

**Indexes:** `sessionId`, `studentId`

### 4.7 Table: assessments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | |
| moduleId | UUID | FK → course_modules.id, NULLABLE | Optional: linked to specific module |
| title | VARCHAR(255) | NOT NULL | |
| type | VARCHAR(20) | NOT NULL, CHECK (quiz/exam/assignment) | |
| totalMarks | INTEGER | NOT NULL | Maximum score |
| passingMarks | INTEGER | NOT NULL | Minimum to pass |
| durationMinutes | INTEGER | | Time limit (null = no limit) |
| attemptsAllowed | INTEGER | DEFAULT 1 | Max attempts |
| status | VARCHAR(20) | DEFAULT 'draft', CHECK (draft/published/closed) | |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| updatedAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `courseId`, `moduleId`, `status`

### 4.8 Table: questions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| assessmentId | UUID | FK → assessments.id ON DELETE CASCADE, NULLABLE | Null = belongs to question bank only |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | For question bank grouping |
| type | VARCHAR(20) | NOT NULL, CHECK (mcq/true_false/short_answer/essay) | |
| questionText | TEXT | NOT NULL | English question |
| questionTextAr | TEXT | | Arabic question |
| options | JSONB | | MCQ options: [{ text, textAr, isCorrect }] |
| correctAnswer | TEXT | | For non-MCQ types |
| marks | INTEGER | NOT NULL DEFAULT 1 | Points for this question |
| difficultyLevel | VARCHAR(20) | CHECK (easy/medium/hard) | |
| createdAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `assessmentId`, `courseId`, `difficultyLevel`

### 4.9 Table: submissions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| assessmentId | UUID | FK → assessments.id ON DELETE CASCADE | |
| studentId | UUID | FK → users.id ON DELETE CASCADE | |
| answers | JSONB | | [{ questionId, answer, isCorrect, marksAwarded }] |
| score | INTEGER | | Total marks obtained |
| totalMarks | INTEGER | | Total marks possible |
| percentage | DECIMAL(5,2) | | Score percentage |
| startedAt | TIMESTAMP | DEFAULT NOW() | |
| submittedAt | TIMESTAMP | | |
| status | VARCHAR(20) | DEFAULT 'in_progress', CHECK (in_progress/submitted/graded) | |

**Indexes:** `assessmentId`, `studentId`, `(assessmentId, studentId)`

### 4.10 Table: course_materials

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | |
| moduleId | UUID | FK → course_modules.id, NULLABLE | Optional module link |
| title | VARCHAR(255) | NOT NULL | Material title |
| type | VARCHAR(20) | NOT NULL, CHECK (video/pdf/document/image) | |
| fileUrl | VARCHAR(500) | NOT NULL | Storage path/URL |
| fileSize | BIGINT | | File size in bytes |
| mimeType | VARCHAR(100) | | MIME type |
| version | INTEGER | DEFAULT 1 | Version number |
| previousVersionId | UUID | FK → course_materials.id, NULLABLE | Link to previous version |
| status | VARCHAR(20) | DEFAULT 'processing', CHECK (processing/live/failed) | |
| wcagStatus | VARCHAR(20) | DEFAULT 'pending', CHECK (pending/pass/warning/fail) | Accessibility status |
| captionsUrl | VARCHAR(500) | | Captions file URL |
| transcriptUrl | VARCHAR(500) | | Transcript file URL |
| uploadedBy | UUID | FK → users.id | |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| updatedAt | TIMESTAMP | DEFAULT NOW() | |

**Indexes:** `courseId`, `moduleId`, `type`, `status`

### 4.11 Table: certificate_requests

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| courseId | UUID | FK → courses.id ON DELETE CASCADE | |
| studentId | UUID | FK → users.id ON DELETE CASCADE | |
| status | VARCHAR(20) | DEFAULT 'pending', CHECK (pending/approved/rejected/held) | |
| attendancePercent | DECIMAL(5,2) | | Computed: student's attendance % |
| assessmentPassed | BOOLEAN | | Computed: did student pass? |
| courseCompleted | BOOLEAN | | Computed: is progress 100%? |
| reviewedBy | UUID | FK → users.id, NULLABLE | Admin/instructor who reviewed |
| reviewNote | TEXT | | Notes (especially for reject/hold) |
| reviewedAt | TIMESTAMP | | |
| certificateUrl | VARCHAR(500) | | Generated certificate PDF URL |
| createdAt | TIMESTAMP | DEFAULT NOW() | |
| UNIQUE | | (courseId, studentId) | One request per student per course |

**Indexes:** `courseId`, `studentId`, `status`, `reviewedBy`

---

## 5. API Endpoints Reference

### 5.1 Courses Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| POST | `/api/courses` | INSTRUCTOR | Create a new course |
| GET | `/api/courses` | INSTRUCTOR | List my courses (filter: status, delivery, search) |
| GET | `/api/courses/:id` | INSTRUCTOR (own) | Course detail with modules |
| PATCH | `/api/courses/:id` | INSTRUCTOR (own) | Update course |
| DELETE | `/api/courses/:id` | INSTRUCTOR (own) | Delete draft course only |
| POST | `/api/courses/:id/modules` | INSTRUCTOR (own) | Add module to course |
| PATCH | `/api/courses/:id/modules/:mid` | INSTRUCTOR (own) | Update module |
| DELETE | `/api/courses/:id/modules/:mid` | INSTRUCTOR (own) | Remove module |
| PATCH | `/api/courses/:id/modules/reorder` | INSTRUCTOR (own) | Reorder modules |

**Query params for GET /api/courses:**
- `status` — filter by course status
- `delivery` — filter by delivery type
- `search` — search title/description
- `page`, `limit` — pagination

### 5.2 Sessions Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| POST | `/api/sessions` | INSTRUCTOR | Schedule new session |
| GET | `/api/sessions` | INSTRUCTOR | List my sessions (filter: date range, status, courseId) |
| GET | `/api/sessions/today` | INSTRUCTOR | Today's sessions for dashboard |
| GET | `/api/sessions/upcoming` | INSTRUCTOR | Upcoming sessions (calendar widget) |
| GET | `/api/sessions/:id` | INSTRUCTOR (own) | Session detail |
| PATCH | `/api/sessions/:id` | INSTRUCTOR (own) | Update session |
| POST | `/api/sessions/:id/start` | INSTRUCTOR (own) | Mark as live (one-click Start) |
| POST | `/api/sessions/:id/end` | INSTRUCTOR (own) | End session |
| PATCH | `/api/sessions/:id/cancel` | INSTRUCTOR (own) | Cancel with reason |

### 5.3 Enrollments & Attendance Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| GET | `/api/courses/:id/enrollments` | INSTRUCTOR (own course) | Students in a course |
| GET | `/api/sessions/:id/attendance` | INSTRUCTOR (own session) | Attendance for a session |
| POST | `/api/sessions/:id/attendance` | INSTRUCTOR (own session) | Mark attendance (single) |
| POST | `/api/sessions/:id/attendance/bulk` | INSTRUCTOR (own session) | Mark attendance (bulk) |
| PATCH | `/api/attendance/:id` | INSTRUCTOR | Update attendance record |

### 5.4 Students (Instructor View)

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| GET | `/api/instructor/students` | INSTRUCTOR | All students across my courses |
| GET | `/api/instructor/students/:id` | INSTRUCTOR | Student detail (enrollments, attendance, scores) |
| GET | `/api/instructor/at-risk` | INSTRUCTOR | At-risk learners list |

**At-risk criteria:**
- Attendance < 70% across all sessions
- Assessment average < 60%
- No activity in last 7 days
- Returns: `riskType` (low_attendance / low_score / inactive)

### 5.5 Assessments Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| POST | `/api/assessments` | INSTRUCTOR | Create assessment |
| GET | `/api/courses/:id/assessments` | INSTRUCTOR (own) | List assessments for course |
| GET | `/api/assessments/:id` | INSTRUCTOR (own) | Assessment detail |
| PATCH | `/api/assessments/:id` | INSTRUCTOR (own) | Update assessment |
| DELETE | `/api/assessments/:id` | INSTRUCTOR (own) | Delete draft assessment |
| POST | `/api/assessments/:id/questions` | INSTRUCTOR (own) | Add question |
| PATCH | `/api/questions/:id` | INSTRUCTOR | Update question |
| DELETE | `/api/questions/:id` | INSTRUCTOR | Remove question |
| GET | `/api/courses/:id/question-bank` | INSTRUCTOR (own) | Course question bank |
| GET | `/api/assessments/:id/submissions` | INSTRUCTOR (own) | Student submissions |
| PATCH | `/api/submissions/:id/grade` | INSTRUCTOR | Grade a submission |
| GET | `/api/assessments/:id/item-analysis` | INSTRUCTOR (own) | Difficulty index, discrimination index, pre/post comparison |

**Item Analysis Response:**
```json
{
  "questions": [
    {
      "questionId": "uuid",
      "questionText": "...",
      "difficultyIndex": 0.72,
      "discriminationIndex": 0.45,
      "correctResponseRate": 0.68,
      "avgTimeSpent": 45
    }
  ],
  "prePostComparison": {
    "preTestAvg": 42.5,
    "postTestAvg": 78.3,
    "improvement": 35.8
  }
}
```

### 5.6 Content & Materials Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| POST | `/api/courses/:id/materials` | INSTRUCTOR (own) | Upload material (multipart) |
| GET | `/api/courses/:id/materials` | INSTRUCTOR (own) | List materials (filter: type, status) |
| PATCH | `/api/materials/:id` | INSTRUCTOR (own) | Update metadata |
| POST | `/api/materials/:id/replace` | INSTRUCTOR (own) | Upload new version |
| DELETE | `/api/materials/:id` | INSTRUCTOR (own) | Remove material |

**Upload request:** `multipart/form-data`
- `file` — the file binary
- `title` — material title
- `moduleId` — optional module link
- Max file size: 100MB for video, 10MB for documents

### 5.7 Certificates Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| GET | `/api/instructor/certificates` | INSTRUCTOR | Pending requests across my courses |
| GET | `/api/certificates/:id` | INSTRUCTOR (own course) | Request detail with eligibility |
| PATCH | `/api/certificates/:id/approve` | INSTRUCTOR | Approve |
| PATCH | `/api/certificates/:id/reject` | INSTRUCTOR | Reject with note |
| PATCH | `/api/certificates/:id/hold` | INSTRUCTOR | Hold with audit note |
| POST | `/api/certificates/batch` | INSTRUCTOR | Batch approve/reject |

**Eligibility auto-check (computed on request creation):**
- `attendancePercent` — calculated from attendance records
- `assessmentPassed` — did student pass all required assessments?
- `courseCompleted` — is enrollment progress = 100%?

### 5.8 Reports Module

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| GET | `/api/instructor/reports/attendance` | INSTRUCTOR | Attendance report |
| GET | `/api/instructor/reports/gradebook` | INSTRUCTOR | Gradebook export |
| GET | `/api/instructor/reports/enrollment` | INSTRUCTOR | Enrollment report |
| GET | `/api/instructor/reports/completion` | INSTRUCTOR | Completion report |

**Query params for all reports:**
- `courseId` — required
- `format` — `csv` / `pdf` / `xlsx`
- `dateFrom`, `dateTo` — optional date range

**Response:** Binary file download with appropriate Content-Type header

---

## 6. Jira Tickets — Detailed Breakdown

---

### EPIC 1: Backend — Core Data Models & APIs

---

#### TICKET 1.1: Courses & Modules schema + CRUD

**Type:** Story
**Priority:** Critical
**Estimate:** 2 days (16 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api

**Description:**
Create the `courses` and `course_modules` Drizzle schema and full CRUD REST endpoints for the instructor to manage their courses.

**Acceptance Criteria:**
- [ ] `courses` table created in Drizzle schema (see Section 4.2)
- [ ] `course_modules` table created (see Section 4.3)
- [ ] Migration generated and applied
- [ ] All endpoints from Section 5.1 implemented
- [ ] Ownership guard: instructors can only access/modify their own courses
- [ ] Query filtering works: status, delivery, search, pagination
- [ ] Unit tests for service methods
- [ ] Integration tests for endpoints (at least happy path)

**Technical Notes:**
- Add schema files: `backends/src/database/schema/courses.ts`, `course-modules.ts`
- Create module: `backends/src/modules/courses/` (module, service, controller, DTOs)
- Register in `app.module.ts`
- Use `@Roles('INSTRUCTOR')` guard + custom ownership check in service
- Return 404 if course doesn't belong to instructor
- Run `make db-generate && make db-migrate`

**Files to create:**
- `backends/src/database/schema/courses.ts`
- `backends/src/database/schema/course-modules.ts`
- `backends/src/modules/courses/courses.module.ts`
- `backends/src/modules/courses/courses.service.ts`
- `backends/src/modules/courses/courses.controller.ts`
- `backends/src/modules/courses/dto/create-course.dto.ts`
- `backends/src/modules/courses/dto/update-course.dto.ts`

**Files to modify:**
- `backends/src/database/schema/index.ts` (export new tables)
- `backends/src/app.module.ts` (register CoursesModule)

---

#### TICKET 1.2: Sessions schema + CRUD

**Type:** Story
**Priority:** Critical
**Estimate:** 1.5 days (12 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api
**Blocked by:** Ticket 1.1 (sessions FK → courses)

**Description:**
Create the `sessions` table and endpoints for scheduling, starting, ending, and cancelling sessions.

**Acceptance Criteria:**
- [ ] `sessions` table created (see Section 4.4)
- [ ] All endpoints from Section 5.2 implemented
- [ ] `POST /sessions/:id/start` sets `status=live` and `actualStartedAt=NOW()`
- [ ] `POST /sessions/:id/end` sets `status=completed` and `actualEndedAt=NOW()`
- [ ] `GET /sessions/today` returns sessions where `scheduledAt` is today
- [ ] `GET /sessions/upcoming` returns future sessions ordered by date
- [ ] Ownership guard: only instructor's own sessions
- [ ] Cancel requires a reason

**Technical Notes:**
- One-click "Start" = simple status update (Zoom integration is separate ticket 3.2)
- Calendar data: return sessions in a format the frontend calendar widget can consume
- `GET /sessions/today` should consider instructor's timezone (pass via query or header)

**Files to create:**
- `backends/src/database/schema/sessions.ts`
- `backends/src/modules/sessions/sessions.module.ts`
- `backends/src/modules/sessions/sessions.service.ts`
- `backends/src/modules/sessions/sessions.controller.ts`
- `backends/src/modules/sessions/dto/` (create, update, start, cancel DTOs)

---

#### TICKET 1.3: Enrollments & Attendance schema + CRUD

**Type:** Story
**Priority:** Critical
**Estimate:** 1.5 days (12 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api
**Blocked by:** Ticket 1.1, Ticket 1.2 (FKs to courses, sessions)

**Description:**
Create `enrollments` and `attendance` tables. Build endpoints for viewing enrolled students and marking attendance.

**Acceptance Criteria:**
- [ ] `enrollments` table created (see Section 4.5)
- [ ] `attendance` table created (see Section 4.6)
- [ ] All endpoints from Section 5.3 implemented
- [ ] Bulk attendance marking works (mark all students for a session at once)
- [ ] `GET /instructor/students` aggregates across all instructor's courses
- [ ] `GET /instructor/students/:id` returns full student profile: enrollments, attendance summary, assessment scores
- [ ] `GET /instructor/at-risk` uses criteria: attendance < 70% OR score < 60% OR inactive > 7 days
- [ ] Unique constraint: one enrollment per student per course, one attendance per student per session

**Technical Notes:**
- At-risk query is the most complex — may need a raw SQL query or Drizzle subquery
- Student detail should join across enrollments, attendance (aggregated), and submissions (aggregated)
- The `progress` field on enrollments will be updated by other systems (when student completes modules)

**Files to create:**
- `backends/src/database/schema/enrollments.ts`
- `backends/src/database/schema/attendance.ts`
- `backends/src/modules/enrollments/` (module, service, controller)
- `backends/src/modules/instructor/` (instructor-specific aggregation service)

---

#### TICKET 1.4: Assessments & Questions schema + CRUD

**Type:** Story
**Priority:** High
**Estimate:** 2 days (16 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api
**Blocked by:** Ticket 1.1 (FK → courses)

**Description:**
Create `assessments`, `questions`, and `submissions` tables. Build full CRUD for assessment management, question bank, submission viewing, grading, and item analysis computation.

**Acceptance Criteria:**
- [ ] `assessments` table created (see Section 4.7)
- [ ] `questions` table created (see Section 4.8)
- [ ] `submissions` table created (see Section 4.9)
- [ ] All endpoints from Section 5.5 implemented
- [ ] Question bank: questions with `assessmentId=NULL` belong to course-level bank
- [ ] Item analysis endpoint computes:
  - Difficulty index = (correct answers / total attempts)
  - Discrimination index = (top27% correct rate - bottom27% correct rate)
  - Pre/post comparison (if pre-test and post-test exist for same course)
- [ ] Grading: instructor can manually grade essay/short_answer questions
- [ ] Auto-grading for MCQ and true/false (computed on submission)

**Technical Notes:**
- Item analysis is computationally intensive — compute on-demand, consider caching
- `options` JSONB format for MCQ: `[{ text: "Option A", textAr: "...", isCorrect: true }]`
- `answers` JSONB format in submissions: `[{ questionId: "uuid", answer: "...", isCorrect: true, marksAwarded: 2 }]`
- Auto-grading: on submission, compare answers against question `correctAnswer`/`options`

**Files to create:**
- `backends/src/database/schema/assessments.ts`
- `backends/src/database/schema/questions.ts`
- `backends/src/database/schema/submissions.ts`
- `backends/src/modules/assessments/` (module, service, controller, DTOs)

---

#### TICKET 1.5: Content & Materials schema + CRUD

**Type:** Story
**Priority:** High
**Estimate:** 1.5 days (12 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api, file-upload
**Blocked by:** Ticket 1.1 (FK → courses)

**Description:**
Create `course_materials` table. Build endpoints for uploading, listing, replacing (versioning), and deleting course content/materials.

**Acceptance Criteria:**
- [ ] `course_materials` table created (see Section 4.10)
- [ ] All endpoints from Section 5.6 implemented
- [ ] File upload via multipart/form-data works
- [ ] Versioning: `POST /materials/:id/replace` creates new record with incremented version, links via `previousVersionId`
- [ ] File stored to local filesystem (dev) using the existing storage module
- [ ] File size limits enforced: 100MB video, 10MB documents
- [ ] MIME type validation: only allow video/*, application/pdf, image/*, application/msword, etc.
- [ ] Status defaults to 'processing' on upload, set to 'live' after storage confirms

**Technical Notes:**
- Use the existing `backends/src/modules/storage/` module for file handling
- `STORAGE_DRIVER=local` uses `./uploads` directory (already mounted as Docker volume: `backend_uploads`)
- `STORAGE_DRIVER=gcp` uses GCP Cloud Storage (production)
- WCAG status can default to 'pending' — auto-checking is a future feature (Ticket 3.3)
- Captions/transcripts are optional fields for now

**Files to create:**
- `backends/src/database/schema/course-materials.ts`
- `backends/src/modules/materials/` (module, service, controller, DTOs)

---

#### TICKET 1.6: Certificates schema + CRUD

**Type:** Story
**Priority:** High
**Estimate:** 1 day (8 hours)
**Assignee:** Backend Developer
**Labels:** backend, database, api
**Blocked by:** Ticket 1.1, Ticket 1.3, Ticket 1.4 (needs courses, enrollments, assessments)

**Description:**
Create `certificate_requests` table. Build endpoints for listing pending requests, viewing eligibility, and approve/reject/hold actions.

**Acceptance Criteria:**
- [ ] `certificate_requests` table created (see Section 4.11)
- [ ] All endpoints from Section 5.7 implemented
- [ ] Eligibility auto-computed on request creation:
  - `attendancePercent`: count(present+late) / count(all sessions) × 100
  - `assessmentPassed`: student passed all required assessments for the course
  - `courseCompleted`: enrollment.progress === 100
- [ ] Batch endpoint: approve/reject multiple in one call
- [ ] On approve: generate a simple certificate (can be a placeholder PDF for now)
- [ ] Hold status with audit notes for edge cases

**Technical Notes:**
- Certificate PDF generation can be simple for now (use `pdfkit` or similar)
- Real certificate design/template is a separate future task
- Batch endpoint: `POST /certificates/batch { ids: [...], action: "approve" | "reject", note?: "..." }`

**Files to create:**
- `backends/src/database/schema/certificate-requests.ts`
- `backends/src/modules/certificates/` (module, service, controller, DTOs)

---

#### TICKET 1.7: Reports generation endpoints

**Type:** Story
**Priority:** Medium
**Estimate:** 1.5 days (12 hours)
**Assignee:** Backend Developer
**Labels:** backend, api, reports
**Blocked by:** Ticket 1.3, Ticket 1.4 (needs enrollment + assessment data)

**Description:**
Build report generation endpoints that query data and export as CSV, PDF, or Excel.

**Acceptance Criteria:**
- [ ] All endpoints from Section 5.8 implemented
- [ ] Attendance report: student name, email, session date, status (present/absent/late), total %
- [ ] Gradebook: student name, each assessment score, total, percentage, pass/fail
- [ ] Enrollment report: enrollment date, status, progress, last activity
- [ ] Completion report: students who completed, completion date, certificate status
- [ ] CSV format works (using `json2csv` or manual)
- [ ] PDF format works (using `pdfkit` or `puppeteer`)
- [ ] Excel format works (using `exceljs`)
- [ ] Response is a binary file download with correct Content-Type and Content-Disposition headers

**Dependencies (npm):**
```bash
npm install pdfkit exceljs
```

**Files to create:**
- `backends/src/modules/reports/` (module, service, controller)

---

### EPIC 2: Frontend — API Integration (Replace All Mock Data)

**Prerequisite:** Corresponding backend ticket from Epic 1 must be complete.

---

#### TICKET 2.1: Dashboard Home integration

**Type:** Story
**Priority:** Critical
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Tickets 1.1, 1.2, 1.3, 1.4

**Description:**
Replace all hardcoded mock data in the dashboard home page with real API calls.

**Components to wire:**

| Component | Mock Data to Remove | API Call |
|-----------|-------------------|----------|
| `InstructorKPICards.tsx` | Hardcoded numbers (5, 3, 5) | `GET /courses` (count), `GET /sessions/today` (count), `GET /instructor/at-risk` (count) |
| `TodaysSessions.tsx` | 3 mock session objects | `GET /sessions/today` |
| `CoursePerformance.tsx` | 7-day chart data, 5 module items | `GET /courses/:id/enrollments` (aggregated) |
| `AssessmentAnalysisWidget.tsx` | 4 mock module scores | `GET /assessments/:id/item-analysis` |
| `AtRiskLearners.tsx` | 5 mock learner objects | `GET /instructor/at-risk` |
| `CertificateQueue.tsx` | 5 mock certificates | `GET /instructor/certificates?status=pending` |
| `SessionsCalendarWidget.tsx` | 5 mock calendar events | `GET /sessions/upcoming` |
| `RecentFeedbackWidget.tsx` | 3 mock feedback items | Keep mock (feedback system is separate) |
| `InstructorNotificationsWidget.tsx` | 3 mock notifications | Keep mock (notification system is separate) |

**Acceptance Criteria:**
- [ ] All widgets fetch real data from backend
- [ ] Loading states shown while data loads
- [ ] Error states shown if API fails
- [ ] Empty states shown if no data (e.g., "No sessions today")
- [ ] KPI numbers reflect actual counts
- [ ] Dashboard loads within 2 seconds

**Technical Notes:**
- Create custom hooks: `useInstructorDashboard()`, `useTodaySessions()`, etc.
- Consider a single aggregated endpoint `GET /instructor/dashboard-summary` to reduce API calls (6 calls → 1 call)
- Use SWR or React Query pattern for caching (or simple `useEffect` + `fetch` to start)

---

#### TICKET 2.2: My Courses page integration

**Type:** Story
**Priority:** Critical
**Estimate:** 0.5 day (4 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.1

**Description:**
Wire `MyCoursesContent.tsx` to fetch real courses from `GET /api/courses`.

**Acceptance Criteria:**
- [ ] Courses fetched from API on page load
- [ ] Status filter (draft/active/completed) sends query param
- [ ] Delivery filter (zoom/onsite/blended) sends query param
- [ ] Search input filters by title (debounced, sends `?search=`)
- [ ] Sort options work (newest, oldest, most enrolled, alphabetical)
- [ ] Course card click navigates to `/dashboard/instructor/courses/:realCourseId`
- [ ] Loading skeleton while fetching
- [ ] "No courses found" empty state
- [ ] "Create Course" button navigates to create form (or opens modal)

---

#### TICKET 2.3: Course Detail page integration (6 tabs)

**Type:** Story
**Priority:** Critical
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Tickets 1.1, 1.2, 1.3

**Description:**
Wire `CourseDetailContent.tsx` — it has 6 tabs, each needing its own API data.

**Acceptance Criteria:**
- [ ] **Overview tab**: course info from `GET /courses/:id`
- [ ] **Modules tab**: module list from `GET /courses/:id` (populated), reorder works via `PATCH`
- [ ] **Students tab**: enrolled students from `GET /courses/:id/enrollments`
- [ ] **Sessions tab**: session list from `GET /sessions?courseId=:id`
- [ ] **Analytics tab**: enrollment count, completion rate, dropout rate, average progress — computed from enrollments data
- [ ] **Settings tab**: edit course form → `PATCH /courses/:id`
- [ ] Tab data fetches lazily (only when tab is selected)

---

#### TICKET 2.4: Sessions page integration

**Type:** Story
**Priority:** High
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.2

**Description:**
Wire `SessionsContent.tsx` — list view, calendar view, schedule modal, start/cancel actions.

**Acceptance Criteria:**
- [ ] List view: sessions from `GET /sessions` grouped by Today/Upcoming/Past
- [ ] Calendar view: sessions displayed on calendar by date
- [ ] "Schedule Session" modal: submits to `POST /sessions`
  - Course dropdown populated from `GET /courses`
  - Date, time, duration, type (zoom/onsite/hybrid), zoom link, room fields
- [ ] "Start" button: calls `POST /sessions/:id/start`, updates status to live
- [ ] "Cancel" button: opens modal for reason, calls `PATCH /sessions/:id/cancel`
- [ ] Filter by course, status, date range
- [ ] Attendance tracker: `GET /sessions/:id/attendance`, `POST /sessions/:id/attendance`

---

#### TICKET 2.5: Students page integration

**Type:** Story
**Priority:** High
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.3

**Description:**
Wire `StudentsContent.tsx` and `StudentDetailContent.tsx` to real API data.

**Acceptance Criteria:**
- [ ] Students list: `GET /instructor/students` with search, filter by course, status, sort
- [ ] At-risk badge shows for students matching at-risk criteria
- [ ] Student detail page — 4 tabs:
  - Overview: enrolled courses, stats
  - Attendance: `GET /instructor/students/:id` (attendance records)
  - Assessments: student's assessment scores
  - Activity: can stay mock for now (activity log is separate system)
- [ ] Bulk actions: "Email Selected" (prepare mailto: link or use email service)

---

#### TICKET 2.6: Assessments page integration

**Type:** Story
**Priority:** High
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.4

**Description:**
Wire `AssessmentsContent.tsx` — 4 tabs: All Assessments, Question Bank, Submissions, Item Analysis.

**Acceptance Criteria:**
- [ ] **All tab**: assessments from `GET /courses/:id/assessments`, filter by type/status
- [ ] **Question Bank tab**: questions from `GET /courses/:id/question-bank`, filter by difficulty
- [ ] **Submissions tab**: `GET /assessments/:id/submissions`, grade button works
- [ ] **Item Analysis tab**: `GET /assessments/:id/item-analysis`, charts render real data
- [ ] Create assessment modal → `POST /assessments`
- [ ] Add question flow → `POST /assessments/:id/questions`

---

#### TICKET 2.7: Content Management integration

**Type:** Story
**Priority:** High
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration, file-upload
**Blocked by:** Ticket 1.5

**Description:**
Wire `ContentManagementContent.tsx` — file listing, upload, replace, delete.

**Acceptance Criteria:**
- [ ] Material list: `GET /courses/:id/materials`, filter by type/status
- [ ] Grid view and list view both work with real data
- [ ] Upload modal: actual file upload via `POST /courses/:id/materials` (multipart/form-data)
  - Show upload progress (if possible)
  - Course dropdown populated from API
  - File type validation before upload
- [ ] Replace: `POST /materials/:id/replace` — version number increments
- [ ] Delete: `DELETE /materials/:id` with confirmation
- [ ] Status indicators (processing/live/failed) reflect real status
- [ ] WCAG status badge displays (pending/pass/warning/fail)

---

#### TICKET 2.8: Certificates page integration

**Type:** Story
**Priority:** Medium
**Estimate:** 0.5 day (4 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.6

**Description:**
Wire `CertificatesContent.tsx` to real certificate request data.

**Acceptance Criteria:**
- [ ] List: `GET /instructor/certificates`, filter by status/course
- [ ] Eligibility checks displayed: attendance %, assessment passed, course completed
- [ ] Review modal: approve/reject/hold with notes
- [ ] Batch actions: select multiple → batch approve/reject
- [ ] Status badge colors: pending (yellow), approved (green), rejected (red), held (orange)

---

#### TICKET 2.9: Reports page integration

**Type:** Story
**Priority:** Medium
**Estimate:** 1 day (8 hours)
**Assignee:** Frontend Developer
**Labels:** frontend, integration
**Blocked by:** Ticket 1.7

**Description:**
Wire `ReportsContent.tsx` to generate and download real reports.

**Acceptance Criteria:**
- [ ] Report type selection (7 types) triggers correct endpoint
- [ ] Course dropdown populated from API
- [ ] Date range picker sends `dateFrom`/`dateTo` params
- [ ] Format selection (PDF/CSV/Excel) sends `?format=` param
- [ ] File downloads correctly in browser (blob download)
- [ ] "Generate" button shows loading, then triggers download
- [ ] Recently generated reports section (can store in localStorage or backend)

---

### EPIC 3: Advanced Features (Phase 2)

These are enhancements that can be done after Epic 1 & 2 are stable.

---

#### TICKET 3.1: At-Risk Learner Interventions

**Type:** Story
**Priority:** Medium
**Estimate:** 1.5 days (12 hours)
**Assignee:** Full-Stack Developer
**Labels:** backend, frontend, email
**Blocked by:** Epic 1, Epic 2

**Description:**
Currently the at-risk widget shows learners but has no action buttons. Add intervention capabilities.

**Acceptance Criteria:**
- [ ] "Send Reminder" → sends email to student via Resend/Mailpit
- [ ] "Schedule Make-up Session" → opens session scheduler pre-filled for that student
- [ ] "Open Ticket" → creates support ticket (or placeholder if support module not ready)
- [ ] Email template for at-risk reminder
- [ ] Action logged for audit (who sent what to whom)

**Backend:**
- `POST /api/instructor/interventions` — `{ type: "email" | "makeup_session" | "ticket", studentId, courseId, message? }`

---

#### TICKET 3.2: Zoom Integration

**Type:** Story
**Priority:** Low (enhancement)
**Estimate:** 2 days (16 hours)
**Assignee:** Backend Developer
**Labels:** backend, integration, zoom

**Description:**
Integrate Zoom API so that "one-click Start" creates and joins a real Zoom meeting.

**Acceptance Criteria:**
- [ ] Zoom OAuth app configured (Server-to-Server)
- [ ] `POST /sessions` with `type=zoom` auto-creates Zoom meeting, stores link + meetingId
- [ ] `POST /sessions/:id/start` returns Zoom join URL for host
- [ ] Session detail shows meeting link for students
- [ ] Zoom webhook receives meeting ended event → auto-updates session status

**Environment:**
```
ZOOM_CLIENT_ID=xxx
ZOOM_CLIENT_SECRET=xxx
ZOOM_ACCOUNT_ID=xxx
```

---

#### TICKET 3.3: Content Auto-Processing (Transcoding, Captions)

**Type:** Story
**Priority:** Low (enhancement)
**Estimate:** 2 days (16 hours)
**Assignee:** Backend Developer
**Labels:** backend, media-processing

**Description:**
Auto-process uploaded content: transcode videos, generate captions (AR/EN), check WCAG accessibility.

**Acceptance Criteria:**
- [ ] Video upload triggers transcoding job (queue-based)
- [ ] Captions auto-generated (GCP Speech-to-Text or similar)
- [ ] Transcript generated alongside captions
- [ ] WCAG checklist auto-computed (basic checks: has captions, has alt text, proper contrast)
- [ ] Status updates: processing → live (or failed)

**Note:** This is infrastructure-heavy. Consider using GCP Transcoder API + Speech-to-Text API for production. For MVP, manual caption upload is sufficient.

---

## 7. Dependency Graph

```
TICKET 1.1 (Courses)
    │
    ├──▶ TICKET 1.2 (Sessions) ──▶ TICKET 1.3 (Enrollments/Attendance)
    │                                       │
    │                                       ├──▶ TICKET 1.6 (Certificates)
    │                                       │
    │                                       └──▶ TICKET 1.7 (Reports)
    │
    ├──▶ TICKET 1.4 (Assessments) ──▶ TICKET 1.7 (Reports)
    │
    └──▶ TICKET 1.5 (Content)

EPIC 1 (all backend) ──▶ EPIC 2 (frontend integration)
EPIC 2 ──▶ EPIC 3 (advanced features)
```

---

## 8. Timeline & Team Assignment

### Option A: 2 Developers (Recommended)

```
Week 1:
  Backend Dev:  [1.1 Courses 2d]  →  [1.2 Sessions 1.5d]
  Frontend Dev: [Setup API layer, create hooks, shared utils]  →  [2.2 My Courses 0.5d]

Week 2:
  Backend Dev:  [1.3 Enrollments 1.5d]  →  [1.4 Assessments 2d]
  Frontend Dev: [2.1 Dashboard Home 1d]  →  [2.3 Course Detail 1d]  →  [2.4 Sessions 1d]

Week 3:
  Backend Dev:  [1.5 Content 1.5d]  →  [1.6 Certs 1d]  →  [1.7 Reports 1.5d]
  Frontend Dev: [2.5 Students 1d]  →  [2.6 Assessments 1d]  →  [2.7 Content 1d]

Week 4: (buffer + advanced)
  Backend Dev:  [3.1 Interventions]  →  [Bug fixes]
  Frontend Dev: [2.8 Certificates 0.5d]  →  [2.9 Reports 1d]  →  [Bug fixes]
```

**Total: ~3 weeks with 2 devs**

### Option B: 1 Developer

Backend first (all of Epic 1): ~10 days
Frontend after (all of Epic 2): ~8 days
**Total: ~4-5 weeks with 1 dev**

---

## 9. Testing Strategy

| Type | Tool | What to Test |
|------|------|-------------|
| Unit Tests | Jest | Service methods (business logic, calculations, at-risk criteria, item analysis) |
| Integration Tests | Jest + Supertest | API endpoints (auth, CRUD, ownership guards, validation errors) |
| E2E Tests | Playwright (optional) | Full flows: create course → add module → schedule session → mark attendance |
| Manual QA | Browser | All UI flows, RTL/Arabic layout, mobile responsiveness |

**Minimum test coverage target:** 70% on backend services

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| RBAC not done yet | Blocks everything | Prioritize RBAC Phase 1 before starting this |
| Item analysis is complex | Delays Ticket 1.4 | Start with simple metrics, enhance later |
| File upload in Docker | May have volume issues | Already handled: `backend_uploads` volume exists |
| Report generation (PDF) | Library issues | Start with CSV only, add PDF/Excel later |
| Zoom API integration | OAuth complexity | Defer to Epic 3, use manual links for MVP |

---

## 11. Definition of Done

A ticket is DONE when:
1. Code is written and follows existing project patterns
2. Database migration is generated and applies cleanly
3. API endpoints return correct data (test via Postman/curl)
4. Frontend displays real data with loading/error/empty states
5. Works in both EN and AR locales
6. Works on mobile (responsive)
7. No TypeScript errors
8. PR reviewed and merged
