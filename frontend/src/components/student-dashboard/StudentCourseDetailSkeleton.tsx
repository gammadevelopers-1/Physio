"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const StudentCourseDetailSkeleton = () => (
  <div role="status" aria-busy="true" className="space-y-4">
    <span className="sr-only">Loading...</span>

    {/* Course header */}
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <SkeletonBlock className="w-full sm:w-[200px] h-[120px] sm:h-[130px] rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <SkeletonBlock className="h-6 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
          <div className="flex gap-3">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
          <SkeletonBlock className="h-2 w-full rounded-full" />
        </div>
      </div>
    </div>

    {/* About + sidebar grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 space-y-3">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
          <SkeletonBlock className="h-3 w-4/6" />
        </div>

        {/* Modules / sessions list */}
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 space-y-3">
          <SkeletonBlock className="h-5 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <SkeletonBlock className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-3 w-1/3" />
              </div>
              <SkeletonBlock className="w-20 h-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 space-y-3">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-3/4" />
          <SkeletonBlock className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

export default StudentCourseDetailSkeleton;
