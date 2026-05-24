"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import Select from "../Select";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";

interface AuthSettings extends Record<string, unknown> {
  sessionTimeoutMinutes: number;
  refreshTokenDays: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  lockoutAttempts: number;
  lockoutMinutes: number;
}

const FALLBACK: AuthSettings = {
  sessionTimeoutMinutes: 15,
  refreshTokenDays: 7,
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSpecial: false,
  lockoutAttempts: 5,
  lockoutMinutes: 15,
};

export default function AuthTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<AuthSettings>("auth", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  return (
    <TabShell
      title={t("auth.title")}
      description={t("auth.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={save}
    >
      {/* Security-impact warning */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-[#92400E] mb-0.5">
            {t("auth.warningTitle")}
          </p>
          <p className="text-[#B45309]">{t("auth.warningBody")}</p>
        </div>
      </div>

      {/* Session timeout + refresh */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("auth.sessionTimeout")}
          </label>
          <Select
            value={String(draft.sessionTimeoutMinutes)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, sessionTimeoutMinutes: Number(v) }))
            }
            options={[
              { value: "5", label: t("auth.minutes", { n: 5 }) },
              { value: "15", label: t("auth.minutes", { n: 15 }) },
              { value: "30", label: t("auth.minutes", { n: 30 }) },
              { value: "60", label: t("auth.hours", { n: 1 }) },
              { value: "120", label: t("auth.hours", { n: 2 }) },
            ]}
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t("auth.sessionTimeoutDesc")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("auth.refreshDays")}
          </label>
          <Select
            value={String(draft.refreshTokenDays)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, refreshTokenDays: Number(v) }))
            }
            options={[
              { value: "1", label: t("auth.days", { n: 1 }) },
              { value: "3", label: t("auth.days", { n: 3 }) },
              { value: "7", label: t("auth.days", { n: 7 }) },
              { value: "14", label: t("auth.days", { n: 14 }) },
              { value: "30", label: t("auth.days", { n: 30 }) },
            ]}
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t("auth.refreshDaysDesc")}
          </p>
        </div>
      </div>

      {/* Password policy */}
      <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("auth.passwordPolicy")}
        </h3>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("auth.passwordMinLength")}
          </label>
          <Select
            value={String(draft.passwordMinLength)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, passwordMinLength: Number(v) }))
            }
            options={[6, 8, 10, 12, 14, 16].map((n) => ({
              value: String(n),
              label: t("auth.chars", { n }),
            }))}
            className="max-w-xs"
          />
        </div>

        {[
          {
            key: "passwordRequireUppercase" as const,
            label: t("auth.requireUppercase"),
          },
          {
            key: "passwordRequireNumber" as const,
            label: t("auth.requireNumber"),
          },
          {
            key: "passwordRequireSpecial" as const,
            label: t("auth.requireSpecial"),
          },
        ].map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between py-1.5"
          >
            <p className="text-sm text-[var(--color-text-primary)]">
              {row.label}
            </p>
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, [row.key]: !d[row.key] }))
              }
              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                draft[row.key] ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                  draft[row.key] ? "ms-auto" : ""
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Lockout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("auth.lockoutAttempts")}
          </label>
          <Select
            value={String(draft.lockoutAttempts)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, lockoutAttempts: Number(v) }))
            }
            options={[3, 5, 7, 10].map((n) => ({
              value: String(n),
              label: t("auth.attempts", { n }),
            }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("auth.lockoutDuration")}
          </label>
          <Select
            value={String(draft.lockoutMinutes)}
            onChange={(v) =>
              setDraft((d) => ({ ...d, lockoutMinutes: Number(v) }))
            }
            options={[5, 15, 30, 60].map((n) => ({
              value: String(n),
              label: t("auth.minutes", { n }),
            }))}
          />
        </div>
      </div>
    </TabShell>
  );
}
