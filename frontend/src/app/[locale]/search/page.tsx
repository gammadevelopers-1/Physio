import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SearchPageContent } from "@/components/search";

export const metadata = {
  title: "Search | PhysioGuidance",
  description: "Search for courses, blogs, and more on PhysioGuidance",
};

function SearchPageFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[var(--surface-container-primary-2)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SearchPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] overflow-x-hidden">
      <Navbar />
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageContent />
      </Suspense>
      <Footer />
    </main>
  );
}
