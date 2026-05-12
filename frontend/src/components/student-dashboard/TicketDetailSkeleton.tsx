"use client";

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const TicketDetailSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden"
  >
    <span className="sr-only">Loading...</span>

    {/* Header */}
    <div className="p-4 sm:p-6 border-b border-[var(--color-border)] space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <SkeletonBlock className="h-5 w-16 rounded-full" />
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-16" />
      </div>
      <SkeletonBlock className="h-6 w-2/3" />
      <SkeletonBlock className="h-3 w-1/3" />
    </div>

    {/* Conversation thread */}
    <div className="p-4 sm:p-6 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <SkeletonBlock className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>

    {/* Reply form */}
    <div className="p-4 sm:p-6 border-t border-[var(--color-border)] space-y-3">
      <SkeletonBlock className="h-24 w-full rounded-lg" />
      <SkeletonBlock className="h-9 w-32 rounded-lg ms-auto" />
    </div>
  </div>
);

export default TicketDetailSkeleton;
