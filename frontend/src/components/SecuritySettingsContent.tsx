"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts";
import { authApi, TrustedDevice, ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Monitor,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Globe,
  Clock,
  CalendarDays,
} from "lucide-react";

export default function SecuritySettingsContent() {
  const t = useTranslations("securitySettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const { user } = useAuth();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  // Load 2FA status and trusted devices
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

  // Toggle 2FA
  const handleToggle2FA = async () => {
    setToggling(true);
    try {
      const result = await authApi.toggle2FA(!twoFactorEnabled);
      setTwoFactorEnabled(result.twoFactorEnabled);

      const status = result.twoFactorEnabled
        ? t("twoFactor.statusEnabled")
        : t("twoFactor.statusDisabled");
      toast.success(t("twoFactor.toggleSuccess", { status }));

      // If disabled, clear devices list
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

  // Revoke single device
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

  // Revoke all devices
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceName: string | null) => {
    if (!deviceName) return <Globe className="w-5 h-5" />;
    const lower = deviceName.toLowerCase();
    if (lower.includes("android") || lower.includes("ios") || lower.includes("iphone"))
      return <Smartphone className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#a37f49]" />
      </div>
    );
  }

  return (
    <div
      className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[#737373] hover:text-[#1a1a1a] transition-colors mb-6"
        style={{ fontSize: "14px" }}
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </button>

      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="font-semibold text-[#171717] mb-1"
          style={{ fontSize: "24px", lineHeight: "32px" }}
        >
          {t("title")}
        </h1>
        <p className="text-[#737373]" style={{ fontSize: "14px" }}>
          {t("description")}
        </p>
      </div>

      {/* 2FA Toggle Card */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 mb-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              twoFactorEnabled
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {twoFactorEnabled ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <ShieldOff className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2
                className="font-semibold text-[#171717]"
                style={{ fontSize: "16px" }}
              >
                {t("twoFactor.title")}
              </h2>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  twoFactorEnabled
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {twoFactorEnabled
                  ? t("twoFactor.enabled")
                  : t("twoFactor.disabled")}
              </span>
            </div>
            <p
              className="text-[#737373] mb-4"
              style={{ fontSize: "13px", lineHeight: "1.5" }}
            >
              {t("twoFactor.description")}
            </p>

            <button
              onClick={handleToggle2FA}
              disabled={toggling}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                twoFactorEnabled
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "text-white hover:opacity-90"
              }`}
              style={
                !twoFactorEnabled
                  ? {
                      background: isRTL
                        ? "linear-gradient(to left, #a37f49, #6b4e24)"
                        : "linear-gradient(to right, #a37f49, #6b4e24)",
                    }
                  : undefined
              }
            >
              {toggling && <Loader2 className="w-4 h-4 animate-spin" />}
              <Shield className="w-4 h-4" />
              {twoFactorEnabled
                ? t("twoFactor.disable")
                : t("twoFactor.enable")}
            </button>
          </div>
        </div>
      </div>

      {/* Trusted Devices Card */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="font-semibold text-[#171717] mb-0.5"
              style={{ fontSize: "16px" }}
            >
              {t("trustedDevices.title")}
            </h2>
            <p className="text-[#737373]" style={{ fontSize: "13px" }}>
              {t("trustedDevices.description")}
            </p>
          </div>

          {devices.length > 0 && (
            <div className="relative">
              {showRevokeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <span
                    className="text-[#737373] text-xs hidden sm:inline"
                  >
                    {t("trustedDevices.revokeAllConfirm")}
                  </span>
                  <button
                    onClick={handleRevokeAll}
                    disabled={revokingAll}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {revokingAll && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    {t("trustedDevices.revokeAll")}
                  </button>
                  <button
                    onClick={() => setShowRevokeAllConfirm(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRevokeAllConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("trustedDevices.revokeAll")}
                </button>
              )}
            </div>
          )}
        </div>

        {devices.length === 0 ? (
          /* Empty State */
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <Smartphone className="w-7 h-7 text-gray-300" />
            </div>
            <p
              className="text-[#737373] font-medium mb-1"
              style={{ fontSize: "14px" }}
            >
              {t("trustedDevices.noDevices")}
            </p>
            <p className="text-[#9ca3af]" style={{ fontSize: "13px" }}>
              {t("trustedDevices.noDevicesHint")}
            </p>
          </div>
        ) : (
          /* Device List */
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-[#f0f0f0] hover:border-[#e5e7eb] transition-colors"
              >
                {/* Device Icon */}
                <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#737373] flex-shrink-0">
                  {getDeviceIcon(device.deviceName)}
                </div>

                {/* Device Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-[#171717] truncate"
                    style={{ fontSize: "14px" }}
                  >
                    {device.deviceName || "Unknown Device"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {device.ipAddress && (
                      <span className="inline-flex items-center gap-1 text-[#9ca3af]" style={{ fontSize: "12px" }}>
                        <Globe className="w-3 h-3" />
                        {device.ipAddress}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[#9ca3af]" style={{ fontSize: "12px" }}>
                      <Clock className="w-3 h-3" />
                      {t("trustedDevices.lastUsed")} {formatDate(device.lastUsedAt)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#9ca3af]" style={{ fontSize: "12px" }}>
                      <CalendarDays className="w-3 h-3" />
                      {t("trustedDevices.addedOn")} {formatDate(device.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Revoke Button */}
                <button
                  onClick={() => handleRevokeDevice(device.id)}
                  disabled={revokingId === device.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {revokingId === device.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {t("trustedDevices.revokeDevice")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NELC Compliance Notice */}
      <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            {locale === "ar"
              ? "متطلبات أمان NELC"
              : "NELC Security Requirement"}
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            {locale === "ar"
              ? "المصادقة الثنائية مطلوبة للامتثال لمعايير NELC للقطاع الصحي. تعطيل هذه الميزة قد يؤثر على وصولك للمنصة."
              : "Two-factor authentication is required for NELC health sector compliance. Disabling this feature may affect your platform access."}
          </p>
        </div>
      </div>
    </div>
  );
}
