import { Skeleton } from "@/components/ui/skeleton";

export default function BlogDetailLoading() {
  return (
    <main id="main-content" className="min-h-screen bg-white overflow-x-hidden">
      {/* Desktop */}
      <div className="hidden lg:block">
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex gap-12">
              <div className="w-1/2 flex flex-col justify-between">
                <div className="space-y-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-28 rounded-md" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-3/4" />
                </div>
                <Skeleton className="h-4 w-48 mt-8" />
              </div>
              <div className="w-1/2">
                <Skeleton className="h-[320px] w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </section>

        <div className="mx-16 h-px bg-[#E5E7EB]" />

        <article className="max-w-[800px] mx-auto px-8 py-12 space-y-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-5 ${i % 3 === 0 ? "w-[95%]" : i % 3 === 1 ? "w-[88%]" : "w-full"}`}
            />
          ))}
        </article>
      </div>

      {/* Mobile */}
      <div className="lg:hidden pb-24">
        <section className="px-4 py-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </section>
        <article className="px-4 py-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </article>
      </div>
    </main>
  );
}
