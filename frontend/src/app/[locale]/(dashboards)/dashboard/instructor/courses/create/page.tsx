"use client";

import CreateCourseWizard from "@/components/instructor-dashboard/create-course-wizard/CreateCourseWizard";

export default function CreateCoursePage() {
  return (
    <main id="main-content" className="bg-[var(--color-surface-page)] min-h-screen">
      <CreateCourseWizard />
    </main>
  );
}
