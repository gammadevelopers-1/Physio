"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { userNotificationsApi, UserNotification } from "@/lib/api";

const POLL_INTERVAL = 30_000; // 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lightweight poll for unread count
  const pollUnreadCount = useCallback(async () => {
    try {
      const res = await userNotificationsApi.getUnreadCount();
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // Full fetch of notifications list
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userNotificationsApi.getAll({ limit: 50 });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await userNotificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await userNotificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silently ignore
    }
  }, []);

  // Initial fetch + start polling
  useEffect(() => {
    refetch();

    intervalRef.current = setInterval(pollUnreadCount, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refetch, pollUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}
