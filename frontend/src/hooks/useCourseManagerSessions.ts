"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { courseManagerApi } from "@/lib/api";
import type { CourseSession } from "@/types/instructor-dashboard";

interface SessionsParams {
  dateRange?: string;
  status?: string;
  courseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface UseCourseManagerSessionsReturn {
  sessions: CourseSession[];
  total: number;
  totalPages: number;
  page: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCourseManagerSessions(
  params: SessionsParams
): UseCourseManagerSessionsReturn {
  const [sessions, setSessions] = useState<CourseSession[]>([]);
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

  const fetchSessions = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      const result = await courseManagerApi.getSessions({
        dateRange: params.dateRange,
        status: params.status,
        courseId: params.courseId,
        page: params.page,
        limit: params.limit,
      });

      if (!cancelled) {
        setSessions(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Failed to load sessions"
        );
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [
    params.dateRange,
    params.status,
    params.courseId,
    params.page,
    params.limit,
    debouncedSearch,
  ]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    total,
    totalPages,
    page,
    loading,
    error,
    refetch: fetchSessions,
  };
}
