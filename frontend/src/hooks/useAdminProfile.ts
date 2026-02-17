"use client";

import { useMemo } from "react";
import { useUser } from "@/contexts";

export interface AdminProfile {
  name: string;
  email: string;
  totalUsers: number;
  totalCourses: number;
  uptime: number;
  avatar?: string;
}

/**
 * Derives the admin profile from the authenticated user.
 * Used by all admin dashboard pages for Navbar, Sidebar, and MobileSidebar.
 */
export function useAdminProfile(): AdminProfile {
  const user = useUser();

  return useMemo(
    () => ({
      name: user
        ? `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email
        : "",
      email: user?.email || "",
      totalUsers: 0,
      totalCourses: 0,
      uptime: 99.9,
      avatar: user?.avatar || undefined,
    }),
    [user],
  );
}
