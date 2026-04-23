"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  Tag,
  Plus,
  TrendingUp,
  BarChart3,
  Percent,
  ShoppingCart,
  Calendar,
  Copy,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

interface Coupon {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usedCount: number;
  usageLimit: number;
  expiryDate: string;
  status: "active" | "expired" | "disabled";
  courseSpecific?: string;
  minOrder?: number;
}

const DiscountsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const stats = [
    {
      label: t("discountsPage.stats.activeCoupons"),
      value: "8",
      icon: Tag,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("discountsPage.stats.totalRedemptions"),
      value: "342",
      icon: ShoppingCart,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("discountsPage.stats.revenueLift"),
      value: "+12%",
      icon: TrendingUp,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("discountsPage.stats.avgDiscount"),
      value: "18%",
      icon: Percent,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    },
  ];

  const coupons: Coupon[] = [
    { id: "1", code: "PHYSIO25", type: "percentage", value: 25, usedCount: 45, usageLimit: 100, expiryDate: t("mockDates.mar31_2026"), status: "active" },
    { id: "2", code: "NEWUSER50", type: "fixed", value: 50, usedCount: 120, usageLimit: 200, expiryDate: t("mockDates.apr15_2026"), status: "active" },
    { id: "3", code: "ACLS2024", type: "percentage", value: 15, usedCount: 30, usageLimit: 50, expiryDate: t("mockDates.feb28_2026"), status: "active", courseSpecific: t("courses.aclsTraining") },
    { id: "4", code: "FIRSTAID10", type: "percentage", value: 10, usedCount: 65, usageLimit: 100, expiryDate: t("mockDates.mar15_2026"), status: "active", courseSpecific: t("courses.firstAidCert") },
    { id: "5", code: "EARLYBIRD", type: "fixed", value: 100, usedCount: 25, usageLimit: 50, expiryDate: t("mockDates.feb20_2026"), status: "active", minOrder: 500 },
    { id: "6", code: "SUMMER23", type: "percentage", value: 20, usedCount: 100, usageLimit: 100, expiryDate: t("mockDates.dec31_2025"), status: "expired" },
    { id: "7", code: "FLASH50", type: "percentage", value: 50, usedCount: 200, usageLimit: 200, expiryDate: t("mockDates.jan15_2026"), status: "expired" },
    { id: "8", code: "PROMO2024", type: "fixed", value: 75, usedCount: 10, usageLimit: 100, expiryDate: t("mockDates.jun30_2026"), status: "disabled" },
  ];

  const tabs = [
    { key: "active", label: t("discountsPage.tabs.active") },
    { key: "expired", label: t("discountsPage.tabs.expired") },
    { key: "disabled", label: t("discountsPage.tabs.disabled") },
    { key: "all", label: t("discountsPage.tabs.all") },
  ];

  const filteredCoupons = coupons.filter((c) =>
    activeTab === "all" ? true : c.status === activeTab
  );

  const statusStyles: Record<string, string> = {
    active: "bg-[#DCFCE7] text-[#16A34A]",
    expired: "bg-[#F3F4F6] text-[#6B7280]",
    disabled: "bg-[#FEE2E2] text-[#DC2626]",
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("discountsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("discountsPage.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t("discountsPage.createCoupon")}
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] font-medium">{stat.label}</p>
                        <p className="text-xl font-bold text-[#111827]">{stat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupons List */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-6">
                {/* Tabs */}
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5 w-fit">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                          activeTab === tab.key
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6B7280] hover:text-[#374151]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coupon Cards */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCoupons.map((coupon) => (
                    <div key={coupon.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-[#FDF6EC] rounded-lg flex items-center justify-center">
                            <Tag className="w-5 h-5 text-[var(--color-primary)]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-[#111827] font-mono">{coupon.code}</p>
                              <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[12px] text-[#6B7280]">
                              {coupon.type === "percentage"
                                ? t("discounts.off", { amount: coupon.value })
                                : t("discounts.fixedOff", { amount: coupon.value })}
                              {coupon.courseSpecific && ` - ${coupon.courseSpecific}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyles[coupon.status]}`}>
                            {t(`discounts.${coupon.status}`)}
                          </span>
                          <div className="relative">
                            <button
                              onClick={() => setOpenActionId(openActionId === coupon.id ? null : coupon.id)}
                              className="w-6 h-6 flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280]"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openActionId === coupon.id && (
                              <div className={`absolute top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[120px] z-20 ${isRTL ? "left-0" : "right-0"}`}>
                                <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#374151] hover:bg-[#F9FAFB]">
                                  <Eye className="w-3.5 h-3.5" />
                                  {t("paymentsTable.actions.view")}
                                </button>
                                <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#374151] hover:bg-[#F9FAFB]">
                                  <Pencil className="w-3.5 h-3.5" />
                                  {t("discountsPage.actions.edit")}
                                </button>
                                <button className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#FEE2E2]">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t("discountsPage.actions.delete")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Usage Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[11px] text-[#6B7280] mb-1">
                          <span>{t("discounts.usage", { used: coupon.usedCount, limit: coupon.usageLimit })}</span>
                          <span>{Math.round((coupon.usedCount / coupon.usageLimit) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-primary)] rounded-full"
                            style={{ width: `${Math.min((coupon.usedCount / coupon.usageLimit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {coupon.expiryDate}
                        </span>
                        {coupon.minOrder && (
                          <span>{t("discounts.minOrder", { amount: coupon.minOrder })}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage Analytics */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-[#111827]">{t("discountsPage.analytics.title")}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-[#F9FAFB] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#111827]">342</p>
                    <p className="text-[12px] text-[#6B7280]">{t("discountsPage.analytics.totalUsage")}</p>
                  </div>
                  <div className="p-4 bg-[#DCFCE7] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#16A34A]">+12%</p>
                    <p className="text-[12px] text-[var(--color-primary)]">{t("discountsPage.analytics.revenueLift")}</p>
                  </div>
                  <div className="p-4 bg-[#FEF9C3] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#CA8A04]">3.2%</p>
                    <p className="text-[12px] text-[#A16207]">{t("discountsPage.analytics.cannibalization")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#111827]">{t("discountsPage.createCoupon")}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#6B7280] hover:text-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.code")}</label>
                <input type="text" placeholder={t("discountsPage.form.codePlaceholder")} className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.type")}</label>
                <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]">
                  <option value="percentage">{t("discountsPage.form.percentage")}</option>
                  <option value="fixed">{t("discountsPage.form.fixedAmount")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.usageLimit")}</label>
                  <input type="number" placeholder="100" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.expiryDate")}</label>
                  <input type="date" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.minOrder")}</label>
                <input type="number" placeholder="0" className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]">
                {t("discountsPage.form.cancel")}
              </button>
              <button className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium">
                {t("discountsPage.form.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscountsContent;
