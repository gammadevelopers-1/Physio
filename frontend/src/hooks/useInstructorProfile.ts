import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useUser } from "@/contexts";
import { instructorApi } from "@/lib/api";

export interface InstructorProfile {
  name: string;
  email: string;
  rating: number;
  totalReviews: number;
  /** % of instructor-editable profile fields populated. 0-100. */
  profileCompletion: number;
  avatar?: string;
}

/**
 * Derives the instructor profile from the authenticated user.
 * Uses Arabic name fields when locale is "ar" and they are available.
 * Used by all instructor dashboard pages for Navbar, Sidebar, and MobileSidebar.
 *
 * Live `rating` is fetched from /instructor/me/reviews (approved + published
 * reviews of THIS instructor across all their courses). Each page mount
 * re-fetches; consumers see whichever rating was current when their page
 * mounted (good enough for the sidebar — dashboard widgets do their own fetches).
 */
export function useInstructorProfile(): InstructorProfile {
  const user = useUser();
  const locale = useLocale();
  const [rating, setRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    instructorApi
      .getMyReviews(1)
      .then((res) => {
        if (cancelled) return;
        setRating(res.avgRating);
        setTotalReviews(res.totalRatings);
      })
      .catch(() => {
        // Silent — sidebar should still render with 0 if API hiccups
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return useMemo(() => {
    let name = "";
    if (user) {
      if (locale === "ar" && ((user as any).firstNameAr || (user as any).lastNameAr)) {
        name = `${(user as any).firstNameAr || ""} ${(user as any).lastNameAr || ""}`.trim();
      }
      if (!name) {
        name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      }
      if (!name) {
        name = user.email;
      }
    }

    // Profile completion is computed against the instructor-editable fields
    // exposed in Settings → Profile. Personal info + professional info +
    // social handles. The Settings page seeds these from the trainer
    // application on approval, so most trainers should land at ≥70% on
    // first login — the bar nudges them to fill the rest (avatar, bio).
    const u = user as unknown as Record<string, string | null | undefined>;
    const checks = [
      u?.firstName,
      u?.lastName,
      u?.phone,
      u?.avatar,
      u?.bio,
      u?.profession,
      u?.specialty,
      u?.qualification,
      u?.twitter,
      u?.linkedin,
    ];
    const filled = checks.filter(Boolean).length;
    const profileCompletion = Math.round((filled / checks.length) * 100);

    return {
      name,
      email: user?.email || "",
      rating,
      totalReviews,
      profileCompletion,
      avatar: user?.avatar || undefined,
    };
  }, [user, locale, rating, totalReviews]);
}
