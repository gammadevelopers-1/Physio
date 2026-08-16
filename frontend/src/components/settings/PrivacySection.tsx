"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2, Shield, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// Response shapes mirror backends/src/modules/me/consents.service.ts —
// keep them in sync when adding new consent types.
interface ConsentStatusMap {
  granted: boolean;
  version: string | null;
  acceptedAt: string | null;
  withdrawnAt: string | null;
}
interface ConsentsResponse {
  history: Array<{
    type: string;
    version: string;
    acceptedAt: string;
    withdrawnAt: string | null;
  }>;
  currentStatus: Record<string, ConsentStatusMap>;
}

export default function PrivacySection() {
  const t = useTranslations("commonSettings.privacy");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { logout } = useAuth();

  // ── Consents state ────────────────────────────────────────────────
  const [consents, setConsents] = useState<ConsentsResponse | null>(null);
  const [loadingConsents, setLoadingConsents] = useState(true);
  const [togglingMarketing, setTogglingMarketing] = useState(false);
  const [togglingSensitive, setTogglingSensitive] = useState(false);

  useEffect(() => {
    void fetchConsents();
  }, []);

  const fetchConsents = async () => {
    try {
      const data = await api.get<ConsentsResponse>("/me/consents");
      setConsents(data);
    } catch {
      toast.error(t("consentsLoadError"));
    } finally {
      setLoadingConsents(false);
    }
  };

  // Optimistic update: flip the toggle visually before the network round
  // trip completes so the user gets instant feedback. Reverted on error.
  const applyOptimistic = (
    type: "marketing_email" | "sensitive_data",
    granted: boolean,
  ) => {
    setConsents((prev) =>
      prev
        ? {
            ...prev,
            currentStatus: {
              ...prev.currentStatus,
              [type]: {
                granted,
                version: prev.currentStatus[type]?.version ?? null,
                acceptedAt: prev.currentStatus[type]?.acceptedAt ?? null,
                withdrawnAt: granted ? null : new Date().toISOString(),
              },
            },
          }
        : prev,
    );
  };

  const setMarketing = async (enabled: boolean) => {
    setTogglingMarketing(true);
    applyOptimistic("marketing_email", enabled);
    try {
      await api.patch("/me/consents/marketing", { enabled });
      toast.success(enabled ? t("marketingEnabled") : t("marketingDisabled"));
      await fetchConsents();
    } catch {
      applyOptimistic("marketing_email", !enabled); // revert
      toast.error(t("consentToggleError"));
    } finally {
      setTogglingMarketing(false);
    }
  };

  const toggleSensitiveData = async (currentlyGranted: boolean) => {
    setTogglingSensitive(true);
    applyOptimistic("sensitive_data", !currentlyGranted);
    try {
      if (currentlyGranted) {
        await api.post("/me/consents/withdraw", { type: "sensitive_data" });
        toast.success(t("sensitiveWithdrawn"));
      } else {
        await api.post("/me/consents", { type: "sensitive_data" });
        toast.success(t("sensitiveGranted"));
      }
      await fetchConsents();
    } catch {
      applyOptimistic("sensitive_data", currentlyGranted); // revert
      toast.error(t("consentToggleError"));
    } finally {
      setTogglingSensitive(false);
    }
  };

  // ── Export state ──────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const exportMyData = async () => {
    setExporting(true);
    try {
      const data = await api.get<unknown>("/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `physioguidance-my-data-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? t("exportError");
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  // ── Delete account state ──────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submitDelete = async () => {
    if (!deletePassword) {
      toast.error(t("passwordRequired"));
      return;
    }
    setDeleting(true);
    try {
      await api.delete("/me/account", {
        password: deletePassword,
        reason: deleteReason || undefined,
      });
      toast.success(t("deleteScheduled"));
      // Backend already set isActive=false — logout locally so the UI
      // reflects the state change immediately instead of the user
      // seeing a stale authenticated view.
      await logout();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? t("deleteError");
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const marketingGranted =
    consents?.currentStatus.marketing_email?.granted ?? false;
  const sensitiveGranted =
    consents?.currentStatus.sensitive_data?.granted ?? false;
  const termsAcceptedAt = consents?.currentStatus.terms?.acceptedAt;
  const privacyAcceptedAt = consents?.currentStatus.privacy?.acceptedAt;

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Consents card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Shield className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("consentsTitle")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("consentsDescription")}
            </p>
          </div>
        </div>

        {loadingConsents ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Marketing */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("marketingLabel")}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("marketingHint")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void setMarketing(!marketingGranted)}
                disabled={togglingMarketing}
                aria-pressed={marketingGranted}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  marketingGranted
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border)]"
                } ${togglingMarketing ? "opacity-60 cursor-wait" : ""}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    marketingGranted ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Sensitive data */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("sensitiveLabel")}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("sensitiveHint")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void toggleSensitiveData(sensitiveGranted)}
                disabled={togglingSensitive}
                aria-pressed={sensitiveGranted}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sensitiveGranted
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border)]"
                } ${togglingSensitive ? "opacity-60 cursor-wait" : ""}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    sensitiveGranted ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Legal document acceptance timestamps (read-only proof) */}
            <div className="pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
              {termsAcceptedAt && (
                <div>
                  {t("termsAcceptedOn")} {formatDate(termsAcceptedAt, locale)}
                </div>
              )}
              {privacyAcceptedAt && (
                <div>
                  {t("privacyAcceptedOn")}{" "}
                  {formatDate(privacyAcceptedAt, locale)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export data card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Download className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("exportTitle")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("exportDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void exportMyData()}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("exportInProgress")}
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {t("exportButton")}
            </>
          )}
        </button>
      </div>

      {/* Delete account (danger zone) */}
      <div className="rounded-xl border border-red-300 dark:border-red-800 bg-[var(--color-surface-card)] p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-red-700 dark:text-red-400">
              {t("deleteTitle")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("deleteDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {t("deleteButton")}
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? "rtl" : "ltr"}
          >
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              {t("modalTitle")}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t("modalWarning")}
            </p>

            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("passwordLabel")}
            </label>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute top-1/2 -translate-y-1/2 ${
                  isRTL ? "left-2" : "right-2"
                } text-[var(--color-text-secondary)]`}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("reasonLabel")}
              <span className="ml-1 text-xs text-[var(--color-text-secondary)] font-normal">
                ({t("reasonOptional")})
              </span>
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none mb-4"
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void submitDelete()}
                disabled={deleting || !deletePassword}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
