"use client";

import { useState, useEffect, useCallback } from "react";
import { authApi, TrustedDevice, ApiError, removeAccessToken } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";

export function useSecuritySettings() {
  const t = useTranslations("securitySettings");
  const { logout } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  // Force logout: clear local auth state and redirect to login
  const forceLogout = useCallback(() => {
    removeAccessToken();
    document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
    toast.info(t("trustedDevices.sessionRevokedMessage"));
    logout();
  }, [logout, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, devicesResult] = await Promise.all([
        authApi.get2FAStatus(),
        authApi.getTrustedDevices(),
      ]);
      setTwoFactorEnabled(statusResult.twoFactorEnabled);
      setDevices(devicesResult);
    } catch {
      // Silent fail on initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle2FA = async () => {
    setToggling(true);
    try {
      const result = await authApi.toggle2FA(!twoFactorEnabled);
      setTwoFactorEnabled(result.twoFactorEnabled);
      const status = result.twoFactorEnabled
        ? t("twoFactor.statusEnabled")
        : t("twoFactor.statusDisabled");
      toast.success(t("twoFactor.toggleSuccess", { status }));
      if (!result.twoFactorEnabled) {
        setDevices([]);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to toggle 2FA"
      );
    } finally {
      setToggling(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await authApi.revokeDevice(deviceId);
      // Backend revoked all sessions — force logout so user re-authenticates with 2FA
      forceLogout();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to revoke device"
      );
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await authApi.revokeAllDevices();
      // Backend revoked all sessions — force logout so user re-authenticates with 2FA
      forceLogout();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to revoke devices"
      );
      setRevokingAll(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Force redirect even if logout API fails
      window.location.href = "/";
    }
  };

  return {
    twoFactorEnabled,
    devices,
    loading,
    toggling,
    revokingId,
    revokingAll,
    showRevokeAllConfirm,
    setShowRevokeAllConfirm,
    handleToggle2FA,
    handleRevokeDevice,
    handleRevokeAll,
    handleLogout,
  };
}
