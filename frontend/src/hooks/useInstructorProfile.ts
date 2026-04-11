import { useMemo } from "react";
import { useLocale } from "next-intl";
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
 * Uses Arabic name fields when locale is "ar" and they are available.
 * Used by all instructor dashboard pages for Navbar, Sidebar, and MobileSidebar.
 */
export function useInstructorProfile(): InstructorProfile {
  const user = useUser();
  const locale = useLocale();

  return useMemo(
    () => {
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
      return {
        name,
        email: user?.email || "",
        rating: 0,
        courseCompletion: 0,
        avatar: user?.avatar || undefined,
      };
    },
    [user, locale],
  );
}
