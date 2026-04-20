import { Skeleton } from "@/components/ui/skeleton";

export default function CourseDetailLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-white overflow-x-hidden">
      {/* Desktop */}
      <div className="hidden lg:block">
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            {/* Back link */}
            <Skeleton className="h-4 w-24 mb-6" />

            {/* Hero: title + image */}
            <div className="grid grid-cols-12 gap-12 mb-12">
              <div className="col-span-7 space-y-5">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-4/5" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <div className="flex gap-6 pt-3">
                  <Skeleton className="h-14 w-40 rounded-xl" />
                  <Skeleton className="h-14 w-40 rounded-xl" />
                </div>
              </div>
              <div className="col-span-5">
                <Skeleton className="h-[360px] w-full rounded-2xl" />
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-4 gap-6 mb-12">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
              ))}
            </div>

            {/* Content + sidebar */}
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8 space-y-10">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-[95%]" />
                    <Skeleton className="h-5 w-[90%]" />
                  </div>
                ))}
              </div>
              <aside className="col-span-4 space-y-4">
                <Skeleton className="h-[320px] w-full rounded-2xl" />
              </aside>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile */}
      <div className="lg:hidden pb-24">
        <section className="px-4 py-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-[90%]" />
          <Skeleton className="h-8 w-[70%]" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[95%]" />
            <Skeleton className="h-4 w-[88%]" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
        </section>
      </div>
    </main>
  );
}
