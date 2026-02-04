"use client";

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  onRefresh?: () => void;
}

const NotificationsPanel = ({
  notifications,
  onRefresh,
}: NotificationsPanelProps) => {
  const t = useTranslations("studentDashboard");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      {/* Header */}
      <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
        {t("notifications.title")}
      </h2>

      {notifications.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
            <Bell className="w-6 h-6 text-[#9CA3AF]" />
          </div>
          <h3 className="text-sm font-medium text-[#1F2937] mb-1">
            {t("notifications.noNotificationsTitle")}
          </h3>
          <p className="text-xs text-[#6B7280] text-center mb-4 max-w-[200px]">
            {t("notifications.noNotificationsDescription")}
          </p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB] transition-colors"
          >
            {t("notifications.refresh")}
          </button>
        </div>
      ) : (
        // Notifications List
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5E7EB] last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <h4 className="text-sm font-medium text-[#1F2937]">
                  {notification.title}
                </h4>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {notification.message}
                </p>
              </div>
              <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                {notification.date}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
