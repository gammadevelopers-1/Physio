"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { userNotificationsApi, UserNotification } from "@/lib/api";

const POLL_INTERVAL = 30_000; // 30 seconds

interface UseNotificationsOptions {
  /**
   * Optional set of notification `type` values to include. When provided, both the
   * notifications list AND the unread count badge will only count types in this set.
   * Pass undefined (default) to show all types — used by instructor/manager dashboards.
   */
  typeAllowlist?: readonly string[];
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { typeAllowlist } = options;
  const [allNotifications, setAllNotifications] = useState<UserNotification[]>([]);
  const [rawUnreadCount, setRawUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoize the allowlist as a Set for O(1) lookup. We compare by JSON-stringified
  // contents so that callers passing a freshly-built array each render don't bust the memo.
  const allowlistKey = typeAllowlist ? typeAllowlist.join(",") : "";
  const allowlistSet = useMemo(
    () => (typeAllowlist ? new Set(typeAllowlist) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowlistKey],
  );

  const filterByAllowlist = useCallback(
    (list: UserNotification[]) =>
      allowlistSet ? list.filter((n) => allowlistSet.has(n.type)) : list,
    [allowlistSet],
  );

  const notifications = useMemo(
    () => filterByAllowlist(allNotifications),
    [allNotifications, filterByAllowlist],
  );

  // Unread count: when an allowlist is active, count from the filtered+unread list
  // so the badge matches what's visible in the dropdown.
  const unreadCount = useMemo(() => {
    if (!allowlistSet) return rawUnreadCount;
    return notifications.filter((n) => !n.isRead).length;
  }, [allowlistSet, rawUnreadCount, notifications]);

  // Lightweight poll for unread count
  const pollUnreadCount = useCallback(async () => {
    try {
      const res = await userNotificationsApi.getUnreadCount();
      setRawUnreadCount(res.unreadCount);
      // When allowlist is active, refetch the list too so we re-derive the filtered count.
      if (allowlistSet) {
        const list = await userNotificationsApi.getAll({ limit: 50 });
        setAllNotifications(list.data);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [allowlistSet]);

  // Full fetch of notifications list
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userNotificationsApi.getAll({ limit: 50 });
      setAllNotifications(res.data);
      setRawUnreadCount(res.unreadCount);
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
      setAllNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setRawUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await userNotificationsApi.markAllAsRead();
      setAllNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setRawUnreadCount(0);
    } catch {
      // Silently ignore
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await userNotificationsApi.clearAll();
      setAllNotifications([]);
      setRawUnreadCount(0);
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
    clearAll,
    refetch,
  };
}
