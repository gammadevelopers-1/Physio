"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { relativeTime, tOrFallback } from "@/lib/notification-i18n";

const TYPE_COLORS: Record<string, string> = {
  session_scheduled: "bg-teal-500",
  session_started: "bg-green-500",
  session_ended: "bg-blue-500",
  session_cancelled: "bg-red-500",
  session_rescheduled: "bg-yellow-500",
  system: "bg-gray-500",
  intervention_email: "bg-yellow-500",
  intervention_makeup: "bg-purple-500",
  content_pending_review: "bg-blue-500",
  content_review: "bg-green-500",
  assessment_published: "bg-amber-500",
  assessment_submitted: "bg-orange-500",
  course_assigned: "bg-indigo-500",
  course_unassigned: "bg-red-400",
};


interface NotificationBellProps {
  /**
   * Optional set of notification `type` values to surface. When set, only those types
   * appear in the dropdown and contribute to the unread badge count.
   * Used by the student dashboard to hide instructor/manager-oriented notifications.
   */
  typeAllowlist?: readonly string[];
  /**
   * `'team'` widens the feed to all SUPPORT users (supervisor/admin only).
   * Used by the support supervisor bell so they see team-wide notifications,
   * not just their own.
   */
  scope?: 'own' | 'team';
}

export default function NotificationBell({
  typeAllowlist,
  scope,
}: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("notifications");
  const tRoot = useTranslations();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    refetch,
  } = useNotifications({ typeAllowlist, scope });

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
          className={`absolute top-full mt-2 w-[360px] bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] z-50 ${
            isRTL ? "left-0" : "right-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--outline-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("title")}
            </h3>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium transition-colors"
                  >
                    {t("markAllRead")}
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] font-medium transition-colors"
                >
                  {t("clearAll")}
                </button>
              </div>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 mx-auto text-[var(--color-border)] mb-2" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("noNotifications")}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--outline-subtle)] last:border-b-0 hover:bg-[var(--color-border-subtle)] transition-colors ${
                    !notif.isRead ? "bg-[var(--color-border-subtle)]" : ""
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
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                        {tOrFallback(
                          tRoot,
                          notif.titleKey,
                          notif.titleParams,
                          t.has(`types.${notif.type}.title`)
                            ? t(`types.${notif.type}.title`)
                            : notif.title,
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-0.5">
                        {tOrFallback(
                          tRoot,
                          notif.messageKey,
                          notif.messageParams,
                          t.has(`types.${notif.type}.message`)
                            ? t(`types.${notif.type}.message`)
                            : notif.message,
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                        {relativeTime(t, notif.createdAt)}
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
