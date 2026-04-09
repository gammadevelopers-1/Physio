"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale } from "next-intl";
import { useUser } from "@/contexts";
import { courseManagerApi } from "@/lib/api";

export interface ManagerProfile {
  name: string;
  email: string;
  totalCourses: number;
  totalInstructors: number;
  totalEnrollments: number;
  avatar?: string;
}

export function useManagerProfile(): ManagerProfile {
  const user = useUser();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [totalCourses, setTotalCourses] = useState(0);
  const [totalInstructors, setTotalInstructors] = useState(0);
  const [totalEnrollments, setTotalEnrollments] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      courseManagerApi.getCourses({ limit: 100 }),
      courseManagerApi.getInstructors(),
    ])
      .then(([coursesResult, instructorsResult]) => {
        if (!cancelled) {
          setTotalCourses(coursesResult.total);
          setTotalInstructors(instructorsResult.length);
          setTotalEnrollments(coursesResult.data.reduce((sum, c) => sum + c.enrolledCount, 0));
        }
      })
      .catch(() => {
        // Silently fail — sidebar will show 0
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      name: user
        ? (isRTL && (user.firstNameAr || user.lastNameAr)
            ? `${user.firstNameAr || ""}${user.lastNameAr ? " " + user.lastNameAr : ""}`.trim()
            : `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim()
          ) || user.email
        : "",
      email: user?.email || "",
      totalCourses,
      totalInstructors,
      totalEnrollments,
      avatar: user?.avatar || undefined,
    }),
    [user, totalCourses, totalInstructors, totalEnrollments, isRTL]
  );
}
