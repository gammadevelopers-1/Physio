"use client";

import { useTranslations } from "next-intl";
import {
  ClipboardCheck,
  UserCheck,
  BookOpen,
  Award,
  Activity,
} from "lucide-react";
import type { RecentActivityItem, ActivityType } from "@/types/student-dashboard";

interface NotificationsPanelProps {
  activities: RecentActivityItem[];
  loading?: boolean;
}

function getActivityConfig(type: ActivityType) {
  switch (type) {
    case "assessment_submitted":
      return {
        Icon: ClipboardCheck,
        dotColor: "bg-[#F59E0B]",
        iconColor: "text-[#F59E0B]",
        key: "assessmentSubmitted" as const,
      };
    case "session_attended":
      return {
        Icon: UserCheck,
        dotColor: "bg-[#16A34A]",
        iconColor: "text-[#16A34A]",
        key: "sessionAttended" as const,
      };
    case "course_enrolled":
      return {
        Icon: BookOpen,
        dotColor: "bg-[#2D8CFF]",
        iconColor: "text-[#2D8CFF]",
        key: "courseEnrolled" as const,
      };
    case "certificate_earned":
      return {
        Icon: Award,
        dotColor: "bg-[#8B5CF6]",
        iconColor: "text-[#8B5CF6]",
        key: "certificateEarned" as const,
      };
    default:
      return {
        Icon: Activity,
        dotColor: "bg-gray-400",
        iconColor: "text-gray-400",
        key: "courseEnrolled" as const,
      };
  }
}

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const NotificationsPanel = ({
  activities,
  loading,
}: NotificationsPanelProps) => {
  const t = useTranslations("studentDashboard");

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        {t("activity.title")}
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-text-secondary)] rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
            <Activity className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("activity.noActivityTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] text-center max-w-[200px]">
            {t("activity.noActivityDescription")}
          </p>
        </div>
      ) : (
        <div className="relative">
          {activities.map((item, index) => {
            const config = getActivityConfig(item.type);
            const ActivityIcon = config.Icon;
            const isLast = index === activities.length - 1;

            return (
              <div key={item.id} className="flex gap-3 relative">
                {/* Timeline line */}
                {!isLast && (
                  <div className="absolute left-[11px] top-7 bottom-0 w-px bg-[var(--color-border)]" />
                )}

                {/* Dot */}
                <div
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${config.dotColor} bg-opacity-15`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${config.dotColor}`}
                  />
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-4"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ActivityIcon
                        className={`w-3.5 h-3.5 flex-shrink-0 ${config.iconColor}`}
                      />
                      <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                        {t(`activity.${config.key}`)}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap flex-shrink-0">
                      {relativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] line-clamp-1">
                    {item.courseTitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
