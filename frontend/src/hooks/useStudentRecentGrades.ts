"use client";

import { useEffect, useState, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { RecentGrade } from "@/types/student-dashboard";

export function useStudentRecentGrades(limit = 5) {
  const [data, setData] = useState<RecentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getRecentGrades(limit);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grades");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
