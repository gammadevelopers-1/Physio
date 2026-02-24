"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type {
  StudentEnrolledCourse,
  StudentEnrolledCoursesResponse,
} from "@/types/student-dashboard";

interface UseStudentCoursesParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useStudentCourses(params?: UseStudentCoursesParams) {
  const [data, setData] = useState<StudentEnrolledCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getCourses(params);
      setData(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load courses"
      );
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.search, params?.page, params?.limit]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return { data, total, totalPages, loading, error, refetch: fetchCourses };
}
