"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { CalendarEvent } from "@/types/student-dashboard";

interface UseStudentCalendarParams {
  from?: string;
  to?: string;
}

export function useStudentCalendar(params?: UseStudentCalendarParams) {
  const [data, setData] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getCalendar(params);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load calendar"
      );
    } finally {
      setLoading(false);
    }
  }, [params?.from, params?.to]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  return { data, loading, error, refetch: fetchCalendar };
}
