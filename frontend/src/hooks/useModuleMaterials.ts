"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type { ModuleMaterial } from "@/types/student-dashboard";

export function useModuleMaterials(courseId: string, moduleId: string | null) {
  const [materials, setMaterials] = useState<ModuleMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    if (!courseId || !moduleId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await studentApi.getModuleMaterials(courseId, moduleId);
      setMaterials(result.materials);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load materials"
      );
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, moduleId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  return { materials, loading, error, refetch: fetchMaterials };
}
