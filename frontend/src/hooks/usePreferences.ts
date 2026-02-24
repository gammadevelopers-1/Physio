"use client";

import { useState, useEffect, useCallback } from "react";
import { preferencesApi } from "@/lib/api";

export interface UserPreferences {
  // UI
  theme: string;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  compactMode: boolean;
  showTips: boolean;

  // Language
  contentLanguage: string;
  calendarFormat: string;

  // Accessibility
  highContrast: boolean;
  fontSize: string;
  reduceMotion: boolean;
  captionsDefault: boolean;
  subtitlesLanguage: string;

  // Privacy
  profileVisibility: string;
  dataSharing: boolean;

  // Notifications
  emailNewStudent: boolean;
  emailCourseComplete: boolean;
  emailAssessmentSubmit: boolean;
  emailCertificateRequest: boolean;
  pushNewSession: boolean;
  pushStudentMessage: boolean;
  pushSystemUpdates: boolean;
  digestWeekly: boolean;
  digestMonthly: boolean;
  reminderMinutes: number;
}

const DEFAULTS: UserPreferences = {
  theme: "light",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  timezone: "UTC",
  compactMode: false,
  showTips: true,
  contentLanguage: "en",
  calendarFormat: "gregorian",
  highContrast: false,
  fontSize: "medium",
  reduceMotion: false,
  captionsDefault: true,
  subtitlesLanguage: "en",
  profileVisibility: "full",
  dataSharing: true,
  emailNewStudent: true,
  emailCourseComplete: true,
  emailAssessmentSubmit: false,
  emailCertificateRequest: true,
  pushNewSession: true,
  pushStudentMessage: true,
  pushSystemUpdates: false,
  digestWeekly: true,
  digestMonthly: false,
  reminderMinutes: 30,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await preferencesApi.get();
      setPreferences({ ...DEFAULTS, ...(data as Partial<UserPreferences>) });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load preferences",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updateUi = useCallback(
    async (updates: Record<string, unknown>) => {
      // Optimistic update
      setPreferences((prev) => ({ ...prev, ...updates } as UserPreferences));
      try {
        await preferencesApi.updateUi(updates);
      } catch {
        // Revert on error
        fetchPreferences();
      }
    },
    [fetchPreferences],
  );

  const updateNotifications = useCallback(
    async (updates: Record<string, boolean | number>) => {
      setPreferences((prev) => ({ ...prev, ...updates } as UserPreferences));
      try {
        await preferencesApi.updateNotifications(updates as Record<string, boolean>);
      } catch {
        fetchPreferences();
      }
    },
    [fetchPreferences],
  );

  return {
    preferences,
    loading,
    error,
    updateUi,
    updateNotifications,
    refetch: fetchPreferences,
  };
}
