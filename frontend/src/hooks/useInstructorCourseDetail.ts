"use client";

import { useState, useEffect, useCallback } from "react";
import { instructorApi } from "@/lib/api";
import type {
  CourseDetailResponse,
  CourseEnrollment,
  CourseSession,
} from "@/types/instructor-dashboard";

interface UseInstructorCourseDetailReturn {
  course: CourseDetailResponse | null;
  enrollments: CourseEnrollment[];
  sessions: CourseSession[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInstructorCourseDetail(
  courseId: string
): UseInstructorCourseDetailReturn {
  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      const [courseResult, enrollmentResult, sessionsResult] =
        await Promise.all([
          instructorApi.getCourseDetail(courseId),
          instructorApi.getCourseEnrollments(courseId).catch(() => [] as CourseEnrollment[]),
          instructorApi.getCourseSessions(courseId).catch(() => ({ data: [] as CourseSession[] })),
        ]);

      if (!cancelled) {
        setCourse(courseResult);
        setEnrollments(enrollmentResult);
        setSessions(sessionsResult.data);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Failed to load course"
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    course,
    enrollments,
    sessions,
    loading,
    error,
    refetch: fetchData,
  };
}
