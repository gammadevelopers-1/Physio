"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  Shield,
  Lock,
  Ban,
  Users,
  KeyRound,
  AlertTriangle,
  Eye,
  LogOut,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const SecurityContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Mock Security Data with translations
  const mockFailedLogins = [
    { id: "1", user: "sara.m@student.physio.edu.sa", ip: "192.168.1.105", time: t("securityPage.time.minAgo", { count: 5 }), attempts: 5 },
    { id: "2", user: "unknown@test.com", ip: "103.45.67.89", time: t("securityPage.time.minAgo", { count: 15 }), attempts: 12 },
    { id: "3", user: "ahmed.k@physio.edu.sa", ip: "192.168.1.42", time: t("securityPage.time.hourAgo", { count: 1 }), attempts: 3 },
  ];

  const mockBlockedIPs = [
    { id: "1", ip: "103.45.67.89", reason: t("securityPage.reasons.bruteForce"), blockedAt: t("securityPage.time.minAgo", { count: 15 }), type: t("securityPage.types.auto") },
    { id: "2", ip: "45.33.22.11", reason: t("securityPage.reasons.suspicious"), blockedAt: t("securityPage.time.hoursAgo", { count: 2 }), type: t("securityPage.types.manual") },
    { id: "3", ip: "89.123.45.67", reason: t("securityPage.reasons.rateLimit"), blockedAt: t("securityPage.time.dayAgo", { count: 1 }), type: t("securityPage.types.auto") },
  ];

  const mockActiveSessions = [
    { id: "1", user: t("securityPage.sampleUsers.drFaisal"), device: "Chrome / Windows", ip: "192.168.1.50", lastActive: t("securityPage.time.minAgo", { count: 2 }) },
    { id: "2", user: t("securityPage.sampleUsers.saraMohammed"), device: "Safari / iOS", ip: "192.168.1.102", lastActive: t("securityPage.time.minAgo", { count: 5 }) },
    { id: "3", user: t("securityPage.sampleUsers.mohammedAlKhalid"), device: "Firefox / macOS", ip: "192.168.1.78", lastActive: t("securityPage.time.minAgo", { count: 10 }) },
    { id: "4", user: t("securityPage.sampleUsers.admin"), device: "Chrome / Windows", ip: "192.168.1.1", lastActive: t("securityPage.time.now") },
  ];

  const [activeTab, setActiveTab] = useState<"overview" | "logins" | "blocked" | "sessions">("overview");

  const stats = {
    failedLogins24h: 23,
    ipsBlocked: 5,
    activeSessions: 342,
    twoFaAdoption: 76,
    securityScore: 85,
  };

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("securityPage.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("securityPage.subtitle")}
                </p>
              </div>

              {/* Security Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-[#D97706]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.failedLogins24h}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("securityPage.stats.failedLogins")}</p>
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.ipsBlocked}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("securityPage.stats.ipsBlocked")}</p>
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.activeSessions}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("securityPage.stats.activeSessions")}</p>
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="w-5 h-5 text-[#16A34A]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.twoFaAdoption}%</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("securityPage.stats.twoFa")}</p>
                </div>

                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.securityScore}%</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("securityPage.stats.score")}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                  {(["overview", "logins", "blocked", "sessions"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === tab
                          ? "text-[#002D87] border-b-2 border-[#002D87]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {t(`securityPage.tabs.${tab}`)}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      {/* Security Alerts */}
                      <div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("securityPage.alerts")}
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 p-4 bg-[#FEE2E2] rounded-lg border border-[#FCA5A5]">
                            <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-[#991B1B]">
                                {t("securityPage.alertMessages.bruteForce")}
                              </p>
                              <p className="text-xs text-[#B91C1C] mt-1">{t("securityPage.time.minAgo", { count: 5 })}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-4 bg-[#FEF3C7] rounded-lg border border-[#FCD34D]">
                            <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-[#92400E]">
                                {t("securityPage.alertMessages.lowTwoFa")}
                              </p>
                              <p className="text-xs text-[#A16207] mt-1">{t("securityPage.time.hourAgo", { count: 1 })}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* OWASP Compliance */}
                      <div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("securityPage.owaspCompliance")}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {["injection", "authentication", "xss", "csrf", "encryption", "logging"].map((item) => (
                            <div key={item} className="flex items-center gap-2 p-3 bg-[#DCFCE7] rounded-lg">
                              <Shield className="w-4 h-4 text-[#16A34A]" />
                              <span className="text-sm text-[#166534]">{t(`securityPage.owasp.${item}`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "logins" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t("securityPage.failedLoginAttempts")}
                        </h3>
                      </div>
                      <table className="w-full">
                        <thead className="bg-[var(--color-surface-page)]">
                          <tr>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.user")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.ip")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.attempts")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.time")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockFailedLogins.map((login) => (
                            <tr key={login.id} className="border-b border-[#F3F4F6]">
                              <td className="px-4 py-4 text-sm text-[var(--color-text-primary)]">{login.user}</td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)] font-mono">{login.ip}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${login.attempts >= 5 ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#FEF3C7] text-[#D97706]"}`}>
                                  {login.attempts}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{login.time}</td>
                              <td className="px-4 py-4">
                                <button className="text-sm text-[#DC2626] hover:underline">
                                  {t("securityPage.actions.blockIp")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "blocked" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t("securityPage.blockedIps")}
                        </h3>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF]">
                          <Plus className="w-4 h-4" />
                          {t("securityPage.addToBlocklist")}
                        </button>
                      </div>
                      <table className="w-full">
                        <thead className="bg-[var(--color-surface-page)]">
                          <tr>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.ip")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.reason")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.type")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.blockedAt")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockBlockedIPs.map((ip) => (
                            <tr key={ip.id} className="border-b border-[#F3F4F6]">
                              <td className="px-4 py-4 text-sm text-[var(--color-text-primary)] font-mono">{ip.ip}</td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{ip.reason}</td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${ip.type === "auto" ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"}`}>
                                  {ip.type}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{ip.blockedAt}</td>
                              <td className="px-4 py-4">
                                <button className="text-sm text-[#16A34A] hover:underline">
                                  {t("securityPage.actions.unblock")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTab === "sessions" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t("securityPage.activeSessions")}
                        </h3>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm text-[#DC2626] border border-[#DC2626] rounded-lg hover:bg-[#FEE2E2]">
                          <LogOut className="w-4 h-4" />
                          {t("securityPage.terminateAll")}
                        </button>
                      </div>
                      <table className="w-full">
                        <thead className="bg-[var(--color-surface-page)]">
                          <tr>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.user")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.device")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.ip")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.lastActive")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("securityPage.table.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockActiveSessions.map((session) => (
                            <tr key={session.id} className="border-b border-[#F3F4F6]">
                              <td className="px-4 py-4 text-sm text-[var(--color-text-primary)]">{session.user}</td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{session.device}</td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)] font-mono">{session.ip}</td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">{session.lastActive}</td>
                              <td className="px-4 py-4">
                                <button className="text-sm text-[#DC2626] hover:underline">
                                  {t("securityPage.actions.terminate")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

export default SecurityContent;
