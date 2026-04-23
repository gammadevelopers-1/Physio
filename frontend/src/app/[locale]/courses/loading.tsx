import { Skeleton } from "@/components/ui/skeleton";

export default function CoursesLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] overflow-x-hidden">
      {/* Desktop */}
      <div className="hidden lg:block">
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-8">
              <Skeleton className="h-12 w-[280px] mb-2" />
              <Skeleton className="h-6 w-[480px]" />
            </div>

            <div className="flex gap-8">
              {/* Sidebar */}
              <div className="bg-[var(--color-surface-page)] rounded-xl p-5 w-[240px] flex-shrink-0 space-y-6">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex-1 grid grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-[200px] w-full rounded-2xl" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile */}
      <div className="lg:hidden pb-24">
        <section className="px-4 py-6">
          <Skeleton className="h-7 w-40 mb-1" />
          <Skeleton className="h-4 w-56 mb-4" />
          <Skeleton className="h-[80px] w-full rounded-xl mb-6" />
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-[180px] w-full rounded-xl" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
