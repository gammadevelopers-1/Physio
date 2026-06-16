"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import Link from "next/link";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";
import { useAuth, useUser } from "@/contexts/AuthContext";
import { profileApi } from "@/lib/api";
import {
  CreditCard,
  DollarSign,
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  Save,
  User as UserIcon,
  Key,
  Eye,
  EyeOff,
  Pencil,
  Mail,
  Phone,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";

const FinanceSettingsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const profile = useFinanceProfile();
  const { refreshUser, logout } = useAuth();
  const user = useUser();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const closeAvatarMenu = useCallback(() => setAvatarMenuOpen(false), []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(e.target as Node)
      ) {
        closeAvatarMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen, closeAvatarMenu]);

  const [activeTab, setActiveTab] = useState("profile");

  // Profile State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  // Sync user data into form
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        phone: user.phone || "",
      });
    }
  }, [user]);

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() ||
      user.email[0].toUpperCase()
    : "";

  // Avatar handlers
  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("settingsPage.profile.saved"));
    } catch {
      toast.error(t("settingsPage.profile.avatarError"));
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("settingsPage.profile.saved"));
    } catch {
      toast.error(t("settingsPage.profile.avatarError"));
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
      });
      await refreshUser();
      toast.success(t("settingsPage.profile.saved"));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Password state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t("settingsPage.profile.passwordRequired"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("settingsPage.profile.passwordMinLength"));
      return;
    }
    setChangingPassword(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success(t("settingsPage.profile.passwordChanged"));
      await logout();
      window.location.href = `/${locale}/signin`;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to change password";
      toast.error(message);
      setChangingPassword(false);
    }
  };

  // Gateway toggle states
  const [gatewayEnabled, setGatewayEnabled] = useState<
    Record<string, boolean>
  >({
    tap: true,
    moyasar: true,
    tamara: true,
    tabby: false,
  });

  // Tax toggle states
  const [vatEnabled, setVatEnabled] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);

  // Tax form states
  const [vatRate, setVatRate] = useState("15");
  const [taxNumber, setTaxNumber] = useState("300000000000003");

  // Refund policy form states
  const [fullRefundDays, setFullRefundDays] = useState("7");
  const [partialRefundDays, setPartialRefundDays] = useState("30");
  const [partialRefundPercent, setPartialRefundPercent] = useState("80");
  const [bnplDeduction, setBnplDeduction] = useState("5");
  const [adminFee, setAdminFee] = useState("50");
  const [autoApproveBelow, setAutoApproveBelow] = useState("200");

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("finance-settings");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.gatewayEnabled) setGatewayEnabled(s.gatewayEnabled);
      if (s.vatEnabled !== undefined) setVatEnabled(s.vatEnabled);
      if (s.taxInclusive !== undefined) setTaxInclusive(s.taxInclusive);
      if (s.vatRate) setVatRate(s.vatRate);
      if (s.taxNumber) setTaxNumber(s.taxNumber);
      if (s.fullRefundDays) setFullRefundDays(s.fullRefundDays);
      if (s.partialRefundDays) setPartialRefundDays(s.partialRefundDays);
      if (s.partialRefundPercent)
        setPartialRefundPercent(s.partialRefundPercent);
      if (s.bnplDeduction) setBnplDeduction(s.bnplDeduction);
      if (s.adminFee) setAdminFee(s.adminFee);
      if (s.autoApproveBelow) setAutoApproveBelow(s.autoApproveBelow);
    } catch {
      /* ignore */
    }
  }, []);

  const saveSection = useCallback(
    (section: string, data: Record<string, unknown>) => {
      try {
        const saved = localStorage.getItem("finance-settings");
        const current = saved ? JSON.parse(saved) : {};
        localStorage.setItem(
          "finance-settings",
          JSON.stringify({ ...current, ...data }),
        );
        toast.success(t("settingsPage.saved"));
      } catch {
        toast.error(t("settingsPage.saveError"));
      }
    },
    [t],
  );

  const tabs = [
    {
      key: "profile",
      label: t("settingsPage.tabs.profile"),
      icon: UserIcon,
    },
    {
      key: "gateways",
      label: t("settingsPage.tabs.gateways"),
      icon: CreditCard,
    },
    {
      key: "currency",
      label: t("settingsPage.tabs.currency"),
      icon: DollarSign,
    },
    {
      key: "tax",
      label: t("settingsPage.tabs.tax"),
      icon: FileText,
    },
    {
      key: "refundPolicy",
      label: t("settingsPage.tabs.refundPolicy"),
      icon: Shield,
    },
  ];

  const gateways = [
    {
      key: "tap",
      name: t("settingsPage.gateways.tap"),
      mode: "live",
      color: "bg-[#3B82F6]",
    },
    {
      key: "moyasar",
      name: t("settingsPage.gateways.moyasar"),
      mode: "live",
      color: "bg-[#0891B2]",
    },
    {
      key: "tamara",
      name: t("settingsPage.gateways.tamara"),
      mode: "test",
      color: "bg-[#8B5CF6]",
    },
    {
      key: "tabby",
      name: t("settingsPage.gateways.tabby"),
      mode: "test",
      color: "bg-[#D97706]",
    },
  ];

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
                <Link
                  href={`/${locale}/dashboard/settings/security`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 rounded-lg transition-colors mt-3"
                >
                  <Shield className="w-4 h-4" />
                  {t("settingsPage.personalSecurity")}
                </Link>
              </div>

              {/* Settings Card */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {/* Tabs */}
                <div className="px-5 overflow-x-auto">
                  <div className="flex flex-wrap border-b border-[var(--color-border)]">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-2.5 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1 ${
                            activeTab === tab.key
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {tab.label}
                          {activeTab === tab.key && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-5">
                  {/* Profile Tab */}
                  {activeTab === "profile" && (
                    <div className="space-y-8">
                      {/* Avatar Section */}
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="relative">
                          {user?.avatar ? (
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                              <Image
                                src={user.avatar}
                                alt={profileData.firstName}
                                width={96}
                                height={96}
                                className="object-cover w-full h-full"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center text-2xl font-bold text-white">
                              {initials}
                            </div>
                          )}
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                          <div ref={avatarMenuRef}>
                            <button
                              onClick={() => setAvatarMenuOpen((v) => !v)}
                              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[var(--color-primary-dark)] transition-colors`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-white" />
                            </button>
                            {avatarMenuOpen && (
                              <div
                                className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}
                              >
                                <button
                                  onClick={() => {
                                    avatarInputRef.current?.click();
                                    setAvatarMenuOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                  {t("settingsPage.profile.uploadPhoto")}
                                </button>
                                {user?.avatar && (
                                  <button
                                    onClick={() => {
                                      handleRemoveAvatar();
                                      setAvatarMenuOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("settingsPage.profile.removePhoto")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {profileData.firstName} {profileData.lastName}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {profileData.email}
                          </p>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settingsPage.profile.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="finance-first-name"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.firstName")}
                            </label>
                            <input
                              id="finance-first-name"
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  firstName: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="finance-last-name"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.lastName")}
                            </label>
                            <input
                              id="finance-last-name"
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({
                                  ...profileData,
                                  lastName: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="finance-email"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="finance-email"
                                type="email"
                                value={profileData.email}
                                readOnly
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] cursor-not-allowed ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor="finance-phone"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="finance-phone"
                                type="tel"
                                value={profileData.phone}
                                onChange={(e) =>
                                  setProfileData({
                                    ...profileData,
                                    phone: e.target.value,
                                  })
                                }
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save Profile Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t("settingsPage.profile.saveChanges")}
                        </button>
                      </div>

                      {/* Divider */}
                      <hr className="border-[var(--color-border)]" />

                      {/* Change Password Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settingsPage.profile.changePassword")}
                        </h4>
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label
                              htmlFor="finance-current-password"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="finance-current-password"
                                type={
                                  showCurrentPassword ? "text" : "password"
                                }
                                value={currentPassword}
                                onChange={(e) =>
                                  setCurrentPassword(e.target.value)
                                }
                                placeholder="••••••••"
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowCurrentPassword(!showCurrentPassword)
                                }
                                className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor="finance-new-password"
                              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                            >
                              {t("settingsPage.profile.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="finance-new-password"
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) =>
                                  setNewPassword(e.target.value)
                                }
                                placeholder="••••••••"
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowNewPassword(!showNewPassword)
                                }
                                className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                              {t("settingsPage.profile.passwordHint")}
                            </p>
                          </div>
                          <button
                            onClick={handleChangePassword}
                            disabled={changingPassword}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#1F2937] hover:bg-[#111827] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {changingPassword ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Key className="w-4 h-4" />
                            )}
                            {t("settingsPage.profile.updatePassword")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Gateways */}
                  {activeTab === "gateways" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.gateways.title")}
                      </h3>
                      <div className="space-y-4">
                        {gateways.map((gw) => {
                          const enabled = gatewayEnabled[gw.key];
                          return (
                            <div
                              key={gw.key}
                              className="p-5 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-10 h-10 ${gw.color} rounded-lg flex items-center justify-center`}
                                  >
                                    <CreditCard className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                      {gw.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {enabled ? (
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
                                          <CheckCircle className="w-3 h-3" />
                                          {t("settingsPage.gateways.enabled")}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[11px] font-medium text-[#DC2626]">
                                          <XCircle className="w-3 h-3" />
                                          {t("settingsPage.gateways.disabled")}
                                        </span>
                                      )}
                                      <span
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                          gw.mode === "live"
                                            ? "bg-[#DCFCE7] text-[#16A34A]"
                                            : "bg-[#FEF9C3] text-[#CA8A04]"
                                        }`}
                                      >
                                        {gw.mode === "live"
                                          ? t("settingsPage.gateways.liveMode")
                                          : t(
                                              "settingsPage.gateways.testMode",
                                            )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    setGatewayEnabled((prev) => ({
                                      ...prev,
                                      [gw.key]: !prev[gw.key],
                                    }))
                                  }
                                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                                >
                                  <div
                                    className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${enabled ? "ms-auto" : ""}`}
                                  />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                                    {t("settingsPage.gateways.apiKey")}
                                  </label>
                                  <input
                                    type="password"
                                    defaultValue="sk_live_••••••••••••"
                                    readOnly
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] bg-[var(--color-surface-card)]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                                    {t("settingsPage.gateways.secretKey")}
                                  </label>
                                  <input
                                    type="password"
                                    defaultValue="pk_live_••••••••••••"
                                    readOnly
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] bg-[var(--color-surface-card)]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                                    {t("settingsPage.gateways.merchantId")}
                                  </label>
                                  <input
                                    type="text"
                                    defaultValue="MID-12345678"
                                    readOnly
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] bg-[var(--color-surface-card)]"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() =>
                          saveSection("gateways", { gatewayEnabled })
                        }
                        className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {t("settingsPage.gateways.save")}
                      </button>
                    </div>
                  )}

                  {/* Currency Settings */}
                  {activeTab === "currency" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.currency.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.currency.primaryCurrency")}
                          </label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>
                              {t("settingsPage.currency.sar")}
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.currency.displayFormat")}
                          </label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>{t("currencyFormats.sarFirst")}</option>
                            <option>{t("currencyFormats.sarLast")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.currency.decimalPlaces")}
                          </label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>2</option>
                            <option>0</option>
                          </select>
                        </div>
                        <button
                          onClick={() => saveSection("currency", {})}
                          className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          {t("settingsPage.gateways.save")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tax Configuration */}
                  {activeTab === "tax" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.tax.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.tax.vatEnabled")}
                            </p>
                          </div>
                          <button
                            onClick={() => setVatEnabled(!vatEnabled)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${vatEnabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div
                              className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${vatEnabled ? "ms-auto" : ""}`}
                            />
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.tax.vatRate")}
                          </label>
                          <input
                            type="number"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.tax.taxInclusive")}
                            </p>
                          </div>
                          <button
                            onClick={() => setTaxInclusive(!taxInclusive)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${taxInclusive ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div
                              className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${taxInclusive ? "ms-auto" : ""}`}
                            />
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.tax.taxNumber")}
                          </label>
                          <input
                            type="text"
                            value={taxNumber}
                            onChange={(e) => setTaxNumber(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <button
                          onClick={() =>
                            saveSection("tax", {
                              vatEnabled,
                              taxInclusive,
                              vatRate,
                              taxNumber,
                            })
                          }
                          className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          {t("settingsPage.gateways.save")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Refund Policy */}
                  {activeTab === "refundPolicy" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.refundPolicy.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.refundPolicy.fullRefundDays")}
                          </label>
                          <input
                            type="number"
                            value={fullRefundDays}
                            onChange={(e) =>
                              setFullRefundDays(e.target.value)
                            }
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t(
                              "settingsPage.refundPolicy.partialRefundDays",
                            )}
                          </label>
                          <input
                            type="number"
                            value={partialRefundDays}
                            onChange={(e) =>
                              setPartialRefundDays(e.target.value)
                            }
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t(
                              "settingsPage.refundPolicy.partialRefundPercent",
                            )}
                          </label>
                          <input
                            type="number"
                            value={partialRefundPercent}
                            onChange={(e) =>
                              setPartialRefundPercent(e.target.value)
                            }
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.refundPolicy.bnplDeduction")}
                          </label>
                          <input
                            type="number"
                            value={bnplDeduction}
                            onChange={(e) =>
                              setBnplDeduction(e.target.value)
                            }
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t("settingsPage.refundPolicy.adminFee")}
                          </label>
                          <input
                            type="number"
                            value={adminFee}
                            onChange={(e) => setAdminFee(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                            {t(
                              "settingsPage.refundPolicy.autoApproveBelow",
                            )}
                          </label>
                          <input
                            type="number"
                            value={autoApproveBelow}
                            onChange={(e) =>
                              setAutoApproveBelow(e.target.value)
                            }
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <button
                          onClick={() =>
                            saveSection("refund", {
                              fullRefundDays,
                              partialRefundDays,
                              partialRefundPercent,
                              bnplDeduction,
                              adminFee,
                              autoApproveBelow,
                            })
                          }
                          className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          {t("settingsPage.refundPolicy.save")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FinanceSettingsContent;
