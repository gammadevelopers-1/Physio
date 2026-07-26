"use client";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, Loader2, Mail } from "lucide-react";
import { usePreferences, type UserPreferences } from "@/hooks/usePreferences";

// Backend gating across these fields uses an OR test, so per-event toggling
// has no real effect. Two master toggles match reality honestly — and we
// set ALL matching fields together when toggled.
const EMAIL_FIELDS: (keyof UserPreferences)[] = [
  "emailNewStudent",
  "emailCourseComplete",
  "emailAssessmentSubmit",
  "emailCertificateRequest",
];

const INAPP_FIELDS: (keyof UserPreferences)[] = [
  "pushNewSession",
  "pushStudentMessage",
  "pushSystemUpdates",
];

/**
 * Two-master-toggle notification preferences. Same pattern across student,
 * instructor, and manager — backend gating is OR-based across multiple
 * keys, so a single email/in-app master is the honest UX. The matching
 * keys flip together when toggled.
 */
export default function MasterNotificationToggles() {
  const tCommon = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { preferences, loading, updateNotifications } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  const emailOn = EMAIL_FIELDS.some((f) => Boolean(preferences[f]));
  const inAppOn = INAPP_FIELDS.some((f) => Boolean(preferences[f]));

  const setAll = async (
    fields: (keyof UserPreferences)[],
    value: boolean,
  ) => {
    const payload: Record<string, boolean> = {};
    fields.forEach((f) => {
      payload[f as string] = value;
    });
    try {
      await updateNotifications(payload);
    } catch {
      toast.error(tCommon("notificationsError"));
    }
  };

  return (
    <div className="space-y-2" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          {tCommon("notificationPreferences")}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {tCommon("notificationsDesc")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 border border-[var(--color-border)] rounded-lg">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {tCommon("channelEmail")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {tCommon("emailMasterDesc")}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailOn}
          onClick={() => setAll(EMAIL_FIELDS, !emailOn)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#22C55E] ${
            emailOn ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
              emailOn
                ? isRTL ? "-translate-x-6" : "translate-x-6"
                : isRTL ? "-translate-x-1" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 border border-[var(--color-border)] rounded-lg">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {tCommon("channelInApp")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {tCommon("inAppMasterDesc")}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={inAppOn}
          onClick={() => setAll(INAPP_FIELDS, !inAppOn)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#22C55E] ${
            inAppOn ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
              inAppOn
                ? isRTL ? "-translate-x-6" : "translate-x-6"
                : isRTL ? "-translate-x-1" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
