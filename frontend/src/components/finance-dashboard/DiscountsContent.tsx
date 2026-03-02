"use client";

import { useState, useEffect, useCallback } from "react";
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
  Pencil,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { discountApi } from "@/lib/api";

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
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed">("percentage");
  const [formValue, setFormValue] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.getAll(1, 50);
      const mapped: Coupon[] = (res.data || []).map((d: any) => {
        const now = new Date();
        const validUntil = d.validUntil ? new Date(d.validUntil) : null;
        let status: Coupon["status"] = "active";
        if (!d.isActive) status = "disabled";
        else if (validUntil && validUntil < now) status = "expired";

        return {
          id: d.id,
          code: d.code,
          type: d.type as "percentage" | "fixed",
          value: Number(d.value),
          usedCount: d.currentUses || 0,
          usageLimit: d.maxUses || 0,
          expiryDate: validUntil
            ? validUntil.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })
            : "-",
          status,
          courseSpecific: d.courseTitle || undefined,
          minOrder: d.minOrderAmount ? Number(d.minOrderAmount) : undefined,
        };
      });
      setCoupons(mapped);
    } catch {
      // Keep empty
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeCount = coupons.filter((c) => c.status === "active").length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  const stats = [
    { label: t("discountsPage.stats.activeCoupons"), value: activeCount.toString(), icon: Tag, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
    { label: t("discountsPage.stats.totalRedemptions"), value: totalRedemptions.toString(), icon: ShoppingCart, iconBg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" },
    { label: t("discountsPage.stats.revenueLift"), value: "-", icon: TrendingUp, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
    { label: t("discountsPage.stats.avgDiscount"), value: "-", icon: Percent, iconBg: "bg-[#FEF3C7]", iconColor: "text-[#D97706]" },
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

  const handleCreate = async () => {
    if (!formCode || !formValue) return;
    setCreating(true);
    try {
      await discountApi.create({
        code: formCode,
        type: formType,
        value: Number(formValue),
        maxUses: formLimit ? Number(formLimit) : undefined,
        validUntil: formExpiry || undefined,
        minOrderAmount: formMinOrder ? Number(formMinOrder) : undefined,
      });
      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch {}
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await discountApi.delete(id);
      await fetchData();
    } catch {}
    setOpenActionId(null);
  };

  const resetForm = () => {
    setFormCode("");
    setFormType("percentage");
    setFormValue("");
    setFormLimit("");
    setFormExpiry("");
    setFormMinOrder("");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
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
                        <p className="text-xl font-bold text-[#111827]">{loading ? "..." : stat.value}</p>
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
                <div className="p-5">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                    </div>
                  ) : filteredCoupons.length === 0 ? (
                    <p className="text-center text-[#6B7280] py-8">{t("discountsPage.noCoupons") || "No discount codes found"}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredCoupons.map((coupon) => (
                        <div key={coupon.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-[#FDF6EC] rounded-lg flex items-center justify-center">
                                <Tag className="w-5 h-5 text-[#a37f49]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-[#111827] font-mono">{coupon.code}</p>
                                  <button onClick={() => handleCopyCode(coupon.code)} className="text-[#9CA3AF] hover:text-[#6B7280]">
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
                                    <button
                                      onClick={() => handleDelete(coupon.id)}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[#DC2626] hover:bg-[#FEE2E2]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {t("discountsPage.actions.delete")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Usage Bar */}
                          {coupon.usageLimit > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-[11px] text-[#6B7280] mb-1">
                                <span>{t("discounts.usage", { used: coupon.usedCount, limit: coupon.usageLimit })}</span>
                                <span>{Math.round((coupon.usedCount / coupon.usageLimit) * 100)}%</span>
                              </div>
                              <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#a37f49] rounded-full"
                                  style={{ width: `${Math.min((coupon.usedCount / coupon.usageLimit) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

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
                  )}
                </div>
              </div>

              {/* Usage Analytics */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[#a37f49]" />
                  <h3 className="text-base font-semibold text-[#111827]">{t("discountsPage.analytics.title")}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-[#F9FAFB] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#111827]">{totalRedemptions}</p>
                    <p className="text-[12px] text-[#6B7280]">{t("discountsPage.analytics.totalUsage")}</p>
                  </div>
                  <div className="p-4 bg-[#DCFCE7] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#16A34A]">{activeCount}</p>
                    <p className="text-[12px] text-[#a37f49]">{t("discountsPage.stats.activeCoupons")}</p>
                  </div>
                  <div className="p-4 bg-[#FEF9C3] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#CA8A04]">{coupons.length}</p>
                    <p className="text-[12px] text-[#A16207]">{t("discountsPage.tabs.all")}</p>
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
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="text-[#6B7280] hover:text-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.code")}</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder={t("discountsPage.form.codePlaceholder")}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.type")}</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "percentage" | "fixed")}
                    className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                  >
                    <option value="percentage">{t("discountsPage.form.percentage")}</option>
                    <option value="fixed">{t("discountsPage.form.fixedAmount")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{formType === "percentage" ? "%" : `${t("kpi.sar")}`}</label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder={formType === "percentage" ? "25" : "50"}
                    className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.usageLimit")}</label>
                  <input
                    type="number"
                    value={formLimit}
                    onChange={(e) => setFormLimit(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.expiryDate")}</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("discountsPage.form.minOrder")}</label>
                <input
                  type="number"
                  value={formMinOrder}
                  onChange={(e) => setFormMinOrder(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#a37f49]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                {t("discountsPage.form.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formCode || !formValue}
                className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
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
