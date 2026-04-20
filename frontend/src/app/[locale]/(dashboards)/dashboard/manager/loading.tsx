import { Skeleton } from "@/components/ui/skeleton";

export default function ManagerDashboardLoading() {
  return (
    <div className="bg-[#F9FAFB] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar placeholder */}
          <div className="hidden lg:block lg:w-[260px] lg:flex-shrink-0">
            <Skeleton className="h-[520px] w-full rounded-xl" />
          </div>

          <div className="flex-1 min-w-0">
            <Skeleton className="h-8 w-56 mb-6" />

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
              ))}
            </div>

            {/* Reviews overview widget */}
            <Skeleton className="h-[240px] w-full rounded-xl mb-6" />

            {/* Catalog overview widget */}
            <Skeleton className="h-[320px] w-full rounded-xl mb-6" />

            {/* Content review queue */}
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>

          <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
            <Skeleton className="h-[260px] w-full rounded-xl" />
            <Skeleton className="h-[220px] w-full rounded-xl" />
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
