"use client";

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
} from "lucide-react";

interface TrustedDevicesSectionProps {
  devices: TrustedDevice[];
  revokingId: string | null;
  revokingAll: boolean;
  showRevokeAllConfirm: boolean;
  onRevokeDevice: (deviceId: string) => void;
  onRevokeAll: () => void;
  onShowRevokeAllConfirm: (show: boolean) => void;
}

export default function TrustedDevicesSection({
  devices,
  revokingId,
  revokingAll,
  showRevokeAllConfirm,
  onRevokeDevice,
  onRevokeAll,
  onShowRevokeAllConfirm,
}: TrustedDevicesSectionProps) {
  const t = useTranslations("securitySettings");
  const locale = useLocale();

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
              <div className="flex items-center gap-2">
                <span className="text-[#737373] text-xs hidden sm:inline">
                  {t("trustedDevices.revokeAllConfirm")}
                </span>
                <button
                  onClick={onRevokeAll}
                  disabled={revokingAll}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {revokingAll && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {t("trustedDevices.revokeAll")}
                </button>
                <button
                  onClick={() => onShowRevokeAllConfirm(false)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
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
              className="flex items-center gap-3 p-3 rounded-lg border border-[#f0f0f0] hover:border-[#e5e7eb] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#f8fafc] flex items-center justify-center text-[#737373] flex-shrink-0">
                {getDeviceIcon(device.deviceName)}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="font-medium text-[#171717] truncate"
                  style={{ fontSize: "14px" }}
                >
                  {device.deviceName || "Unknown Device"}
                </p>
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
                onClick={() => onRevokeDevice(device.id)}
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
