"use client";

import { useState, useEffect } from "react";
import { instructorApi } from "@/lib/api";
import type { CourseEnrollment } from "@/types/instructor-dashboard";

export function useCoursePerformance(courseId: string | null) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setEnrollments([]);
      return;
    }

    let cancelled = false;

    const fetchEnrollments = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await instructorApi.getCourseEnrollments(courseId);
        if (!cancelled) {
          setEnrollments(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load course enrollments"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchEnrollments();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return { enrollments, loading, error };
}
