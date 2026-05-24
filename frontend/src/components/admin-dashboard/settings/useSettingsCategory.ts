"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { adminSettingsApi, type SettingsCategory } from "@/lib/api";

/**
 * Shared hook every settings tab uses to:
 *   1. Fetch its category's JSONB value on mount.
 *   2. Track a local draft + dirty flag as the user edits.
 *   3. Save the draft back, with toast + busy state.
 *
 * Each tab keeps its own state in isolation — no global form context.
 * Keeps tab swaps cheap and makes individual tabs self-contained.
 */
export function useSettingsCategory<T extends Record<string, unknown>>(
  category: SettingsCategory,
  fallback: T,
  toasts: { saved: string; saveFailed: string; loadFailed: string },
) {
  const [draft, setDraft] = useState<T>(fallback);
  const [serverValue, setServerValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminSettingsApi.getCategory<T>(category);
      const merged = { ...fallback, ...res.value };
      setDraft(merged);
      setServerValue(merged);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : toasts.loadFailed);
    } finally {
      setLoading(false);
    }
    // fallback / toasts intentionally not in deps — they're stable refs
    // from each call site and would cause infinite refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await adminSettingsApi.updateCategory<T>(category, draft);
      const merged = { ...fallback, ...res.value };
      setServerValue(merged);
      setDraft(merged);
      toast.success(toasts.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : toasts.saveFailed);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, draft]);

  // Cheap dirty check via JSON round-trip — settings blobs are small
  // (single-digit KB) so this is fine and avoids importing a deep-eq lib.
  const dirty = JSON.stringify(draft) !== JSON.stringify(serverValue);

  return {
    draft,
    setDraft,
    serverValue,
    loading,
    saving,
    loadError,
    dirty,
    save,
    refetch: fetchSettings,
  };
}
