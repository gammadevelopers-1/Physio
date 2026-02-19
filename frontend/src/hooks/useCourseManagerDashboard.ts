"use client";

import { useState, useEffect, useCallback } from "react";
import { courseManagerApi } from "@/lib/api";
import type { InstructorListItem } from "@/lib/api";
import type {
  DashboardSummaryResponse,
  InstructorCourse,
} from "@/types/instructor-dashboard";

interface UseCourseManagerDashboardReturn {
  summary: DashboardSummaryResponse | null;
  courses: InstructorCourse[];
  instructors: InstructorListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  silentRefetch: () => void;
}

export function useCourseManagerDashboard(): UseCourseManagerDashboardReturn {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [instructors, setInstructors] = useState<InstructorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const [summaryResult, coursesResult, instructorsResult] =
        await Promise.all([
          courseManagerApi.getDashboardSummary(),
          courseManagerApi.getCourses({ limit: 100 }),
          courseManagerApi.getInstructors(),
        ]);

      setSummary(summaryResult);
      setCourses(coursesResult.data);
      setInstructors(instructorsResult);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data"
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const silentRefetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    summary,
    courses,
    instructors,
    loading,
    error,
    refetch: () => fetchData(),
    silentRefetch,
  };
}
