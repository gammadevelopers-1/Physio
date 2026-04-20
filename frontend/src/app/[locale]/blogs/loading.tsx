import { Skeleton } from "@/components/ui/skeleton";

export default function BlogsLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-white overflow-x-hidden">
      {/* Desktop */}
      <div className="hidden lg:block">
        {/* Featured */}
        <section className="px-16 pt-8 pb-12">
          <div className="max-w-[1200px] mx-auto">
            <Skeleton className="h-12 w-[360px] mb-2" />
            <Skeleton className="h-6 w-[480px] mb-8" />
            <div className="grid grid-cols-2 gap-8 bg-[#F4F4F5] rounded-2xl p-6">
              <Skeleton className="h-[300px] w-full rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-10 w-36 rounded-lg mt-4" />
              </div>
            </div>
          </div>
        </section>

        {/* Listing */}
        <section className="px-16 py-12 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <Skeleton className="h-12 w-[240px] mb-2" />
            <Skeleton className="h-6 w-[420px] mb-6" />
            <div className="flex gap-2 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-[180px] w-full rounded-xl" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Mobile */}
      <div className="lg:hidden pb-24">
        <section className="px-4 pt-6 pb-8">
          <Skeleton className="h-7 w-40 mb-1" />
          <Skeleton className="h-4 w-56 mb-6" />
          <Skeleton className="h-[220px] w-full rounded-xl mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </section>
        <section className="px-4 py-6 bg-white">
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-[160px] w-full rounded-xl" />
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
