"use client";

import { useState, useEffect } from "react";
import { instructorApi } from "@/lib/api";
import type { AssessmentResponse } from "@/types/instructor-dashboard";

export function useAssessmentAnalysis(courseId: string | null) {
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setAssessments([]);
      return;
    }

    let cancelled = false;

    const fetchAssessments = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await instructorApi.getAssessments(courseId);
        if (!cancelled) {
          setAssessments(result.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load assessment data"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAssessments();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return { assessments, loading, error };
}
