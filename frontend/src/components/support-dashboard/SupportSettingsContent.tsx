"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import SupportNavbar from "./SupportNavbar";
import {
  ShieldCheck,
  Shield,
  UserPlus,
  MessageSquare,
  Bell,
  Tag,
  Save,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

const SupportSettingsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };
  const [activeTab, setActiveTab] = useState("sla");

  // SLA Target states
  const [highFRT, setHighFRT] = useState(1);
  const [highResolution, setHighResolution] = useState(4);
  const [medFRT, setMedFRT] = useState(2);
  const [medResolution, setMedResolution] = useState(6);
  const [lowFRT, setLowFRT] = useState(4);
  const [lowResolution, setLowResolution] = useState(12);

  // Auto-assignment states
  const [selectedRule, setSelectedRule] = useState("roundRobin");
  const [ruleEnabled, setRuleEnabled] = useState<Record<string, boolean>>({
    roundRobin: true,
    leastBusy: false,
    skillBased: false,
  });

  // Notification toggle states
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [whatsappNotif, setWhatsappNotif] = useState(true);

  const tabs = [
    { key: "sla", label: t("settingsPage.tabs.sla"), icon: ShieldCheck },
    { key: "assignment", label: t("settingsPage.tabs.assignment"), icon: UserPlus },
    { key: "macros", label: t("settingsPage.tabs.macros"), icon: MessageSquare },
    { key: "notifications", label: t("settingsPage.tabs.notifications"), icon: Bell },
    { key: "categories", label: t("settingsPage.tabs.categories"), icon: Tag },
  ];

  const assignmentRules = [
    {
      key: "roundRobin",
      title: t("settingsPage.assignment.rules.roundRobin"),
      description: t("settingsPage.assignment.rules.roundRobinDesc"),
    },
    {
      key: "leastBusy",
      title: t("settingsPage.assignment.rules.leastBusy"),
      description: t("settingsPage.assignment.rules.leastBusyDesc"),
    },
    {
      key: "skillBased",
      title: t("settingsPage.assignment.rules.skillBased"),
      description: t("settingsPage.assignment.rules.skillBasedDesc"),
    },
  ];

  const macros = [
    { id: "1", name: t("settingsPage.macros.items.greeting"), content: t("settingsPage.macros.contents.greeting"), category: "general" },
    { id: "2", name: t("settingsPage.macros.items.refundProcess"), content: t("settingsPage.macros.contents.refundProcess"), category: "billing" },
    { id: "3", name: t("settingsPage.macros.items.passwordReset"), content: t("settingsPage.macros.contents.passwordReset"), category: "login" },
    { id: "4", name: t("settingsPage.macros.items.escalation"), content: t("settingsPage.macros.contents.escalation"), category: "general" },
  ];

  const categories = [
    { name: t("ticketsBoard.categories.billing"), description: t("settingsPage.categories.descriptions.billing"), tickets: 45 },
    { name: t("ticketsBoard.categories.login"), description: t("settingsPage.categories.descriptions.login"), tickets: 38 },
    { name: t("ticketsBoard.categories.certificate"), description: t("settingsPage.categories.descriptions.certificate"), tickets: 28 },
    { name: t("ticketsBoard.categories.content"), description: t("settingsPage.categories.descriptions.content"), tickets: 22 },
    { name: t("ticketsBoard.categories.technical"), description: t("settingsPage.categories.descriptions.technical"), tickets: 18 },
  ];

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} />
            </div>

            <SupportMobileSidebar profile={profile} />

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
                  Personal Security Settings
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
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
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
                  {/* SLA Targets */}
                  {activeTab === "sla" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.sla.title")}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.priority")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.firstResponseTarget")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.resolutionTarget")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEE2E2] text-[#DC2626]">
                                  {t("settingsPage.sla.high")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={highFRT}
                                    onChange={(e) => setHighFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={highResolution}
                                    onChange={(e) => setHighResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEF9C3] text-[#CA8A04]">
                                  {t("settingsPage.sla.medium")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={medFRT}
                                    onChange={(e) => setMedFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={medResolution}
                                    onChange={(e) => setMedResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#DCFCE7] text-[#16A34A]">
                                  {t("settingsPage.sla.low")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={lowFRT}
                                    onChange={(e) => setLowFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={lowResolution}
                                    onChange={(e) => setLowResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)]"
                                  />
                                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Auto-Assignment */}
                  {activeTab === "assignment" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.assignment.title")}
                      </h3>
                      <div className="space-y-4">
                        {assignmentRules.map((rule) => {
                          const isActive = selectedRule === rule.key;
                          const enabled = ruleEnabled[rule.key];
                          return (
                            <div
                              key={rule.key}
                              onClick={() => setSelectedRule(rule.key)}
                              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                                isActive
                                  ? "ring-1 ring-[var(--color-primary)] border-[var(--color-primary)] bg-[#FDF6EC]"
                                  : "border-[var(--color-border)] bg-[var(--color-surface-page)] hover:border-[var(--color-border)]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      isActive ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                                    }`}
                                  >
                                    {isActive && (
                                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                                    )}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-semibold ${isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                                      {rule.title}
                                    </p>
                                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                                      {rule.description}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRuleEnabled((prev) => ({ ...prev, [rule.key]: !prev[rule.key] }));
                                  }}
                                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                                    enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                                  }`}
                                >
                                  <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${enabled ? "ms-auto" : ""}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Canned Responses */}
                  {activeTab === "macros" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.macros.title")}
                        </h3>
                        <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("settingsPage.macros.addMacro")}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {macros.map((macro) => (
                          <div key={macro.id} className="p-5 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{macro.name}</p>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-border-subtle)] text-[var(--color-primary)]">
                                    {macro.category}
                                  </span>
                                </div>
                                <p className="text-[13px] text-[var(--color-text-secondary)] line-clamp-2">{macro.content}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-[var(--color-text-secondary)] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Notifications */}
                  {activeTab === "notifications" && (
                    <div>
                      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("settingsPage.notifications.title")}
                      </h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("settingsPage.notifications.email")}</p>
                              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t("settingsPage.notifications.emailDesc")}</p>
                            </div>
                            <button
                              onClick={() => setEmailNotif(!emailNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${emailNotif ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                            >
                              <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${emailNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("settingsPage.notifications.sms")}</p>
                              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t("settingsPage.notifications.smsDesc")}</p>
                            </div>
                            <button
                              onClick={() => setSmsNotif(!smsNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${smsNotif ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                            >
                              <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${smsNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("settingsPage.notifications.whatsapp")}</p>
                              <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t("settingsPage.notifications.whatsappDesc")}</p>
                            </div>
                            <button
                              onClick={() => setWhatsappNotif(!whatsappNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${whatsappNotif ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                            >
                              <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${whatsappNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Categories */}
                  {activeTab === "categories" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.categories.title")}
                        </h3>
                        <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("settingsPage.categories.addCategory")}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.name")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.description")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.tickets")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map((category, index) => (
                              <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[var(--color-surface-page)]">
                                <td className="py-3 px-5 text-[13px] font-medium text-[var(--color-text-primary)]">{category.name}</td>
                                <td className="py-3 px-5 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{category.description}</td>
                                <td className="py-3 px-5 text-[13px] font-semibold text-[var(--color-text-primary)]">{category.tickets}</td>
                                <td className="py-3 px-5">
                                  <div className="flex items-center gap-2">
                                    <button className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button className="p-1.5 text-[var(--color-text-secondary)] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
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

export default SupportSettingsContent;
