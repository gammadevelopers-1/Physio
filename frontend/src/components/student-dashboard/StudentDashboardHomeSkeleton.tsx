"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const StudentDashboardHomeSkeleton = () => (
  <div role="status" aria-busy="true">
    <span className="sr-only">Loading...</span>
    {/* 4 KPI stat cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-4"
        >
          <SkeletonBlock className="w-20 h-20 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>

    {/* Recent Courses section */}
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 mt-6">
      <SkeletonBlock className="h-6 w-40 mb-6" />
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="min-w-[280px] max-w-[320px] border border-[var(--color-border)] rounded-xl overflow-hidden"
          >
            <SkeletonBlock className="w-full h-[130px] rounded-none" />
            <div className="p-3 space-y-2">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
              <SkeletonBlock className="h-1.5 rounded-full" />
              <SkeletonBlock className="h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default StudentDashboardHomeSkeleton;
