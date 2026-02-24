"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { StudentCourseDetail } from "@/types/student-dashboard";

export function useStudentCourseDetail(courseId: string) {
  const [data, setData] = useState<StudentCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getCourseDetail(courseId);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load course detail"
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}
