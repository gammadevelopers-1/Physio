"use client";

// Full-page skeleton for the admin dashboard. Mirrors the actual
// AdminDashboardContent layout so the page doesn't reflow when real
// data arrives — KPI strip, funnel, finance, compliance, recent points,
// right rail. Used while the initial /admin/dashboard payload is in
// flight so the user sees a populated-looking shell instead of zero
// counts or a single spinner.

const Block = ({ className }: { className?: string }) => (
  <div className={`bg-[var(--color-border)] rounded animate-pulse ${className || ""}`} />
);

const Card = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <div
    className={`bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 ${className || ""}`}
  >
    {children}
  </div>
);

// KPI strip — admin landing shows 8 cards in 4 columns × 2 rows.
function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center gap-3">
            <Block className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Block className="h-5 w-12" />
              <Block className="h-3 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Platform analytics funnel — two chart-area placeholders + bottom strip.
function AnalyticsFunnelSkeleton() {
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-40" />
        <Block className="h-4 w-20" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Block className="h-40 w-full rounded-xl" />
        <Block className="h-40 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Block className="h-3 w-16" />
            <Block className="h-5 w-12" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Finance summary — two big revenue cards + breakdown list.
function FinanceSkeleton() {
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-32" />
        <Block className="h-4 w-16" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="p-4 bg-[var(--color-surface-page)] rounded-xl space-y-2"
          >
            <Block className="h-3 w-20" />
            <Block className="h-7 w-28" />
            <Block className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Block className="h-3 w-32" />
            <Block className="h-3 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// NELC Compliance — large headline % + progress bar + areas list.
function ComplianceSkeleton() {
  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-40" />
        <Block className="h-4 w-16" />
      </div>
      <div className="flex flex-col items-center mb-4 space-y-2">
        <Block className="h-12 w-20" />
        <Block className="h-2 w-full rounded-full" />
        <div className="flex items-center gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Block className="w-2 h-2 rounded-full" />
              <Block className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-t border-[var(--color-border)]"
          >
            <div className="flex items-center gap-2">
              <Block className="w-4 h-4 rounded" />
              <Block className="h-3 w-40" />
            </div>
            <Block className="h-3 w-12" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Recent points table — header + 6 list rows.
function RecentPointsSkeleton() {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <Block className="h-5 w-36" />
        <Block className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 border-t border-[var(--color-border)]"
          >
            <Block className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Block className="h-3 w-32" />
              <Block className="h-2.5 w-48" />
            </div>
            <Block className="h-4 w-10" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// Right-rail snapshots: support / security / users / alerts / activity.
function RightRailSkeleton() {
  return (
    <div className="space-y-4">
      {/* Support snapshot */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Block className="w-8 h-8 rounded-lg" />
          <Block className="h-4 w-24" />
        </div>
        <Block className="h-3 w-20 mb-2" />
        <Block className="h-8 w-14 mb-4" />
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-2.5 bg-[var(--color-surface-page)] rounded-lg space-y-1.5"
            >
              <Block className="h-2.5 w-10" />
              <Block className="h-4 w-12" />
              <Block className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <Block className="h-9 w-full rounded-lg" />
      </Card>

      {/* Security snapshot */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Block className="w-8 h-8 rounded-lg" />
          <Block className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Block className="w-3 h-3 rounded-full" />
                <Block className="h-3 w-24" />
              </div>
              <Block className="h-3 w-8" />
            </div>
          ))}
        </div>
      </Card>

      {/* Recent users */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Block className="h-4 w-24" />
          <Block className="h-3 w-12" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Block className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Block className="h-3 w-24" />
                <Block className="h-2.5 w-32" />
              </div>
              <Block className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Card>

      {/* Alerts */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Block className="h-4 w-16" />
          <Block className="h-3 w-12" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5">
              <Block className="w-3 h-3 rounded-full mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Block className="h-3 w-32" />
                <Block className="h-2.5 w-48" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Block className="h-4 w-20" />
          <Block className="h-3 w-12" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Block className="w-4 h-4 rounded" />
              <Block className="h-3 flex-1" />
              <Block className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function AdminDashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      <div className="xl:col-span-3">
        <KpiStripSkeleton />
        <AnalyticsFunnelSkeleton />
        <FinanceSkeleton />
        <ComplianceSkeleton />
        <RecentPointsSkeleton />
      </div>
      <RightRailSkeleton />
    </div>
  );
}
