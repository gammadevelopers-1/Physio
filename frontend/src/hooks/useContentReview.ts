"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { courseManagerApi } from "@/lib/api";

interface PendingReviewItem {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  type: string;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  wcagStatus: string;
  createdAt: string;
  courseTitle: string;
  instructorFirstName: string | null;
  instructorLastName: string | null;
  instructorEmail: string;
}

interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
}

export function useContentReview() {
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchReviews = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const result = await courseManagerApi.getPendingReviews();
      if (!controller.signal.aborted) {
        setItems(result.data);
        setStats(result.stats);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Failed to load reviews");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const approve = useCallback(async (id: string) => {
    await courseManagerApi.reviewMaterial(id, { decision: "approved" });
    // Remove from local state immediately
    setItems((prev) => prev.filter((item) => item.id !== id));
    setStats((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      approved: prev.approved + 1,
    }));
  }, []);

  const reject = useCallback(async (id: string, comment?: string) => {
    await courseManagerApi.reviewMaterial(id, { decision: "rejected", comment });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setStats((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      rejected: prev.rejected + 1,
    }));
  }, []);

  useEffect(() => {
    fetchReviews();
    return () => abortRef.current?.abort();
  }, [fetchReviews]);

  return { items, stats, loading, error, refetch: fetchReviews, approve, reject };
}
