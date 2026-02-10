"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  Settings,
  CreditCard,
  DollarSign,
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

const FinanceSettingsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState("gateways");

  const tabs = [
    { key: "gateways", label: t("settingsPage.tabs.gateways"), icon: CreditCard },
    { key: "currency", label: t("settingsPage.tabs.currency"), icon: DollarSign },
    { key: "tax", label: t("settingsPage.tabs.tax"), icon: FileText },
    { key: "refundPolicy", label: t("settingsPage.tabs.refundPolicy"), icon: Shield },
  ];

  const gateways = [
    { key: "tap", name: t("settingsPage.gateways.tap"), enabled: true, mode: "live", color: "bg-[#3B82F6]" },
    { key: "moyasar", name: t("settingsPage.gateways.moyasar"), enabled: true, mode: "live", color: "bg-[#0891B2]" },
    { key: "tamara", name: t("settingsPage.gateways.tamara"), enabled: true, mode: "test", color: "bg-[#8B5CF6]" },
    { key: "tabby", name: t("settingsPage.gateways.tabby"), enabled: false, mode: "test", color: "bg-[#D97706]" },
  ];

  return (
    <>
      <FinanceNavbar profile={mockProfile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={mockProfile} />
            </div>

            <FinanceMobileSidebar profile={mockProfile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
              </div>

              {/* Settings Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                {/* Tabs */}
                <div className="px-5 py-4 border-b border-[#F3F4F6] overflow-x-auto">
                  <div className="flex gap-1 min-w-max">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                            activeTab === tab.key
                              ? "bg-[#ECFDF5] text-[#059669]"
                              : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-5">
                  {/* Payment Gateways */}
                  {activeTab === "gateways" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.gateways.title")}
                      </h3>
                      <div className="space-y-4">
                        {gateways.map((gw) => (
                          <div key={gw.key} className="p-5 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${gw.color} rounded-lg flex items-center justify-center`}>
                                  <CreditCard className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#111827]">{gw.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {gw.enabled ? (
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
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                      gw.mode === "live"
                                        ? "bg-[#DCFCE7] text-[#16A34A]"
                                        : "bg-[#FEF9C3] text-[#CA8A04]"
                                    }`}>
                                      {gw.mode === "live" ? t("settingsPage.gateways.liveMode") : t("settingsPage.gateways.testMode")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button className="text-[#6B7280] hover:text-[#374151]">
                                {gw.enabled ? (
                                  <ToggleRight className="w-8 h-8 text-[#059669]" />
                                ) : (
                                  <ToggleLeft className="w-8 h-8 text-[#D1D5DB]" />
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[12px] text-[#6B7280] mb-1">{t("settingsPage.gateways.apiKey")}</label>
                                <input
                                  type="password"
                                  value="sk_live_••••••••••••"
                                  readOnly
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[12px] text-[#6B7280] mb-1">{t("settingsPage.gateways.secretKey")}</label>
                                <input
                                  type="password"
                                  value="pk_live_••••••••••••"
                                  readOnly
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[12px] text-[#6B7280] mb-1">{t("settingsPage.gateways.merchantId")}</label>
                                <input
                                  type="text"
                                  value="MID-12345678"
                                  readOnly
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.gateways.save")}
                      </button>
                    </div>
                  )}

                  {/* Currency Settings */}
                  {activeTab === "currency" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.currency.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.currency.primaryCurrency")}</label>
                          <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]">
                            <option>{t("settingsPage.currency.sar")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.currency.displayFormat")}</label>
                          <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]">
                            <option>SAR 1,234.56</option>
                            <option>1,234.56 SAR</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.currency.decimalPlaces")}</label>
                          <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]">
                            <option>2</option>
                            <option>0</option>
                          </select>
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                          <Save className="w-4 h-4" />
                          {t("settingsPage.gateways.save")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tax Configuration */}
                  {activeTab === "tax" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.tax.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{t("settingsPage.tax.vatEnabled")}</p>
                          </div>
                          <ToggleRight className="w-8 h-8 text-[#059669] cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.tax.vatRate")}</label>
                          <input type="number" value="15" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{t("settingsPage.tax.taxInclusive")}</p>
                          </div>
                          <ToggleLeft className="w-8 h-8 text-[#D1D5DB] cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.tax.taxNumber")}</label>
                          <input type="text" value="300000000000003" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                          <Save className="w-4 h-4" />
                          {t("settingsPage.gateways.save")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Refund Policy */}
                  {activeTab === "refundPolicy" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.refundPolicy.title")}
                      </h3>
                      <div className="max-w-md space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.fullRefundDays")}</label>
                          <input type="number" value="7" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.partialRefundDays")}</label>
                          <input type="number" value="30" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.partialRefundPercent")}</label>
                          <input type="number" value="80" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.bnplDeduction")}</label>
                          <input type="number" value="5" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.adminFee")}</label>
                          <input type="number" value="50" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1">{t("settingsPage.refundPolicy.autoApproveBelow")}</label>
                          <input type="number" value="200" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#059669]" />
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
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
