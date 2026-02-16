import { useMemo } from "react";
import { useUser } from "@/contexts";

export interface InstructorProfile {
  name: string;
  email: string;
  rating: number;
  courseCompletion: number;
  avatar?: string;
}

/**
 * Derives the instructor profile from the authenticated user.
 * Used by all instructor dashboard pages for Navbar, Sidebar, and MobileSidebar.
 */
export function useInstructorProfile(): InstructorProfile {
  const user = useUser();

  return useMemo(
    () => ({
      name: user
        ? `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email
        : "",
      email: user?.email || "",
      rating: 0,
      courseCompletion: 0,
      avatar: user?.avatar || undefined,
    }),
    [user],
  );
}
