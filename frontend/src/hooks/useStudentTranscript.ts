"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { StudentTranscript } from "@/types/student-dashboard";

export function useStudentTranscript() {
  const [data, setData] = useState<StudentTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getTranscript();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transcript"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  return { data, loading, error, refetch: fetchTranscript };
}
