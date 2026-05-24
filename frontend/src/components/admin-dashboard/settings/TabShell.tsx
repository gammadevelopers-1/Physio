"use client";

import { Loader2, Save, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Common chrome every settings tab renders inside: heading + body
 * + Save/Reset footer. Centralizes the busy/dirty/error UX so each
 * tab focuses on its own fields.
 */
interface Props {
  title: string;
  description?: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  loadError?: string | null;
  onSave: () => void;
  onReset?: () => void;
  children: ReactNode;
  /** Hide the save bar entirely (e.g. for My Security which saves
   *  per-action via its own dedicated hooks). */
  noSaveBar?: boolean;
}

export function TabShell({
  title,
  description,
  loading,
  saving,
  dirty,
  loadError,
  onSave,
  onReset,
  children,
  noSaveBar,
}: Props) {
  const t = useTranslations("adminDashboard.settingsPage");

  if (loadError) {
    return (
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-[#991B1B] mb-1">
            {t("loadError")}
          </h3>
          <p className="text-sm text-[#B91C1C]">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {description}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-5">{children}</div>

          {!noSaveBar && (
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-[var(--color-border)]">
              {dirty && (
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {t("unsavedChanges")}
                </span>
              )}
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  disabled={!dirty || saving}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("reset")}
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-2 px-5 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("saveChanges")}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
