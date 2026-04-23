"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const StudentCoursesGridSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" role="status" aria-busy="true">
    <span className="sr-only">Loading...</span>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="border border-[var(--color-border)] rounded-xl overflow-hidden"
      >
        <SkeletonBlock className="w-full h-[120px] sm:h-[140px] rounded-none" />
        <div className="p-3 sm:p-4 space-y-2">
          <SkeletonBlock className="h-4 w-3/4" />
          <div className="flex items-center gap-2">
            <SkeletonBlock className="w-5 h-5 rounded-full" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="h-1.5 rounded-full" />
          <SkeletonBlock className="h-8 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export default StudentCoursesGridSkeleton;
