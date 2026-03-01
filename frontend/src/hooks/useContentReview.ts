"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { courseManagerApi } from "@/lib/api";

interface PendingReviewItem {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  type: string;
  status: string;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  wcagStatus: string;
  wcagDetails: string | null;
  reviewNote: string | null;
  createdAt: string;
  courseTitle: string;
  instructorFirstName: string | null;
  instructorLastName: string | null;
  instructorEmail: string;
}

interface ReviewStats {
  pending: number;
  changesRequested: number;
  approved: number;
  rejected: number;
}

interface ComplianceCheck {
  rule: string;
  status: "passed" | "review" | "failed";
  detail: string;
}

interface ComplianceChecklist {
  materialId: string;
  courseId: string;
  overallStatus: "passed" | "review" | "failed";
  passedCount: number;
  totalChecks: number;
  checks: ComplianceCheck[];
}

export function useContentReview() {
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    pending: 0,
    changesRequested: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<Record<string, ComplianceChecklist>>({});
  const [checklistLoading, setChecklistLoading] = useState<Record<string, boolean>>({});
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

  const fetchChecklist = useCallback(async (materialId: string) => {
    if (checklists[materialId]) return; // Already fetched
    setChecklistLoading((prev) => ({ ...prev, [materialId]: true }));
    try {
      const result = await courseManagerApi.getComplianceChecklist(materialId);
      setChecklists((prev) => ({ ...prev, [materialId]: result }));
    } catch {
      // silently fail — checklist is supplementary
    } finally {
      setChecklistLoading((prev) => ({ ...prev, [materialId]: false }));
    }
  }, [checklists]);

  const approve = useCallback(async (id: string) => {
    await courseManagerApi.reviewMaterial(id, { decision: "approved" });
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

  const requestChanges = useCallback(async (id: string, comment: string) => {
    await courseManagerApi.reviewMaterial(id, { decision: "changes_requested", comment });
    setItems((prev) => prev.filter((item) => item.id !== id));
    setStats((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      changesRequested: prev.changesRequested + 1,
    }));
  }, []);

  const bulkApprove = useCallback(async (ids: string[]) => {
    const result = await courseManagerApi.bulkReviewMaterials(ids, "approved");
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    setStats((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - result.succeeded),
      approved: prev.approved + result.succeeded,
    }));
    return result;
  }, []);

  const bulkReject = useCallback(async (ids: string[], comment: string) => {
    const result = await courseManagerApi.bulkReviewMaterials(ids, "rejected", comment);
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    setStats((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - result.succeeded),
      rejected: prev.rejected + result.succeeded,
    }));
    return result;
  }, []);

  useEffect(() => {
    fetchReviews();
    return () => abortRef.current?.abort();
  }, [fetchReviews]);

  return {
    items,
    stats,
    loading,
    error,
    checklists,
    checklistLoading,
    refetch: fetchReviews,
    fetchChecklist,
    approve,
    reject,
    requestChanges,
    bulkApprove,
    bulkReject,
  };
}
