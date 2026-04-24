"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  CreditCard,
  DollarSign,
  FileText,
  Shield,
  CheckCircle,
  XCircle,
  Save,
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
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [activeTab, setActiveTab] = useState("gateways");

  // Gateway toggle states
  const [gatewayEnabled, setGatewayEnabled] = useState<Record<string, boolean>>({
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

  const tabs = [
    { key: "gateways", label: t("settingsPage.tabs.gateways"), icon: CreditCard },
    { key: "currency", label: t("settingsPage.tabs.currency"), icon: DollarSign },
    { key: "tax", label: t("settingsPage.tabs.tax"), icon: FileText },
    { key: "refundPolicy", label: t("settingsPage.tabs.refundPolicy"), icon: Shield },
  ];

  const gateways = [
    { key: "tap", name: t("settingsPage.gateways.tap"), mode: "live", color: "bg-[var(--color-primary)]" },
    { key: "moyasar", name: t("settingsPage.gateways.moyasar"), mode: "live", color: "bg-[#0891B2]" },
    { key: "tamara", name: t("settingsPage.gateways.tamara"), mode: "test", color: "bg-[#8B5CF6]" },
    { key: "tabby", name: t("settingsPage.gateways.tabby"), mode: "test", color: "bg-[#D97706]" },
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
                            <div key={gw.key} className="p-5 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 ${gw.color} rounded-lg flex items-center justify-center`}>
                                    <CreditCard className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{gw.name}</p>
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
                                <button
                                  onClick={() => setGatewayEnabled((prev) => ({ ...prev, [gw.key]: !prev[gw.key] }))}
                                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${enabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                                >
                                  <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${enabled ? "ms-auto" : ""}`} />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("settingsPage.gateways.apiKey")}</label>
                                  <input
                                    type="password"
                                    defaultValue="sk_live_••••••••••••"
                                    readOnly
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] bg-[var(--color-surface-card)]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("settingsPage.gateways.secretKey")}</label>
                                  <input
                                    type="password"
                                    defaultValue="pk_live_••••••••••••"
                                    readOnly
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] bg-[var(--color-surface-card)]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("settingsPage.gateways.merchantId")}</label>
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
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
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
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.currency.primaryCurrency")}</label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>{t("settingsPage.currency.sar")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.currency.displayFormat")}</label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>{t("currencyFormats.sarFirst")}</option>
                            <option>{t("currencyFormats.sarLast")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.currency.decimalPlaces")}</label>
                          <select className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                            <option>2</option>
                            <option>0</option>
                          </select>
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
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
                        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("settingsPage.tax.vatEnabled")}</p>
                          </div>
                          <button
                            onClick={() => setVatEnabled(!vatEnabled)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${vatEnabled ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${vatEnabled ? "ms-auto" : ""}`} />
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.tax.vatRate")}</label>
                          <input
                            type="number"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-page)] rounded-xl border border-[#F3F4F6]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("settingsPage.tax.taxInclusive")}</p>
                          </div>
                          <button
                            onClick={() => setTaxInclusive(!taxInclusive)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${taxInclusive ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-all ${taxInclusive ? "ms-auto" : ""}`} />
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.tax.taxNumber")}</label>
                          <input
                            type="text"
                            value={taxNumber}
                            onChange={(e) => setTaxNumber(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
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
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.fullRefundDays")}</label>
                          <input
                            type="number"
                            value={fullRefundDays}
                            onChange={(e) => setFullRefundDays(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.partialRefundDays")}</label>
                          <input
                            type="number"
                            value={partialRefundDays}
                            onChange={(e) => setPartialRefundDays(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.partialRefundPercent")}</label>
                          <input
                            type="number"
                            value={partialRefundPercent}
                            onChange={(e) => setPartialRefundPercent(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.bnplDeduction")}</label>
                          <input
                            type="number"
                            value={bnplDeduction}
                            onChange={(e) => setBnplDeduction(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.adminFee")}</label>
                          <input
                            type="number"
                            value={adminFee}
                            onChange={(e) => setAdminFee(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.refundPolicy.autoApproveBelow")}</label>
                          <input
                            type="number"
                            value={autoApproveBelow}
                            onChange={(e) => setAutoApproveBelow(e.target.value)}
                            className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
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
