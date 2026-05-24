"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  Mail,
  MessageCircle,
  FileText,
  ExternalLink,
  Lock,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Award,
  ClipboardList,
  Eye,
  UserPlus,
} from "lucide-react";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";

type ToggleableCategory =
  | "applications"
  | "enrollment"
  | "sessions"
  | "webinars"
  | "certificates"
  | "assessments"
  | "content";

interface NotificationsSettings extends Record<string, unknown> {
  channels: {
    email: boolean;
    whatsapp: boolean;
    emailCategories: Record<ToggleableCategory, boolean>;
  };
}

const FALLBACK: NotificationsSettings = {
  channels: {
    email: true,
    whatsapp: true,
    emailCategories: {
      applications: true,
      enrollment: true,
      sessions: true,
      webinars: true,
      certificates: true,
      assessments: true,
      content: true,
    },
  },
};

const CATEGORY_META: { key: ToggleableCategory; icon: React.ElementType }[] = [
  { key: "applications", icon: UserPlus },
  { key: "enrollment", icon: GraduationCap },
  { key: "sessions", icon: Calendar },
  { key: "webinars", icon: Calendar },
  { key: "certificates", icon: Award },
  { key: "assessments", icon: ClipboardList },
  { key: "content", icon: Eye },
];

export default function NotificationsTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const locale = useLocale();
  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<NotificationsSettings>("notifications", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  // Defensive: backfill missing sub-categories when the row was saved
  // before this UI existed, so toggling them works immediately.
  const emailCategories: Record<ToggleableCategory, boolean> = {
    ...FALLBACK.channels.emailCategories,
    ...(draft.channels?.emailCategories ?? {}),
  };

  const setMaster = (channel: "email" | "whatsapp", value: boolean) => {
    setDraft((d) => ({
      ...d,
      channels: { ...d.channels, [channel]: value },
    }));
  };

  const setCategory = (cat: ToggleableCategory, value: boolean) => {
    setDraft((d) => ({
      ...d,
      channels: {
        ...d.channels,
        emailCategories: { ...emailCategories, [cat]: value },
      },
    }));
  };

  const masterEmailOn = draft.channels?.email !== false;
  const masterWhatsAppOn = draft.channels?.whatsapp !== false;

  return (
    <TabShell
      title={t("notifications.title")}
      description={t("notifications.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={save}
    >
      {/* Channels — master + per-category */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {t("notifications.channelsTitle")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          {t("notifications.channelsHelp")}
        </p>

        <div className="space-y-4">
          {/* EMAIL master + sub-categories */}
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
            {/* Master row */}
            <div className="flex items-center justify-between p-4 bg-[var(--color-surface-page)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("notifications.channels.email")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("notifications.channels.emailDesc")}
                  </p>
                </div>
              </div>
              <Toggle
                enabled={masterEmailOn}
                onToggle={() => setMaster("email", !masterEmailOn)}
              />
            </div>

            {/* Always-on Account row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-border-subtle)]/40">
              <div className="flex items-center gap-3 ms-12">
                <div className="w-7 h-7 rounded-md bg-[var(--color-surface-card)] border border-[var(--color-border)] flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">
                    {t("notifications.categories.account")}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {t("notifications.categories.accountDesc")}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                {t("notifications.alwaysOn")}
              </span>
            </div>

            {/* Toggleable category rows */}
            {CATEGORY_META.map((row) => {
              const Icon = row.icon;
              const subOn = emailCategories[row.key] !== false;
              const effectivelyOff = !masterEmailOn || !subOn;
              return (
                <div
                  key={row.key}
                  className={`flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] ${
                    effectivelyOff ? "bg-[var(--color-surface-card)]" : "bg-[var(--color-surface-card)]"
                  }`}
                >
                  <div className="flex items-center gap-3 ms-12">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center ${
                        effectivelyOff
                          ? "bg-[var(--color-border-subtle)]"
                          : "bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          effectivelyOff
                            ? "text-[var(--color-text-secondary)]"
                            : "text-[var(--color-primary)]"
                        }`}
                      />
                    </div>
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          effectivelyOff
                            ? "text-[var(--color-text-secondary)]"
                            : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {t(`notifications.categories.${row.key}`)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        {t(`notifications.categories.${row.key}Desc`)}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={subOn}
                    disabled={!masterEmailOn}
                    onToggle={() => setCategory(row.key, !subOn)}
                  />
                </div>
              );
            })}
          </div>

          {/* WHATSAPP — single master row */}
          <div className="border border-[var(--color-border)] rounded-xl">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("notifications.channels.whatsapp")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("notifications.channels.whatsappDesc")}
                  </p>
                </div>
              </div>
              <Toggle
                enabled={masterWhatsAppOn}
                onToggle={() => setMaster("whatsapp", !masterWhatsAppOn)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pointer to Templates page */}
      <div className="border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-surface-page)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--color-border-subtle)] text-[var(--color-primary)]">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
              {t("notifications.templatesMovedTitle")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              {t("notifications.templatesMovedBody")}
            </p>
            <Link
              href={`/${locale}/dashboard/admin/templates`}
              className="inline-flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-xs font-semibold transition-colors"
            >
              {t("notifications.openTemplates")}
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </TabShell>
  );
}

function Toggle({
  enabled,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${
        enabled ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
      }`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
          enabled ? "ms-auto" : ""
        }`}
      />
    </button>
  );
}
