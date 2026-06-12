"use client";

// Full-page skeleton shared by the supervisor + agent dashboards.
// Mirrors the populated layout 1:1 so when data lands the page
// doesn't reflow.
//
// Layout from top:
//   - 5 KPI card strip (matches SupportKPICards)
//   - Tickets board table (header + 6 rows)
//   - SLA / agent performance section (2x2 metric grid + agent table)
//   - Right rail skeleton (handled by SupportRightSidebar's own skeleton)

const Block = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const Card = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 ${className || ""}`}
  >
    {children}
  </div>
);

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Block className="w-8 h-8 rounded-lg" />
            <Block className="h-3 w-16" />
          </div>
          <Block className="h-6 w-12 mb-1" />
          <Block className="h-3 w-20" />
        </Card>
      ))}
    </div>
  );
}

function TicketsBoardSkeleton() {
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-40" />
        <div className="flex gap-2">
          <Block className="h-8 w-24 rounded-lg" />
          <Block className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 gap-3 px-4 py-2 bg-[var(--color-border-subtle)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Block key={i} className="h-3" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 px-4 py-3 border-t border-[var(--color-border)]"
          >
            <Block className="h-4 w-20" />
            <Block className="h-4 w-full col-span-2" />
            <Block className="h-4 w-16" />
            <Block className="h-4 w-12" />
            <Block className="h-4 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SlaPerformanceSkeleton() {
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-48" />
        <Block className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-3 bg-[var(--color-surface-page)] rounded-xl space-y-1.5"
          >
            <Block className="h-3 w-16" />
            <Block className="h-6 w-12" />
            <Block className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <Block className="h-4 w-32 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 border-b border-[var(--color-border)]"
          >
            <Block className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Block className="h-3 w-32" />
              <Block className="h-2.5 w-48" />
            </div>
            <Block className="h-3 w-12" />
            <Block className="h-3 w-12" />
            <Block className="h-3 w-12" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SupportDashboardSkeleton() {
  return (
    <>
      <KpiStripSkeleton />
      <TicketsBoardSkeleton />
      <SlaPerformanceSkeleton />
    </>
  );
}
