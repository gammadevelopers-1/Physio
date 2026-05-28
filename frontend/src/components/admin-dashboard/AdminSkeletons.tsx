"use client";

// Shared skeleton primitives for admin pages. Same SkeletonBlock style
// as the instructor/manager dashboards so the loading feel is consistent
// across roles.

export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

// Page-level header (title + subtitle).
export const PageHeaderSkeleton = () => (
  <div className="mb-6">
    <SkeletonBlock className="h-7 w-56 mb-2" />
    <SkeletonBlock className="h-4 w-80" />
  </div>
);

// Icon + value + label stat card. Mirrors the layout used by
// RoleRequestsContent / ComplianceContent stat strips.
export const StatCardSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 flex items-center gap-3">
    <SkeletonBlock className="w-10 h-10 rounded-lg" />
    <div className="min-w-0 flex-1 space-y-1.5">
      <SkeletonBlock className="h-5 w-12" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  </div>
);

// Full stat strip — pass count to control number of cards. Matches
// the grid breakpoints used by the actual pages.
export const StatStripSkeleton = ({ count = 4 }: { count?: number }) => (
  <div
    className={`grid grid-cols-2 md:grid-cols-3 ${count === 5 ? "xl:grid-cols-5" : count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3 mb-5`}
  >
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

// Pill / chip filter bar.
export const ChipBarSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="flex flex-wrap items-center gap-2 mb-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonBlock key={i} className="h-8 w-24 rounded-full" />
    ))}
  </div>
);

// Search input + filter dropdown row.
export const SearchBarSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
    <div className="flex flex-col sm:flex-row gap-3">
      <SkeletonBlock className="h-10 flex-1 rounded-lg" />
      <SkeletonBlock className="h-10 w-full sm:w-40 rounded-lg" />
    </div>
  </div>
);

// Vertical list item — avatar + two lines + side meta + actions.
// Used by application rows, user rows, etc.
export const ListItemSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-4">
    <SkeletonBlock className="w-12 h-12 rounded-full flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-3 w-64" />
    </div>
    <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0">
      <SkeletonBlock className="h-5 w-20 rounded-full" />
      <SkeletonBlock className="h-3 w-14" />
    </div>
    <SkeletonBlock className="h-9 w-24 rounded-lg flex-shrink-0 hidden md:block" />
  </div>
);

// Generic table-row skeleton (n columns). Falls back to flex layout
// so it works inside grid- or flex-driven tables.
export const TableRowSkeleton = ({ cols = 5 }: { cols?: number }) => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)]">
    {Array.from({ length: cols }).map((_, i) => (
      <SkeletonBlock
        key={i}
        className={`h-4 ${i === 0 ? "flex-[2]" : "flex-1"}`}
      />
    ))}
  </div>
);

// Card-grid item (course card, etc.) — image area + 3 text lines.
export const CardGridItemSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
    <SkeletonBlock className="h-40 w-full rounded-none" />
    <div className="p-4 space-y-3">
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

// Pagination bar.
export const PaginationSkeleton = () => (
  <div className="flex items-center justify-between mt-5">
    <SkeletonBlock className="h-4 w-32" />
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <SkeletonBlock key={i} className="h-8 w-8 rounded-lg" />
      ))}
    </div>
  </div>
);

// Tab strip (used by Logs / Points).
export const TabBarSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="flex border-b border-[var(--color-border)] mb-4 gap-6 px-2">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonBlock key={i} className="h-8 w-24 mb-[-1px]" />
    ))}
  </div>
);

// Hero band — title + supporting line + a few inline stat chips.
// Mirrors the PointsSystem / RoleRequestReview hero blocks.
export const HeroBandSkeleton = ({ stats = 4 }: { stats?: number }) => (
  <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-6 mb-6">
    <div className="flex flex-col lg:flex-row lg:items-start gap-6">
      <div className="flex-1 space-y-3">
        <SkeletonBlock className="h-6 w-48" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:w-[480px]">
        {Array.from({ length: stats }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--color-surface-page)] rounded-xl p-3 space-y-2"
          >
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Section card for detail pages — title row + body lines.
export const SectionCardSkeleton = ({ lines = 4 }: { lines?: number }) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <SkeletonBlock className="h-5 w-40" />
      <SkeletonBlock className="h-4 w-16" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-4 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
      ))}
    </div>
  </div>
);
