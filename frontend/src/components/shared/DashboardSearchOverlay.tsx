"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Search,
  X,
  Loader2,
  GraduationCap,
  BookOpen,
  Users,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { courses } from "@/data/courses";
import { searchBlogs } from "@/lib/strapi/api";
import { adminApi } from "@/lib/api";
import type { Course } from "@/data/courses";
import type { StrapiBlogPost } from "@/lib/strapi/types";

type DashboardRole =
  | "student"
  | "instructor"
  | "admin"
  | "manager"
  | "finance"
  | "support";

interface DashboardSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  role: DashboardRole;
}

interface UserResult {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  activeRole?: string | null;
}

export default function DashboardSearchOverlay({
  isOpen,
  onClose,
  role,
}: DashboardSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [courseResults, setCourseResults] = useState<Course[]>([]);
  const [blogResults, setBlogResults] = useState<StrapiBlogPost[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("dashboardSearch");
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setCourseResults([]);
      setBlogResults([]);
      setUserResults([]);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setCourseResults([]);
        setBlogResults([]);
        setUserResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const searchLower = trimmed.toLowerCase();

      // Client-side course search (instant)
      const matchedCourses = courses
        .filter(
          (c) =>
            c.title.toLowerCase().includes(searchLower) ||
            c.description.toLowerCase().includes(searchLower) ||
            c.category.toLowerCase().includes(searchLower) ||
            c.type.toLowerCase().includes(searchLower)
        )
        .slice(0, 5);
      setCourseResults(matchedCourses);

      // Async searches in parallel
      const promises: Promise<void>[] = [];

      // Blog search (all roles)
      promises.push(
        searchBlogs(trimmed, locale)
          .then((blogs) => setBlogResults((blogs || []).slice(0, 5)))
          .catch(() => setBlogResults([]))
      );

      // User search (admin only)
      if (role === "admin") {
        promises.push(
          adminApi
            .getUsers({ search: trimmed, limit: 5 })
            .then((result) => setUserResults(result.data || []))
            .catch(() => setUserResults([]))
        );
      }

      await Promise.allSettled(promises);
      setIsSearching(false);
    },
    [locale, role]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setCourseResults([]);
      setBlogResults([]);
      setUserResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const totalResults =
    courseResults.length + blogResults.length + userResults.length;
  const hasQuery = query.trim().length > 0;

  // Quick links based on role
  const getQuickLinks = () => {
    const base = `/${locale}/dashboard`;
    switch (role) {
      case "student":
        return [
          { label: t("quickLinks.myCourses"), href: `${base}/student/courses` },
          {
            label: t("quickLinks.browseCourses"),
            href: `/${locale}/courses`,
          },
          {
            label: t("quickLinks.certifications"),
            href: `${base}/student/certifications`,
          },
          {
            label: t("quickLinks.settings"),
            href: `${base}/student/settings`,
          },
        ];
      case "instructor":
        return [
          {
            label: t("quickLinks.myCourses"),
            href: `${base}/instructor/courses`,
          },
          {
            label: t("quickLinks.students"),
            href: `${base}/instructor/students`,
          },
          {
            label: t("quickLinks.settings"),
            href: `${base}/instructor/settings`,
          },
        ];
      case "admin":
        return [
          { label: t("quickLinks.users"), href: `${base}/admin/users` },
          { label: t("quickLinks.roles"), href: `${base}/admin/roles` },
          { label: t("quickLinks.courses"), href: `${base}/admin/courses` },
          {
            label: t("quickLinks.settings"),
            href: `${base}/admin/settings`,
          },
        ];
      case "manager":
        return [
          { label: t("quickLinks.courses"), href: `${base}/manager/courses` },
          {
            label: t("quickLinks.instructors"),
            href: `${base}/manager/instructors`,
          },
          {
            label: t("quickLinks.settings"),
            href: `${base}/manager/settings`,
          },
        ];
      case "finance":
        return [
          {
            label: t("quickLinks.invoices"),
            href: `${base}/finance/invoices`,
          },
          {
            label: t("quickLinks.payments"),
            href: `${base}/finance/payments`,
          },
          {
            label: t("quickLinks.settings"),
            href: `${base}/finance/settings`,
          },
        ];
      case "support":
        return [
          { label: t("quickLinks.tickets"), href: `${base}/support/tickets` },
          {
            label: t("quickLinks.settings"),
            href: `${base}/support/settings`,
          },
        ];
    }
  };

  const quickLinks = getQuickLinks();

  const getUserDisplayName = (user: UserResult) => {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : user.email;
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center pt-[12vh] sm:pt-[15vh]"
      onClick={onClose}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[65vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-[#E5E7EB] px-4 flex-shrink-0">
          <Search className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="flex-1 h-14 px-3 text-base text-[#1F2937] placeholder:text-[#9CA3AF] outline-none bg-transparent"
          />
          {isSearching && (
            <Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF] flex-shrink-0 mx-1" />
          )}
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1.5 hover:bg-[#F3F4F6] rounded-md flex-shrink-0"
            >
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-3">
          {/* Quick Links (when no query) */}
          {!hasQuery && (
            <div>
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-2">
                {t("quickLinks.title")}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {quickLinks.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => handleNavigate(link.href)}
                    className="text-start px-3 py-2.5 rounded-lg text-sm text-[#4B5563] hover:bg-[#F3F4F6] transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              {/* Hint */}
              <p className="text-xs text-[#9CA3AF] px-2 mt-4">
                {t("hint")}
              </p>
            </div>
          )}

          {/* No results */}
          {hasQuery && !isSearching && totalResults === 0 && (
            <div className="text-center py-10">
              <Search className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-sm text-[#6B7280]">{t("noResults")}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">{t("noResultsHint")}</p>
            </div>
          )}

          {/* Course Results */}
          {courseResults.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                {t("sections.courses")} ({courseResults.length})
              </p>
              {courseResults.map((course) => (
                <button
                  key={course.id}
                  onClick={() =>
                    handleNavigate(`/${locale}/courses/${course.slug}`)
                  }
                  className="w-full text-start px-3 py-2.5 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between group transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1F2937] truncate">
                      {course.title}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {course.type} &middot; {course.hours}
                    </p>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#6B7280] flex-shrink-0 ms-2" />
                </button>
              ))}
            </div>
          )}

          {/* Blog Results */}
          {blogResults.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {t("sections.blogs")} ({blogResults.length})
              </p>
              {blogResults.map((blog) => (
                <button
                  key={blog.documentId}
                  onClick={() =>
                    handleNavigate(`/${locale}/blogs/${blog.slug}`)
                  }
                  className="w-full text-start px-3 py-2.5 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between group transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1F2937] truncate">
                      {blog.title}
                    </p>
                    <p className="text-xs text-[#6B7280] truncate">
                      {blog.excerpt}
                    </p>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#6B7280] flex-shrink-0 ms-2" />
                </button>
              ))}
            </div>
          )}

          {/* User Results (admin only) */}
          {userResults.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {t("sections.users")} ({userResults.length})
              </p>
              {userResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() =>
                    handleNavigate(`/${locale}/dashboard/admin/users`)
                  }
                  className="w-full text-start px-3 py-2.5 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-[#002D87] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-white">
                        {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1F2937] truncate">
                        {getUserDisplayName(user)}
                      </p>
                      <p className="text-xs text-[#6B7280] truncate">
                        {user.email}
                        {user.activeRole && (
                          <span className="ms-1.5 text-[#9CA3AF]">
                            &middot; {user.activeRole}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#6B7280] flex-shrink-0 ms-2" />
                </button>
              ))}
            </div>
          )}

          {/* View all results link */}
          {hasQuery && totalResults > 0 && (
            <button
              onClick={() =>
                handleNavigate(
                  `/${locale}/search?q=${encodeURIComponent(query.trim())}`
                )
              }
              className="w-full text-center py-3 text-sm text-[#002D87] hover:text-[#001A52] font-medium transition-colors"
            >
              {t("viewAll")}
            </button>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between text-xs text-[#9CA3AF] flex-shrink-0">
          <span>{t("escToClose")}</span>
        </div>
      </div>
    </div>
  );
}
