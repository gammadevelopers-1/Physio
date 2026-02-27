"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

const TYPE_COLORS: Record<string, string> = {
  session_started: "bg-green-500",
  session_ended: "bg-blue-500",
  session_cancelled: "bg-red-500",
  session_rescheduled: "bg-yellow-500",
  system: "bg-gray-500",
};

function getRelativeTime(
  dateStr: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { m: diffMin });
  if (diffHrs < 24) return t("hoursAgo", { h: diffHrs });
  return t("daysAgo", { d: diffDays });
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("notifications");
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Refetch when opening
  const handleToggle = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) refetch();
  };

  const handleNotificationClick = async (notif: {
    id: string;
    isRead: boolean;
    link: string | null;
  }) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      router.push(`/${locale}${notif.link}`);
      setIsOpen(false);
    }
  };

  const isRTL = locale === "ar";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors relative"
        aria-label={t("title")}
      >
        <Bell className="w-5 h-5" strokeWidth={1.67} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 w-[360px] bg-white rounded-lg shadow-lg border border-[var(--outline-subtle)] z-50 ${
            isRTL ? "left-0" : "right-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--outline-subtle)]">
            <h3 className="text-sm font-semibold text-[#1F2937]">
              {t("title")}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#a37f49] hover:text-[#6b4e24] font-medium transition-colors"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 mx-auto text-[#D1D5DB] mb-2" />
                <p className="text-sm text-[#9CA3AF]">
                  {t("noNotifications")}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--outline-subtle)] last:border-b-0 hover:bg-[#F9FAFB] transition-colors ${
                    !notif.isRead ? "bg-[#EFF6FF]" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Type indicator dot */}
                    <div className="pt-1.5 shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          TYPE_COLORS[notif.type] || "bg-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1F2937] truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-[#6B7280] line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] mt-1">
                        {getRelativeTime(notif.createdAt, t)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
