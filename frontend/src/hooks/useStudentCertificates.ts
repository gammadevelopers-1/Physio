"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { StudentCertificate } from "@/types/student-dashboard";

export function useStudentCertificates() {
  const [data, setData] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getCertificates();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load certificates"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  return { data, loading, error, refetch: fetchCertificates };
}
