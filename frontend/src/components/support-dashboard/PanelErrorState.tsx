"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface PanelErrorStateProps {
  onRetry: () => void;
  isRetrying?: boolean;
  message?: string;
}

/**
 * Standard error card for report/list panels in the support dashboard.
 * Used wherever a fetch can fail and we'd otherwise leave the user
 * staring at an empty container or a fading toast they may have missed.
 */
export default function PanelErrorState({
  onRetry,
  isRetrying = false,
  message,
}: PanelErrorStateProps) {
  const t = useTranslations("supportDashboard.errorState");

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {t("title")}
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mb-4">
        {message || t("description")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`}
        />
        {t("retry")}
      </button>
    </div>
  );
}
