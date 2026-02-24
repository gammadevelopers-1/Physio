"use client";

import { useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";

const FONT_SIZE_MAP: Record<string, string> = {
  small: "14px",
  medium: "16px",
  large: "20px",
  "extra-large": "24px",
};

export default function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { preferences, loading } = usePreferences();

  useEffect(() => {
    if (loading) return;

    const root = document.documentElement;

    // Font size
    const fontSize = FONT_SIZE_MAP[preferences.fontSize] || "16px";
    root.style.fontSize = fontSize;

    // High contrast
    if (preferences.highContrast) {
      root.setAttribute("data-high-contrast", "true");
    } else {
      root.removeAttribute("data-high-contrast");
    }

    // Reduced motion
    if (preferences.reduceMotion) {
      root.setAttribute("data-reduce-motion", "true");
    } else {
      root.removeAttribute("data-reduce-motion");
    }

    // Cleanup on unmount
    return () => {
      root.style.fontSize = "";
      root.removeAttribute("data-high-contrast");
      root.removeAttribute("data-reduce-motion");
    };
  }, [
    loading,
    preferences.fontSize,
    preferences.highContrast,
    preferences.reduceMotion,
  ]);

  return <>{children}</>;
}
