"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { adminSettingsApi } from "@/lib/api";

/**
 * Admin-editable outgoing-mail identity. Backs the `mail` category on
 * admin_settings — see AdminSettingsService.getMailSettings in the
 * backend. Empty strings clear the override and fall back to the
 * MAIL_FROM env + "PhysioGuidance" hardcoded default.
 *
 * IMPORTANT for admins: `senderEmail` must be from a domain verified
 * with the mail provider (Resend). Sending from an unverified address
 * will be rejected. The warning banner below flags this.
 */
type MailSettings = {
  senderEmail: string;
  senderName: string;
};

export default function MailSettingsCard() {
  const t = useTranslations("adminDashboard.settingsPage.mailSettings");
  const [initial, setInitial] = useState<MailSettings | null>(null);
  const [form, setForm] = useState<MailSettings>({
    senderEmail: "",
    senderName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminSettingsApi
      .getCategory<MailSettings>("mail")
      .then((res) => {
        if (cancelled) return;
        const v = {
          senderEmail:
            typeof res.value?.senderEmail === "string" ? res.value.senderEmail : "",
          senderName:
            typeof res.value?.senderName === "string" ? res.value.senderName : "",
        };
        setInitial(v);
        setForm(v);
      })
      .catch(() => {
        // First load with no row is expected — treat as empty.
        if (cancelled) return;
        const v = { senderEmail: "", senderName: "" };
        setInitial(v);
        setForm(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    initial != null &&
    (initial.senderEmail !== form.senderEmail ||
      initial.senderName !== form.senderName);

  const emailValid =
    form.senderEmail === "" ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.senderEmail);

  const handleSave = async () => {
    if (!emailValid) {
      toast.error(t("errors.invalidEmail"));
      return;
    }
    setSaving(true);
    try {
      await adminSettingsApi.updateCategory("mail", form);
      setInitial(form);
      toast.success(t("toasts.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
          <Mail className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("senderEmailLabel")}
              </span>
              <input
                type="email"
                value={form.senderEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, senderEmail: e.target.value }))
                }
                placeholder="noreply@physioguidance.org"
                dir="ltr"
                className={`w-full h-10 px-3 text-sm rounded-lg border bg-white text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)] ${
                  emailValid
                    ? "border-[var(--color-border)]"
                    : "border-[#DC2626]"
                }`}
              />
              {!emailValid && (
                <span className="block mt-1 text-[11px] text-[#DC2626]">
                  {t("errors.invalidEmail")}
                </span>
              )}
              <span className="block mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {t("senderEmailHelp")}
              </span>
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("senderNameLabel")}
              </span>
              <input
                type="text"
                value={form.senderName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, senderName: e.target.value }))
                }
                placeholder="PhysioGuidance"
                maxLength={100}
                className="w-full h-10 px-3 text-sm rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
              />
              <span className="block mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {t("senderNameHelp")}
              </span>
            </label>
          </div>

          {/* Preview strip — shows exactly what will land in inboxes. */}
          <div className="bg-white border border-[var(--color-border)] rounded p-3 text-xs">
            <span className="text-[var(--color-text-secondary)]">
              {t("previewLabel")}:{" "}
            </span>
            <span
              className="font-mono text-[var(--color-text-primary)]"
              dir="ltr"
            >
              {(form.senderName || "PhysioGuidance") +
                " <" +
                (form.senderEmail || t("previewFallback")) +
                ">"}
            </span>
          </div>

          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded p-3 text-[11px] text-[#78350F]">
            <strong>{t("warning.title")}: </strong>
            {t("warning.body")}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || !emailValid}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t("save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
