"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search, Trash2, Loader2, X } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import EmptyStateIllustration from "./EmptyStateIllustration";
import CourseCard from "@/components/courses/CourseCard";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { publicApi } from "@/lib/api";
import type { PublicCourse } from "@/types/instructor-dashboard";

const FavouritesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { favourites, removeFavourite } = useFavourites();
  const userData = useStudentProfile();

  const [search, setSearch] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [publicCourses, setPublicCourses] = useState<PublicCourse[] | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Fetch public course data so we can render the SAME CourseCard the
  // /courses listing uses. Favourites only persist a thin snapshot in
  // localStorage; the rich fields (instructor, rating, dates, …) live
  // on the public API.
  useEffect(() => {
    if (favourites.length === 0) {
      setPublicCourses([]);
      setLoadingCourses(false);
      return;
    }
    let cancelled = false;
    setLoadingCourses(true);
    publicApi
      .getCourses({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setPublicCourses(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setPublicCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when favourites count changes so newly added items get enriched
  }, [favourites.length]);

  // Resolve each favourite to its full PublicCourse where available.
  // If a favourited course was unpublished/deleted, we still surface a
  // tombstone tile with a remove button instead of silently dropping it.
  const resolved = useMemo(() => {
    return favourites.map((fav) => {
      const enriched =
        publicCourses?.find((c) => c.id === fav.id) ?? null;
      return { fav, enriched };
    });
  }, [favourites, publicCourses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter(({ fav, enriched }) => {
      const title = enriched?.title || fav.title;
      const titleAr = enriched?.titleAr;
      return (
        title.toLowerCase().includes(q) ||
        (titleAr && titleAr.toLowerCase().includes(q))
      );
    });
  }, [resolved, search]);

  const handleClearAll = () => {
    favourites.forEach((c) => removeFavourite(c.id));
    setConfirmClearAll(false);
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>
            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0 space-y-4">
              {/* Page header — title + subtitle + count (matches My Courses) */}
              <div className={`flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div>
                  <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      {t("favourites.title")}
                    </h1>
                    {favourites.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
                        {favourites.length}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("favourites.subtitle")}
                  </p>
                </div>
                {favourites.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs sm:text-sm font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("favourites.clearAll")}</span>
                  </button>
                )}
              </div>

              <OfflineBanner />

              {/* Search bar — only show when there are favorites */}
              {favourites.length > 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
                  <div className="relative">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("favourites.searchPlaceholder")}
                      className={`w-full py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {favourites.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
                    <EmptyStateIllustration variant="courses" className="mb-3" />
                    <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">
                      {t("favourites.noFavouritesTitle")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4 max-w-sm">
                      {t("favourites.noFavouritesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 btn-gold text-[var(--color-button-text)] text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {t("favourites.viewCourses")}
                    </Link>
                  </div>
                ) : loadingCourses ? (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <p className="text-sm">{t("favourites.loading")}</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Search className="w-10 h-10 text-[var(--color-border)] mb-2" />
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                      {t("favourites.noResults", { query: search.trim() })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {t("favourites.clearSearch")}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {filtered.map(({ fav, enriched }) =>
                      enriched ? (
                        <CourseCard
                          key={fav.id}
                          course={enriched}
                          isRTL={isRTL}
                        />
                      ) : (
                        // Tombstone for favourites whose course is no longer
                        // published — keep the card but make it removable.
                        <div
                          key={fav.id}
                          className="flex flex-col w-full h-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm relative"
                        >
                          <button
                            type="button"
                            onClick={() => removeFavourite(fav.id)}
                            aria-label={t("favourites.removeFromFavourites")}
                            className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} w-8 h-8 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:bg-red-50 z-10 cursor-pointer`}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </button>
                          <div className="w-full aspect-[16/9] bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
                            {t("favourites.unavailableThumbnail")}
                          </div>
                          <div className="p-4 flex-1 flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
                              {fav.title}
                            </h3>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("favourites.unavailableDescription")}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear All Confirmation */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("favourites.clearAllConfirmTitle")}
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {t("favourites.clearAllConfirmMessage", { count: favourites.length })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                >
                  {t("courseDetail.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {t("favourites.clearAll")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FavouritesContent;
