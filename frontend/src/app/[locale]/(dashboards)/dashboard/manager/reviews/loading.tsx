import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerReviewsLoading() {
  return (
    <div className="bg-[var(--color-surface-page)] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block lg:w-[260px] lg:flex-shrink-0">
            <Skeleton className="h-[520px] w-full rounded-xl" />
          </div>

          <div className="flex-1 min-w-0">
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-80 mb-6" />

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-lg" />
              ))}
            </div>

            {/* Filters row */}
            <div className="flex gap-3 mb-6">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 w-40 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>

            {/* Review cards */}
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Skeleton key={s} className="h-4 w-4 rounded-sm" />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-8 w-24 rounded-lg" />
                    <Skeleton className="h-8 w-24 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
