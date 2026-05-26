"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { nelcComplianceApi } from "@/lib/api";

interface CourseCompliance {
  courseId: string;
  courseTitle: string;
  deliveryType?: string | null;
  instructorName: string;
  overallStatus: "passed" | "review" | "failed";
  overallScore?: number;
  summary: { passed: number; review: number; failed: number; total: number };
}

export function useNELCCompliance() {
  const [courses, setCourses] = useState<CourseCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCompliance = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const data = await nelcComplianceApi.getAllCoursesCompliance();
      if (!controller.signal.aborted) {
        setCourses(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Failed to load compliance data");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCompliance();
    return () => abortRef.current?.abort();
  }, [fetchCompliance]);

  const totals = courses.reduce(
    (acc, c) => ({
      passed: acc.passed + (c.overallStatus === "passed" ? 1 : 0),
      review: acc.review + (c.overallStatus === "review" ? 1 : 0),
      failed: acc.failed + (c.overallStatus === "failed" ? 1 : 0),
      total: acc.total + 1,
    }),
    { passed: 0, review: 0, failed: 0, total: 0 }
  );

  const overallPercentage =
    courses.length > 0
      ? Math.round(courses.reduce((sum, c) => sum + (c.overallScore || 0), 0) / courses.length)
      : 0;

  return { courses, totals, overallPercentage, loading, error, refetch: fetchCompliance };
}
