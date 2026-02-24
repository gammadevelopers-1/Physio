"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { RecentActivityItem } from "@/types/student-dashboard";

interface UseStudentRecentActivityParams {
  limit?: number;
}

export function useStudentRecentActivity(
  params?: UseStudentRecentActivityParams,
) {
  const [data, setData] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getRecentActivity(params);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load recent activity",
      );
    } finally {
      setLoading(false);
    }
  }, [params?.limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { data, loading, error, refetch: fetchActivity };
}
