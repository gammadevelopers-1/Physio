"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/contexts";
import { courseManagerApi } from "@/lib/api";

export interface ManagerProfile {
  name: string;
  email: string;
  totalCourses: number;
  totalInstructors: number;
  nelcCompliance: number;
  avatar?: string;
}

export function useManagerProfile(): ManagerProfile {
  const user = useUser();
  const [totalCourses, setTotalCourses] = useState(0);
  const [totalInstructors, setTotalInstructors] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      courseManagerApi.getCourses({ limit: 1 }),
      courseManagerApi.getInstructors(),
    ])
      .then(([coursesResult, instructorsResult]) => {
        if (!cancelled) {
          setTotalCourses(coursesResult.total);
          setTotalInstructors(instructorsResult.length);
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
        ? `${user.firstName || ""}${user.lastName ? " " + user.lastName : ""}`.trim() || user.email
        : "",
      email: user?.email || "",
      totalCourses,
      totalInstructors,
      nelcCompliance: 0,
      avatar: user?.avatar || undefined,
    }),
    [user, totalCourses, totalInstructors]
  );
}
