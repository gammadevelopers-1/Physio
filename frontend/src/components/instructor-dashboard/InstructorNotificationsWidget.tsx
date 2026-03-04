"use client";

import { useTranslations } from "next-intl";
import { Bell, Clock } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

interface InstructorNotificationsWidgetProps {
  notifications: Notification[];
  onRefresh?: () => void;
}

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const InstructorNotificationsWidget = ({
  notifications,
  onRefresh,
}: InstructorNotificationsWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const tA = useTranslations("accessibility");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#1F2937]">
          {t("notifications.title")}
        </h3>
        {notifications.length > 0 && (
          <span className="text-xs font-medium text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
            {notifications.filter((n) => !n.read).length || ""}
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
            <Bell className="w-6 h-6 text-[#9CA3AF]" />
          </div>
          <h4 className="text-sm font-medium text-[#1F2937] mb-1">
            {t("notifications.noNotificationsTitle")}
          </h4>
          <p className="text-xs text-[#6B7280] text-center mb-4 max-w-[200px]">
            {t("notifications.noNotificationsDescription")}
          </p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB] transition-colors"
            aria-label={tA("refresh")}
          >
            {t("notifications.refresh")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border transition-colors ${
                !notification.read
                  ? "bg-[#EFF6FF] border-[#DBEAFE]"
                  : "bg-[#F9FAFB] border-transparent hover:border-[#E5E7EB]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-medium text-[#1F2937] leading-tight">
                  {notification.title}
                </h4>
                {!notification.read && (
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2">
                {notification.message}
              </p>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[11px] text-[#9CA3AF]">
                  {formatRelativeDate(notification.date)}
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
