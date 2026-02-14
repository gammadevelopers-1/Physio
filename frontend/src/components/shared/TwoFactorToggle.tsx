"use client";

import { useTranslations, useLocale } from "next-intl";
import { Shield, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

interface TwoFactorToggleProps {
  enabled: boolean;
  toggling: boolean;
  onToggle: () => void;
}

export default function TwoFactorToggle({
  enabled,
  toggling,
  onToggle,
}: TwoFactorToggleProps) {
  const t = useTranslations("securitySettings");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <div className="flex items-start gap-4">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          enabled
            ? "bg-green-50 text-green-600"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {enabled ? (
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
              enabled
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {enabled ? t("twoFactor.enabled") : t("twoFactor.disabled")}
          </span>
        </div>
        <p
          className="text-[#737373] mb-4"
          style={{ fontSize: "13px", lineHeight: "1.5" }}
        >
          {t("twoFactor.description")}
        </p>

        <button
          onClick={onToggle}
          disabled={toggling}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            enabled
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "text-white hover:opacity-90"
          }`}
          style={
            !enabled
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
          {enabled ? t("twoFactor.disable") : t("twoFactor.enable")}
        </button>
      </div>
    </div>
  );
}
