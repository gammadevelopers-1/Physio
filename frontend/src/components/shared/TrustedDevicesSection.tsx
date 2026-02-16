"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TrustedDevice } from "@/lib/api";
import {
  Smartphone,
  Monitor,
  Trash2,
  Loader2,
  Globe,
  Clock,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

interface TrustedDevicesSectionProps {
  devices: TrustedDevice[];
  revokingId: string | null;
  revokingAll: boolean;
  showRevokeAllConfirm: boolean;
  onRevokeDevice: (deviceId: string) => void;
  onRevokeAll: () => void;
  onShowRevokeAllConfirm: (show: boolean) => void;
  onLogout?: () => void;
}

export default function TrustedDevicesSection({
  devices,
  revokingId,
  revokingAll,
  showRevokeAllConfirm,
  onRevokeDevice,
  onRevokeAll,
  onShowRevokeAllConfirm,
  onLogout,
}: TrustedDevicesSectionProps) {
  const t = useTranslations("securitySettings");
  const locale = useLocale();
  const [confirmingCurrentDevice, setConfirmingCurrentDevice] = useState(false);
  const [includeCurrentInRevokeAll, setIncludeCurrentInRevokeAll] = useState(false);

  const currentDevice = devices.find((d) => d.isCurrentDevice);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const getDeviceIcon = (deviceName: string | null) => {
    if (!deviceName) return <Globe className="w-5 h-5" />;
    const lower = deviceName.toLowerCase();
    if (
      lower.includes("android") ||
      lower.includes("ios") ||
      lower.includes("iphone")
    )
      return <Smartphone className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  const handleRevokeDevice = (device: TrustedDevice) => {
    if (device.isCurrentDevice) {
      setConfirmingCurrentDevice(true);
    } else {
      onRevokeDevice(device.id);
    }
  };

  const confirmRevokeCurrentDevice = () => {
    if (currentDevice) {
      onRevokeDevice(currentDevice.id);
      setConfirmingCurrentDevice(false);
      // Logout after revoking current device
      if (onLogout) {
        setTimeout(() => onLogout(), 500);
      }
    }
  };

  const handleRevokeAll = () => {
    onRevokeAll();
    // If current device is included, logout
    if (includeCurrentInRevokeAll && onLogout) {
      setTimeout(() => onLogout(), 500);
    }
    setIncludeCurrentInRevokeAll(false);
  };

  return (
    <div>
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
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#737373] text-xs hidden sm:inline">
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
                    onClick={() => {
                      onShowRevokeAllConfirm(false);
                      setIncludeCurrentInRevokeAll(false);
                    }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
                {currentDevice && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCurrentInRevokeAll}
                      onChange={(e) => setIncludeCurrentInRevokeAll(e.target.checked)}
                      className="w-3.5 h-3.5 accent-red-600"
                    />
                    <span className="text-xs text-red-600">
                      {locale === "ar" ? "تسجيل الخروج من هذا الجهاز أيضاً" : "Also logout from this device"}
                    </span>
                  </label>
                )}
              </div>
            ) : (
              <button
                onClick={() => onShowRevokeAllConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("trustedDevices.revokeAll")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm revoking current device modal */}
      {confirmingCurrentDevice && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-2">
            {locale === "ar"
              ? "أنت على وشك إلغاء ثقة الجهاز الحالي. سيتم تسجيل خروجك."
              : "You are about to revoke the current device. You will be logged out."}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmRevokeCurrentDevice}
              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
            >
              {locale === "ar" ? "تأكيد وتسجيل الخروج" : "Confirm & Logout"}
            </button>
            <button
              onClick={() => setConfirmingCurrentDevice(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
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
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                device.isCurrentDevice
                  ? "border-green-200 bg-green-50/50"
                  : "border-[#f0f0f0] hover:border-[#e5e7eb]"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                device.isCurrentDevice
                  ? "bg-green-100 text-green-600"
                  : "bg-[#f8fafc] text-[#737373]"
              }`}>
                {getDeviceIcon(device.deviceName)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className="font-medium text-[#171717] truncate"
                    style={{ fontSize: "14px" }}
                  >
                    {device.deviceName || "Unknown Device"}
                  </p>
                  {device.isCurrentDevice && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold uppercase tracking-wider flex-shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      {locale === "ar" ? "الحالي" : "Current"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {device.ipAddress && (
                    <span
                      className="inline-flex items-center gap-1 text-[#9ca3af]"
                      style={{ fontSize: "12px" }}
                    >
                      <Globe className="w-3 h-3" />
                      {device.ipAddress}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center gap-1 text-[#9ca3af]"
                    style={{ fontSize: "12px" }}
                  >
                    <Clock className="w-3 h-3" />
                    {t("trustedDevices.lastUsed")} {formatDate(device.lastUsedAt)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[#9ca3af]"
                    style={{ fontSize: "12px" }}
                  >
                    <CalendarDays className="w-3 h-3" />
                    {t("trustedDevices.addedOn")} {formatDate(device.createdAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleRevokeDevice(device)}
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
  );
}
