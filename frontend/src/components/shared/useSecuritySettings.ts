"use client";

import { useState, useEffect, useCallback } from "react";
import { authApi, TrustedDevice, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useSecuritySettings() {
  const t = useTranslations("securitySettings");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

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
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      toast.success(t("trustedDevices.revokeSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to revoke device"
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await authApi.revokeAllDevices();
      setDevices([]);
      setShowRevokeAllConfirm(false);
      toast.success(t("trustedDevices.revokeAllSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to revoke devices"
      );
    } finally {
      setRevokingAll(false);
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
  };
}
