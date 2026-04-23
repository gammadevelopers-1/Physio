"use client";

import { useTranslations, useLocale } from "next-intl";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri, type CalendarFormat } from "@/lib/hijri";
import { Bell, Clock } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

interface InstructorNotificationsWidgetProps {
  notifications: Notification[];
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
}

function formatRelativeDate(isoString: string, tN: ReturnType<typeof useTranslations>, calendarFormat: CalendarFormat, locale: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return tN("justNow");
    if (diffMins < 60) return tN("minutesAgo", { m: diffMins });
    if (diffHours < 24) return tN("hoursAgo", { h: diffHours });
    if (diffDays < 7) return tN("daysAgo", { d: diffDays });

    return formatDateHijri(date, calendarFormat, { locale });
  } catch {
    return "";
  }
}

const InstructorNotificationsWidget = ({
  notifications,
  onRefresh,
  onMarkAllRead,
  onClearAll,
}: InstructorNotificationsWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const tN = useTranslations("notifications");
  const tA = useTranslations("accessibility");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("notifications.title")}
          </h3>
          {unreadCount > 0 && (
            <span className="text-xs font-medium text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && onMarkAllRead && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="text-[11px] text-[var(--color-text-secondary)] hover:text-[#EF4444] font-medium transition-colors"
              >
                {t("notifications.clearAll")}
              </button>
            )}
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
            <Bell className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("notifications.noNotificationsTitle")}
          </h4>
          <p className="text-xs text-[var(--color-text-secondary)] text-center mb-4 max-w-[200px]">
            {t("notifications.noNotificationsDescription")}
          </p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
            aria-label={tA("refresh")}
          >
            {t("notifications.refresh")}
          </button>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2 scrollbar-thin">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border transition-colors ${
                !notification.read
                  ? "bg-[#EFF6FF] border-[#DBEAFE]"
                  : "bg-[var(--color-surface-page)] border-transparent hover:border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                  {tN.has(`types.${notification.type}.title`) ? tN(`types.${notification.type}.title`) : notification.title}
                </h4>
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="w-3 h-3 text-[var(--color-text-secondary)]" />
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  {formatRelativeDate(notification.date, tN, calendarFormat, locale)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorNotificationsWidget;
