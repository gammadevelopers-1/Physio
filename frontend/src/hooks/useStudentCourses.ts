"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { studentApi } from "@/lib/api";
import type {
  StudentEnrolledCourse,
} from "@/types/student-dashboard";

interface UseStudentCoursesParams {
  status?: string;
  search?: string;
  delivery?: string;
  page?: number;
  limit?: number;
  sort?: string;
  /** When true, calling loadMore() appends additional pages instead of replacing data. */
  paginated?: boolean;
}

export function useStudentCourses(params?: UseStudentCoursesParams) {
  const [data, setData] = useState<StudentEnrolledCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(params?.page ?? 1);

  // Reset page to 1 whenever filters change so we don't append across filter changes.
  const filterKey = `${params?.status ?? ""}|${params?.search ?? ""}|${params?.delivery ?? ""}|${params?.sort ?? ""}|${params?.limit ?? ""}`;
  const lastFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKeyRef.current !== filterKey) {
      lastFilterKeyRef.current = filterKey;
      setPage(1);
      setData([]);
    }
  }, [filterKey]);

  const fetchPage = useCallback(
    async (pageToFetch: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await studentApi.getCourses({ ...params, page: pageToFetch });
        setData((prev) => (append ? [...prev, ...result.data] : result.data));
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load courses");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  useEffect(() => {
    fetchPage(page, page > 1 && !!params?.paginated);
  }, [page, fetchPage, params?.paginated]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    setPage((p) => p + 1);
  }, [loadingMore, page, totalPages]);

  /** Jump to a specific page (used by page-numbered pagination). */
  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, newPage));
  }, []);

  const refetch = useCallback(() => {
    setPage(1);
    fetchPage(1, false);
  }, [fetchPage]);

  return {
    data,
    total,
    totalPages,
    page,
    loading,
    loadingMore,
    hasMore: page < totalPages,
    error,
    loadMore,
    goToPage,
    refetch,
  };
}
