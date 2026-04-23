"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";

export default function SecuritySettingsContent() {
  const t = useTranslations("securitySettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();

  const {
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
  } = useSecuritySettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
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
        className="inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[#1a1a1a] transition-colors mb-6"
        style={{ fontSize: "14px" }}
      >
        <ArrowLeft className="w-4 h-4" />
        {t("back")}
      </button>

      {/* Page Header */}
      <div className="mb-8">
        <h1
          className="font-semibold text-[var(--color-text-primary)] mb-1"
          style={{ fontSize: "24px", lineHeight: "32px" }}
        >
          {t("title")}
        </h1>
        <p className="text-[var(--color-text-secondary)]" style={{ fontSize: "14px" }}>
          {t("description")}
        </p>
      </div>

      {/* 2FA Toggle Card */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 mb-6">
        <TwoFactorToggle
          enabled={twoFactorEnabled}
          toggling={toggling}
          onToggle={handleToggle2FA}
        />
      </div>

      {/* Trusted Devices Card */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-6">
        <TrustedDevicesSection
          devices={devices}
          revokingId={revokingId}
          revokingAll={revokingAll}
          showRevokeAllConfirm={showRevokeAllConfirm}
          onRevokeDevice={handleRevokeDevice}
          onRevokeAll={handleRevokeAll}
          onShowRevokeAllConfirm={setShowRevokeAllConfirm}
          onLogout={handleLogout}
        />
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
