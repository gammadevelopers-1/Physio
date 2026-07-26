"use client";

import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { usePreferences, type UserPreferences } from "@/hooks/usePreferences";

/**
 * Each row in the notification matrix represents one type of event the user
 * may want to be notified about. The user can independently toggle each channel
 * for each event — no aggregation, no lossy bulk toggles.
 */
export interface NotificationEvent {
  /** Unique key for React */
  id: string;
  /** Pre-translated label shown in the row */
  label: string;
  /** Optional pre-translated description shown under the label */
  description?: string;
  /** UserPreferences key controlling email channel (omit to hide email cell) */
  emailKey?: keyof UserPreferences;
  /** UserPreferences key controlling in-app channel (omit to hide in-app cell) */
  inAppKey?: keyof UserPreferences;
}

interface NotificationsSectionProps {
  events: NotificationEvent[];
  /** Header text shown above the matrix */
  title?: string;
  /** Description shown under the header */
  description?: string;
}

export default function NotificationsSection({
  events,
  title,
  description,
}: NotificationsSectionProps) {
  const t = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { preferences, loading, updateNotifications } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {title || t("notificationPreferences")}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {description || t("notificationsDesc")}
        </p>
      </div>

      {/* Header row */}
      <div className="flex items-center gap-4 pb-3 border-b border-[var(--color-border)]">
        <div className="flex-1" />
        <div className="w-20 text-center text-xs font-medium text-[var(--color-text-secondary)]">
          {t("channelEmail")}
        </div>
        <div className="w-20 text-center text-xs font-medium text-[var(--color-text-secondary)]">
          {t("channelInApp")}
        </div>
      </div>

      {/* Event rows */}
      {events.map((event) => {
        const emailEnabled = event.emailKey ? Boolean(preferences[event.emailKey]) : false;
        const inAppEnabled = event.inAppKey ? Boolean(preferences[event.inAppKey]) : false;
        return (
          <div
            key={event.id}
            className="flex items-center gap-4 py-3 border-b border-[var(--color-border-subtle)] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{event.label}</div>
              {event.description && (
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{event.description}</div>
              )}
            </div>
            <div className="w-20 flex justify-center">
              {event.emailKey ? (
                <Toggle
                  enabled={emailEnabled}
                  onChange={(v) => updateNotifications({ [event.emailKey as string]: v })}
                />
              ) : (
                <span className="text-xs text-[var(--color-text-secondary)]">—</span>
              )}
            </div>
            <div className="w-20 flex justify-center">
              {event.inAppKey ? (
                <Toggle
                  enabled={inAppEnabled}
                  onChange={(v) => updateNotifications({ [event.inAppKey as string]: v })}
                />
              ) : (
                <span className="text-xs text-[var(--color-text-secondary)]">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#22C55E] ${
        enabled ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          enabled
            ? isRTL ? "-translate-x-6" : "translate-x-6"
            : isRTL ? "-translate-x-1" : "translate-x-1"
        }`}
      />
    </button>
  );
}
