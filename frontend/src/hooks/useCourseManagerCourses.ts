"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { courseManagerApi } from "@/lib/api";
import type {
  InstructorCourse,
  InstructorCoursesParams,
} from "@/types/instructor-dashboard";

interface UseCourseManagerCoursesReturn {
  courses: InstructorCourse[];
  total: number;
  totalPages: number;
  page: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCourseManagerCourses(
  params: InstructorCoursesParams
): UseCourseManagerCoursesReturn {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState(params.search || "");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(params.search || "");
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [params.search]);

  const fetchCourses = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      const result = await courseManagerApi.getCourses({
        ...params,
        search: debouncedSearch,
      });
      if (!cancelled) {
        setCourses(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Failed to load courses"
        );
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    params.status,
    params.delivery,
    params.sort,
    params.page,
    params.limit,
    debouncedSearch,
  ]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    total,
    totalPages,
    page,
    loading,
    error,
    refetch: fetchCourses,
  };
}
