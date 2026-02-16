# INST-2.2: My Courses Page — Wire to Real API

## Context
MyCoursesContent.tsx shows 4 hardcoded mock courses. Backend `GET /courses` exists but returns raw course rows without enrollment counts, session stats, or sort support. This plan replaces all mock data with real API data, adds server-side sorting and enrichment, and wires the frontend filters/search/sort to query params.

---

## Phase 1 — Backend: Enrich `GET /courses` with sort + aggregate stats

### 1a. `backends/src/modules/courses/courses.controller.ts`
- Add `@Query('sort') sort?: string` parameter to `findAll`
- Pass `sort` through to service

### 1b. `backends/src/modules/courses/courses.service.ts`
- Import `enrollments`, `sessions` from schema
- Import `getTableColumns` from drizzle-orm
- Replace plain `db.select().from(courses)` with enriched select using correlated subqueries:
  - `enrolledCount`: `(SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id)`
  - `completionRate`: `(SELECT COALESCE(ROUND(AVG(progress)), 0) FROM enrollments WHERE course_id = courses.id)`
  - `totalSessions`: `(SELECT COUNT(*) FROM sessions WHERE course_id = courses.id)`
  - `completedSessions`: `(SELECT COUNT(*) FROM sessions WHERE course_id = courses.id AND status = 'completed')`
  - `nextSessionAt`: `(SELECT MIN(scheduled_at) FROM sessions WHERE course_id = courses.id AND scheduled_at > NOW() AND status = 'scheduled')`
- Add `sort` to params type
- Dynamic orderBy: `newest` → `createdAt DESC`, `oldest` → `createdAt ASC`, `alphabetical` → `title ASC`, `students` → enrollment count DESC

---

## Phase 2 — Frontend: Types + API method

### 2a. `frontend/src/types/instructor-dashboard.ts`
Add at end:
```ts
export interface InstructorCourse {
  id: string;
  instructorId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: 'zoom' | 'onsite' | 'blended';
  status: 'draft' | 'active' | 'completed' | 'archived';
  thumbnail: string | null;
  maxEnrollment: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  enrolledCount: number;
  completionRate: number;
  totalSessions: number;
  completedSessions: number;
  nextSessionAt: string | null;
}

export interface InstructorCoursesResponse {
  data: InstructorCourse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InstructorCoursesParams {
  status?: string;
  delivery?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
```

### 2b. `frontend/src/lib/api.ts`
Add `getCourses` to `instructorApi`:
```ts
getCourses: (params?: InstructorCoursesParams) => {
  const sp = new URLSearchParams();
  if (params?.status && params.status !== 'all') sp.set('status', params.status);
  if (params?.delivery && params.delivery !== 'all') sp.set('delivery', params.delivery);
  if (params?.search) sp.set('search', params.search);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<InstructorCoursesResponse>(`/courses${qs ? `?${qs}` : ''}`);
},
```

---

## Phase 3 — New Hook: `useInstructorCourses`

### `frontend/src/hooks/useInstructorCourses.ts` (NEW)
- Accepts `InstructorCoursesParams`
- Internal 300ms debounce on `params.search`
- Calls `instructorApi.getCourses(...)` whenever debounced params change
- Returns `{ courses, total, totalPages, page, loading, error, refetch }`
- Follows existing pattern from `useInstructorDashboard.ts`

### `frontend/src/hooks/index.ts`
- Export the new hook

---

## Phase 4 — Rewrite `MyCoursesContent.tsx`

### `frontend/src/components/instructor-dashboard/MyCoursesContent.tsx`
- **Delete**: `Course` interface, mock `courses` array, `filteredCourses` logic
- **Add imports**: `useInstructorCourses`, `DashboardError`, `Link` (for Create Course button)
- **Use hook**:
  ```tsx
  const { courses, loading, error, refetch } = useInstructorCourses({
    status: statusFilter, delivery: deliveryFilter,
    search: searchQuery, sort: sortBy, page: 1, limit: 20,
  });
  ```
- **Field mappings** in card template:
  - `course.delivery` → `course.deliveryType`
  - `course.enrolledStudents` → `course.enrolledCount`
  - `course.nextSession` → format `course.nextSessionAt` (Today/Tomorrow/date + time)
  - `course.thumbnail` → `course.thumbnail || '/student_dashboard/courses/image 473.svg'`
  - Title → `locale === 'ar' && course.titleAr ? course.titleAr : course.title`
- **Loading state**: Show header + filters always. Skeleton grid (4 cards with `animate-pulse`) in the cards area.
- **Error state**: `<DashboardError message={error} onRetry={refetch} />`
- **Empty state**: Already exists — keep as-is
- **Create Course buttons** (header + empty state): `<Link href={/${locale}/dashboard/instructor/courses/create}>`
- **Card thumbnails**: Use `unoptimized` on Image for backend-served thumbnails (same pattern as avatar fix)

---

## Files Modified

| File | Action |
|------|--------|
| `backends/src/modules/courses/courses.controller.ts` | Add `sort` query param |
| `backends/src/modules/courses/courses.service.ts` | Add sort + enrichment subqueries |
| `frontend/src/types/instructor-dashboard.ts` | Add `InstructorCourse`, response, params types |
| `frontend/src/lib/api.ts` | Add `instructorApi.getCourses()` |
| `frontend/src/hooks/index.ts` | Export new hook |
| `frontend/src/components/instructor-dashboard/MyCoursesContent.tsx` | Remove mock data, wire to API |

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useInstructorCourses.ts` | Parameterized fetching hook with 300ms debounced search |

---

## Verification

1. `cd backends && npm run build` — compiles
2. `cd frontend && npx tsc --noEmit` — type-checks
3. `docker compose up -d --build` — restart containers
4. Navigate to My Courses page — should show real courses from DB (or empty state if none)
5. Test: Change status filter → courses re-fetch with `?status=active`
6. Test: Type in search → 300ms debounce → courses re-fetch with `?search=...`
7. Test: Change sort → courses re-fetch with `?sort=alphabetical`
8. Test: Click "View Details" → navigates to `/dashboard/instructor/courses/:realUUID`
9. Test: Click "Create Course" → navigates to create page
