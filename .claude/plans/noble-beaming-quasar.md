# Student Dashboard — Wire Profile Widget to Real Data

## Context
The student dashboard profile sidebar currently displays **hardcoded mock data** (`points: 0`, `profileCompletion: 90`, fallback avatar `/images/instructor-1.png`). The instructor and course manager dashboards already use a proper pattern: a `useInstructorProfile` / `useManagerProfile` hook that derives profile data from AuthContext's `useUser()`. The student dashboard needs the same treatment.

There are **10 student dashboard pages** that each duplicate the same inline mock `userData` object — this needs to be centralized into a single hook.

## Changes

### 1. Create `useStudentProfile` hook
**New file:** `frontend/src/hooks/useStudentProfile.ts`

Follow the `useInstructorProfile` pattern exactly:
```ts
export interface StudentProfile {
  name: string;
  email: string;
  points: number;
  profileCompletion: number;
  avatar?: string;
}
```
- Use `useUser()` from `@/contexts`
- Derive `name` from `user.firstName` + `user.lastName` (fallback to email)
- Get `email` from user
- Get `avatar` from `user.avatar` (no fallback to instructor image)
- Calculate `profileCompletion` from user fields:
  - `firstName` filled = 20%, `lastName` = 20%, `phone` = 20%, `avatar` = 20%, `department` = 20%
  - Sum the percentages for filled fields
- `points: 0` (no backend API for points yet — same as instructor's `rating: 0`)

### 2. Update `DashboardSidebar.tsx` — add avatar upload + real links
**File:** `frontend/src/components/student-dashboard/DashboardSidebar.tsx`

Match the InstructorSidebar pattern:
- Add imports: `useRef` from react, `toast` from sonner, `useAuth` from contexts, `profileApi` from api
- Add `avatarInputRef` and `handleAvatarUpload` (same as InstructorSidebar lines 43-56)
- Replace the avatar edit `<button>` with: hidden file `<input>` + button that triggers `avatarInputRef.current?.click()`
- Add `unoptimized={!!user.avatar}` to the `<Image>` tag (for backend-served avatars)
- Change "View Profile" from `<button>` to `<Link href={/${locale}/dashboard/student/settings}>`
- Change "Personal Information" and "Contact Information" buttons to also link to settings

### 3. Update `MobileSidebar.tsx` — same avatar upload + real links
**File:** `frontend/src/components/student-dashboard/MobileSidebar.tsx`

Same changes as DashboardSidebar:
- Add avatar upload functionality
- Add `unoptimized` to Image
- Change View Profile, Personal Info, Contact Info to Link to settings

### 4. Update all 10 content pages — use `useStudentProfile` hook
Remove the inline `userData`/`mockUser` construction and replace with the hook.

**Files to update (all in `frontend/src/components/student-dashboard/`):**

| File | Current pattern | Change |
|------|----------------|--------|
| `DashboardHomeContent.tsx` | Inline `userData` with `useAuth()` + hardcoded fields | Use `useStudentProfile()` |
| `MyCoursesContent.tsx` | Inline `userData` with `useAuth()` + hardcoded fields | Use `useStudentProfile()` |
| `CertificationsContent.tsx` | Inline `userData` with `useAuth()` + hardcoded fields | Use `useStudentProfile()` |
| `SettingsContent.tsx` | Inline `userData` with `useAuth()` + hardcoded fields | Use `useStudentProfile()` |
| `StudentCourseDetailContent.tsx` | Inline `userData` with `useAuth()` + hardcoded fields | Use `useStudentProfile()` |
| `FavouritesContent.tsx` | Static `mockUser` object | Use `useStudentProfile()` |
| `BadgesContent.tsx` | Static `mockUser` object | Use `useStudentProfile()` |
| `InvoicesContent.tsx` | Static `mockUser` object | Use `useStudentProfile()` |
| `InviteFriendsContent.tsx` | Static `mockUser` object | Use `useStudentProfile()` |
| `ApplicationsContent.tsx` | Static `mockUser` object | Use `useStudentProfile()` |

For each file:
- Add `import { useStudentProfile } from "@/hooks/useStudentProfile"`
- Replace the `userData`/`mockUser` block with `const userData = useStudentProfile()`
- Remove any now-unused `useAuth` import (if only used for userData)
- Pass `userData` (or rename if needed) to `<DashboardSidebar>`, `<MobileSidebar>`, and `<DashboardNavbar>`

### 5. Also pass profile to DashboardNavbar
The `DashboardNavbar` receives `user` prop with `{ name, avatar }`. The `useStudentProfile()` hook returns these fields, so it naturally works. No change to DashboardNavbar needed — just ensure the parent passes the hook's output.

## Critical files

| Category | File |
|----------|------|
| New hook | `frontend/src/hooks/useStudentProfile.ts` |
| Sidebar (desktop) | `frontend/src/components/student-dashboard/DashboardSidebar.tsx` |
| Sidebar (mobile) | `frontend/src/components/student-dashboard/MobileSidebar.tsx` |
| 10 content pages | See table in step 4 |
| Reference | `frontend/src/hooks/useInstructorProfile.ts` |
| Reference | `frontend/src/components/instructor-dashboard/InstructorSidebar.tsx` |

## Verification
1. `cd frontend && npx tsc --noEmit` — zero errors
2. Open student dashboard — profile shows real name, email, avatar from the logged-in user
3. Click avatar edit button — file picker opens, upload works, avatar updates
4. Profile completion shows dynamic percentage based on filled fields
5. "View Profile", "Personal Information", "Contact Information" all navigate to settings page
6. Navigate to all 10 student dashboard pages — each shows the same real profile data in the sidebar
7. Test in Arabic locale — RTL layout preserved, name displays correctly
