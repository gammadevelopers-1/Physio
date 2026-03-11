"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { instructorApi } from "@/lib/api";
import type {
  InstructorCourse,
  InstructorCoursesParams,
} from "@/types/instructor-dashboard";

interface UseInstructorCoursesReturn {
  courses: InstructorCourse[];
  total: number;
  totalPages: number;
  page: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInstructorCourses(
  params: InstructorCoursesParams
): UseInstructorCoursesReturn {
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced search value (300ms)
  const [debouncedSearch, setDebouncedSearch] = useState(params.search || "");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(params.search || "");
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [params.search]);

  const fetchCourses = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    try {
      const result = await instructorApi.getCourses({
        status: params.status,
        delivery: params.delivery,
        search: debouncedSearch || undefined,
        sort: params.sort,
        page: params.page,
        limit: params.limit || 20,
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
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    params.status,
    params.delivery,
    debouncedSearch,
    params.sort,
    params.page,
    params.limit,
  ]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Refetch when tab becomes visible (e.g. after enrolling students in another tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchCourses();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchCourses]);

  // Poll every 60s to keep data fresh
  useEffect(() => {
    const interval = setInterval(fetchCourses, 60_000);
    return () => clearInterval(interval);
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
