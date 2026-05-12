import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useUser } from "@/contexts";
import { pointsApi } from "@/lib/api";

export interface StudentProfile {
  name: string;
  email: string;
  points: number;
  profileCompletion: number;
  avatar?: string;
  scfhsNumber?: string;
}

/**
 * Derives the student profile from the authenticated user.
 * Used by all student dashboard pages for Navbar, Sidebar, and MobileSidebar.
 *
 * Locale-aware: prefers Arabic name fields when the active locale is `ar`
 * AND the user has populated firstNameAr/lastNameAr.
 *
 * Live `points` balance is fetched once per mount via /points/me/balance.
 * The hook is used on every student page so the balance refreshes on
 * navigation; consumers see whichever balance was current when their page
 * mounted (good enough for the sidebar / dashboard widget — the dedicated
 * MyPoints page does its own fetch).
 */
export function useStudentProfile(): StudentProfile {
  const user = useUser();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    pointsApi
      .getBalance()
      .then((res) => {
        if (!cancelled) setPoints(res.balance);
      })
      .catch(() => {
        // Silent — sidebar should still render with 0 if API hiccups
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return useMemo(() => {
    // Profile completion is computed against the student-editable fields
    // exposed in Settings → Profile (firstName, lastName, phone, avatar,
    // SCFHS number, gender, date of birth, biography). Arabic names are
    // intentionally not counted — they're optional for non-Arabic students.
    const checks = [
      user?.firstName,
      user?.lastName,
      user?.phone,
      user?.avatar,
      user?.scfhsNumber,
      user?.gender,
      user?.dateOfBirth,
      user?.bio,
    ];
    const filled = checks.filter(Boolean).length;
    const profileCompletion = Math.round((filled / checks.length) * 100);

    let displayName = "";
    if (user) {
      // In Arabic locale, prefer Arabic name if at least one part is populated
      if (isRTL && (user.firstNameAr || user.lastNameAr)) {
        displayName = `${user.firstNameAr || ""}${user.lastNameAr ? " " + user.lastNameAr : ""}`.trim();
      }
      // Fall back to English / email
      if (!displayName) {
        displayName = `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email;
      }
    }

    return {
      name: displayName,
      email: user?.email || "",
      points,
      profileCompletion,
      avatar: user?.avatar || undefined,
      scfhsNumber: user?.scfhsNumber || undefined,
    };
  }, [user, isRTL, points]);
}
