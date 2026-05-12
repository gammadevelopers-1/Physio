"use client";

const Block = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

/** Mirrors a single widget shell: header + 3 list rows. */
const ListWidgetSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Block className="h-5 w-40" />
      <Block className="h-3 w-16" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <Block key={i} className="h-14 rounded-lg" />
    ))}
  </div>
);

const StudentDashboardHomeSkeleton = () => (
  <div role="status" aria-busy="true" className="space-y-4">
    <span className="sr-only">Loading...</span>

    {/* KPI cards — 3 cards (matches DashboardStats post-refactor) */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
        >
          <Block className="w-10 h-10 rounded-lg" />
          <div className="space-y-1.5">
            <Block className="h-3 w-24" />
            <Block className="h-7 w-16" />
            <Block className="h-2.5 w-32" />
          </div>
        </div>
      ))}
    </div>

    {/* Continue Learning — list of 3 compact rows */}
    <ListWidgetSkeleton rows={3} />

    {/* Pending Assessments + Recommended Courses — 2-col on xl */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ListWidgetSkeleton rows={3} />
      <ListWidgetSkeleton rows={3} />
    </div>
  </div>
);

export default StudentDashboardHomeSkeleton;
