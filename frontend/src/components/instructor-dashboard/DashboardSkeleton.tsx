"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const DashboardSkeleton = () => {
  return (
    <div className="flex-1 min-w-0" role="status" aria-busy="true">
      <span className="sr-only">Loading...</span>
      {/* Title skeleton */}
      <SkeletonBlock className="h-8 w-48 mb-6" />

      {/* KPI Cards skeleton — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
          >
            <SkeletonBlock className="w-10 h-10 rounded-lg" />
            <div>
              <SkeletonBlock className="h-4 w-24 mb-2" />
              <SkeletonBlock className="h-8 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Today's Sessions skeleton */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] mb-6">
        <div className="p-5 border-b border-[var(--color-border)] flex justify-between">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
        <div className="p-5 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <SkeletonBlock className="w-20 h-16 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-5 w-48" />
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar widget skeleton */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] mb-6 p-5">
        <SkeletonBlock className="h-6 w-36 mb-4" />
        <div className="grid grid-cols-7 gap-2 mb-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16" />
          ))}
        </div>
      </div>

      {/* Course Performance skeleton */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] mb-6">
        <div className="p-5 border-b border-[var(--color-border)] flex justify-between">
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="h-9 w-40 rounded-lg" />
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonBlock className="h-48 rounded-lg" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-4 w-10" />
                </div>
                <SkeletonBlock className="h-2.5 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assessment Analysis skeleton */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] mb-6">
        <div className="p-5 border-b border-[var(--color-border)]">
          <SkeletonBlock className="h-6 w-52" />
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-5 rounded-full" />
                <SkeletonBlock className="h-5 rounded-full" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
