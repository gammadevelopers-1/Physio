"use client";

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div
    className={`animate-pulse bg-[var(--color-border-subtle)] rounded ${className}`}
    aria-hidden="true"
  />
);

export const KPICardSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <Skeleton className="w-10 h-10 rounded-lg" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
    <Skeleton className="h-3 w-20" />
  </div>
);

export const KPIStripSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
    {Array.from({ length: count }).map((_, i) => (
      <KPICardSkeleton key={i} />
    ))}
  </div>
);

export const ChartSkeleton = ({ height = 240 }: { height?: number }) => (
  <div
    className="bg-[var(--color-surface-page)] rounded-xl overflow-hidden relative"
    style={{ height }}
  >
    <div className="absolute inset-0 p-4 flex items-end justify-between gap-2">
      {Array.from({ length: 12 }).map((_, i) => {
        const h = 30 + ((i * 37) % 60);
        return (
          <div
            key={i}
            className="flex-1 animate-pulse bg-[var(--color-border-subtle)] rounded-t"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  </div>
);

export const ListRowSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]"
      >
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export const TableRowSkeleton = ({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-t border-[var(--color-border-subtle)]">
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c} className="px-3 py-3">
            <Skeleton className="h-3 w-full" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const WidgetSkeleton = ({ title, height = 200 }: { title?: boolean; height?: number }) => (
  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
    {title && (
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    )}
    <div className="p-5" style={{ minHeight: height }}>
      <ListRowSkeleton rows={3} />
    </div>
  </div>
);

export default Skeleton;
