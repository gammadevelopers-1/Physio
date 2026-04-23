"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const StudentTranscriptSkeleton = () => (
  <div role="status" aria-busy="true">
    <span className="sr-only">Loading...</span>
    {/* Student Info */}
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-3 w-32" />
        </div>
      </div>
    </div>

    {/* 3 stat cards */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-[var(--color-border)] p-4"
        >
          <div className="flex items-center gap-3">
            <SkeletonBlock className="w-10 h-10 rounded-lg" />
            <div className="space-y-1.5">
              <SkeletonBlock className="h-6 w-10" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Table */}
    <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-1.5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default StudentTranscriptSkeleton;
