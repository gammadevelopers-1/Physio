import { useMemo } from "react";
import { useUser } from "@/contexts";

export interface StudentProfile {
  name: string;
  email: string;
  points: number;
  profileCompletion: number;
  avatar?: string;
}

/**
 * Derives the student profile from the authenticated user.
 * Used by all student dashboard pages for Navbar, Sidebar, and MobileSidebar.
 */
export function useStudentProfile(): StudentProfile {
  const user = useUser();

  return useMemo(() => {
    // Calculate profile completion based on filled fields
    let filled = 0;
    if (user?.firstName) filled++;
    if (user?.lastName) filled++;
    if (user?.phone) filled++;
    if (user?.avatar) filled++;
    if (user?.department) filled++;
    const profileCompletion = Math.round((filled / 5) * 100);

    return {
      name: user
        ? `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email
        : "",
      email: user?.email || "",
      points: 0,
      profileCompletion,
      avatar: user?.avatar || undefined,
    };
  }, [user]);
}
