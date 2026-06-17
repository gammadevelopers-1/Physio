"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Search,
  Download,
  Layers,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { discountApi } from "@/lib/api";
import { toast } from "sonner";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

interface Coupon {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  usedCount: number;
  usageLimit: number;
  expiryDate: string;
  validUntilRaw: string | null;
  status: "active" | "expired" | "disabled";
  courseSpecific?: string;
  minOrder?: number;
  totalSaved: number;
  isActive: boolean;
  applicableCourses: string[];
  perUserLimit?: number;
  campaign?: string | null;
}

interface Analytics {
  totalSavings: number;
  avgDiscountPerUse: number;
  totalRedemptions: number;
  revenueLift: {
    withCoupon: number;
    withoutCoupon: number;
    liftPercentage: number;
  };
  topCoupons: Array<{
    id: string;
    code: string;
    type: string;
    value: number;
    isActive: boolean;
    conversions: number;
    totalSaved: number;
  }>;
}

interface SimpleCourse {
  id: string;
  title: string;
}

const DiscountsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();
  const [activeTab, setActiveTab] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [courses, setCourses] = useState<SimpleCourse[]>([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const limit = 10;

  // Create form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed">("percentage");
  const [formValue, setFormValue] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [formPerUser, setFormPerUser] = useState("");
  const [formCampaign, setFormCampaign] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formCourseIds, setFormCourseIds] = useState<string[]>([]);

  // Bulk form state
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkType, setBulkType] = useState<"percentage" | "fixed">("percentage");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLimit, setBulkLimit] = useState("");
  const [bulkCampaign, setBulkCampaign] = useState("");
  const [bulkExpiry, setBulkExpiry] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.getAll(page, limit, {
        status: activeTab !== "all" ? activeTab : undefined,
        search: searchQuery || undefined,
      });
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
          validUntilRaw: d.validUntil || null,
          status,
          courseSpecific: d.courseTitle || undefined,
          minOrder: d.minOrderAmount ? Number(d.minOrderAmount) : undefined,
          totalSaved: Number(d.totalSaved || 0),
          isActive: d.isActive,
          applicableCourses: d.applicableCourses || [],
          perUserLimit: d.maxUsesPerUser ?? undefined,
          campaign: d.campaign ?? null,
        };
      });
      setCoupons(mapped);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    } catch {
      // Keep empty
    } finally {
      setLoading(false);
    }
  }, [locale, page, activeTab, searchQuery]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await discountApi.getAnalytics();
      setAnalytics(data);
    } catch {
      // Keep null
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const { publicApi } = await import("@/lib/api");
      const res = await publicApi.getCourses({ limit: 100 });
      if (res?.data) {
        setCourses(res.data.map((c: any) => ({ id: c.id, title: c.title || c.titleEn || c.titleAr || "Untitled" })));
      }
    } catch {
      // Courses not available
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchAnalytics();
    fetchCourses();
  }, [fetchAnalytics, fetchCourses]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
    }, 300);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };

  const stats = [
    {
      label: t("discountsPage.stats.activeCoupons"),
      value: analytics ? String(coupons.filter(c => c.status === "active").length) : "...",
      icon: Tag,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("discountsPage.stats.totalRedemptions"),
      value: analytics ? String(analytics.totalRedemptions) : "...",
      icon: ShoppingCart,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("discountsPage.stats.revenueLift"),
      value: analytics ? `${analytics.revenueLift.liftPercentage > 0 ? "+" : ""}${analytics.revenueLift.liftPercentage}%` : "...",
      icon: TrendingUp,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("discountsPage.stats.avgDiscount"),
      value: analytics ? `SAR ${analytics.avgDiscountPerUse.toFixed(0)}` : "...",
      icon: Percent,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    },
  ];

  const tabs = [
    { key: "active", label: t("discountsPage.tabs.active") },
    { key: "expired", label: t("discountsPage.tabs.expired") },
    { key: "disabled", label: t("discountsPage.tabs.disabled") },
    { key: "all", label: t("discountsPage.tabs.all") },
  ];

  const statusStyles: Record<string, string> = {
    active: "bg-[#DCFCE7] text-[#16A34A]",
    expired: "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]",
    disabled: "bg-[#FEE2E2] text-[#DC2626]",
  };

  const handleToggle = async (coupon: Coupon) => {
    try {
      await discountApi.update(coupon.id, { isActive: !coupon.isActive });
      toast.success(
        coupon.isActive
          ? (t("discountsPage.toggle.disable") || "Disabled")
          : (t("discountsPage.toggle.enable") || "Enabled")
      );
      await fetchData();
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const handleSave = async () => {
    if (!formCode || !formValue) return;
    setSaving(true);
    try {
      const payload: any = {
        code: formCode,
        type: formType,
        value: Number(formValue),
        maxUses: formLimit ? Number(formLimit) : undefined,
        maxUsesPerUser: formPerUser ? Number(formPerUser) : undefined,
        campaign: formCampaign.trim() || undefined,
        validUntil: formExpiry || undefined,
        minOrderAmount: formMinOrder ? Number(formMinOrder) : undefined,
        courseIds: formCourseIds.length > 0 ? formCourseIds : undefined,
      };

      if (editingId) {
        await discountApi.update(editingId, payload);
        toast.success(t("discountsPage.editSuccess") || "Discount updated successfully");
      } else {
        await discountApi.create(payload);
        toast.success(t("discountsPage.createSuccess") || "Discount created successfully");
      }
      closeModal();
      await fetchData();
      await fetchAnalytics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save discount");
    }
    setSaving(false);
  };

  const handleBulkGenerate = async () => {
    if (!bulkPrefix || !bulkValue || !bulkCount) return;
    setBulkSaving(true);
    try {
      const result = await discountApi.bulkGenerate({
        prefix: bulkPrefix,
        count: Number(bulkCount),
        type: bulkType,
        value: Number(bulkValue),
        maxUses: bulkLimit ? Number(bulkLimit) : undefined,
        campaign: bulkCampaign.trim() || undefined,
        validUntil: bulkExpiry || undefined,
      });
      toast.success(t("discountsPage.bulk.success", { count: result.created }) || `${result.created} discount codes created`);
      setShowBulkModal(false);
      setBulkPrefix("");
      setBulkCount("10");
      setBulkValue("");
      setBulkLimit("");
      setBulkCampaign("");
      setBulkExpiry("");
      await fetchData();
      await fetchAnalytics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk generation failed");
    }
    setBulkSaving(false);
  };

  const handleExport = async () => {
    try {
      await discountApi.export({
        status: activeTab !== "all" ? activeTab : undefined,
        search: searchQuery || undefined,
      });
      toast.success(t("discountsPage.exportSuccess") || "Export downloaded");
    } catch {
      toast.error(t("discountsPage.exportError") || "Export failed");
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setFormCode(coupon.code);
    setFormType(coupon.type);
    setFormValue(String(coupon.value));
    setFormLimit(coupon.usageLimit ? String(coupon.usageLimit) : "");
    setFormExpiry(coupon.validUntilRaw ? coupon.validUntilRaw.slice(0, 10) : "");
    setFormMinOrder(coupon.minOrder ? String(coupon.minOrder) : "");
    setFormCourseIds(coupon.applicableCourses || []);
    setFormPerUser(coupon.perUserLimit ? String(coupon.perUserLimit) : "");
    setFormCampaign(coupon.campaign || "");
    setShowModal(true);
    setOpenActionId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await discountApi.delete(id);
      toast.success(t("discountsPage.deleteSuccess") || "Discount deleted");
      await fetchData();
      await fetchAnalytics();
    } catch {}
    setOpenActionId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormCode("");
    setFormType("percentage");
    setFormValue("");
    setFormLimit("");
    setFormExpiry("");
    setFormMinOrder("");
    setFormPerUser("");
    setFormCampaign("");
    setFormCourseIds([]);
    setShowCourseDropdown(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    toast.success("Copied!");
  };

  const toggleCourseSelection = (courseId: string) => {
    setFormCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const maxTopSaved = analytics?.topCoupons?.[0]?.totalSaved || 1;

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("discountsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("discountsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t("discountsPage.export") || "Export CSV"}
                  </button>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    {t("discountsPage.bulkGenerate") || "Bulk Generate"}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("discountsPage.createCoupon")}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div key={index} className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
                      <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{stat.label}</p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupons List */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                {/* Tabs + Search */}
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 w-fit">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                          activeTab === tab.key
                            ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t("discountsPage.searchPlaceholder") || "Search by code..."}
                      className={`w-full sm:w-56 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                    />
                  </div>
                </div>

                {/* Coupon Cards */}
                <div className="p-5">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-[#B8860B] animate-spin" />
                    </div>
                  ) : coupons.length === 0 ? (
                    <p className="text-center text-[var(--color-text-secondary)] py-8">{t("discountsPage.noCoupons") || "No discount codes found"}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {coupons.map((coupon) => (
                        <div key={coupon.id} className="p-4 bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border-subtle)] relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-[var(--color-surface-page)] rounded-lg flex items-center justify-center">
                                <Tag className="w-5 h-5 text-[var(--color-primary)]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{coupon.code}</p>
                                  <button onClick={() => handleCopyCode(coupon.code)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-[12px] text-[var(--color-text-secondary)]">
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
                              {/* Toggle */}
                              <button
                                onClick={() => handleToggle(coupon)}
                                title={coupon.isActive ? (t("discountsPage.toggle.disable") || "Disable") : (t("discountsPage.toggle.enable") || "Enable")}
                                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                              >
                                {coupon.isActive ? (
                                  <ToggleRight className="w-5 h-5 text-[#16A34A]" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5 text-[#DC2626]" />
                                )}
                              </button>
                              <div className="relative">
                                <button
                                  onClick={() => setOpenActionId(openActionId === coupon.id ? null : coupon.id)}
                                  className="w-6 h-6 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openActionId === coupon.id && (
                                  <div className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[120px] z-20 ${isRTL ? "left-0" : "right-0"}`}>
                                    <button
                                      onClick={() => handleEdit(coupon)}
                                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      {t("discountsPage.actions.edit") || "Edit"}
                                    </button>
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
                              <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                                <span>{t("discounts.usage", { used: coupon.usedCount, limit: coupon.usageLimit })}</span>
                                <span>{Math.round((coupon.usedCount / coupon.usageLimit) * 100)}%</span>
                              </div>
                              <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[var(--color-primary)] rounded-full"
                                  style={{ width: `${Math.min((coupon.usedCount / coupon.usageLimit) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)] flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {coupon.expiryDate}
                            </span>
                            {coupon.minOrder && coupon.minOrder > 0 && (
                              <span>{t("discounts.minOrder", { amount: coupon.minOrder })}</span>
                            )}
                            {coupon.totalSaved > 0 && (
                              <span className="text-[#16A34A] font-medium">
                                {t("discountsPage.totalSaved", { amount: coupon.totalSaved.toFixed(0) }) || `SAR ${coupon.totalSaved.toFixed(0)} saved`}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>
                      {t("discountsPage.showing") || "Showing"} {(page - 1) * limit + 1}-{Math.min(page * limit, total)} {t("discountsPage.of") || "of"} {total}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-1.5 rounded-md hover:bg-[var(--color-surface-page)] disabled:opacity-30"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      <span className="px-2 text-[13px] font-medium">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded-md hover:bg-[var(--color-surface-page)] disabled:opacity-30"
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Usage Analytics */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("discountsPage.analytics.title")}</h3>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-[var(--color-surface-page)] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      SAR {analytics ? analytics.totalSavings.toFixed(0) : "..."}
                    </p>
                    <p className="text-[12px] text-[var(--color-text-secondary)]">{t("discountsPage.analytics.totalSavings") || "Total Savings"}</p>
                  </div>
                  <div className="p-4 bg-[#DCFCE7] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#16A34A]">
                      {analytics ? analytics.totalRedemptions : "..."}
                    </p>
                    <p className="text-[12px] text-[var(--color-primary)]">{t("discountsPage.stats.totalRedemptions")}</p>
                  </div>
                  <div className="p-4 bg-[#FEF9C3] rounded-xl text-center">
                    <p className="text-2xl font-bold text-[#CA8A04]">
                      SAR {analytics ? analytics.avgDiscountPerUse.toFixed(0) : "..."}
                    </p>
                    <p className="text-[12px] text-[#A16207]">{t("discountsPage.analytics.avgPerUse") || "Avg. Discount/Use"}</p>
                  </div>
                </div>

                {/* Top Coupons Performance */}
                {analytics && analytics.topCoupons.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                      {t("discountsPage.analytics.topCoupons") || "Top Performing Coupons"}
                    </h4>
                    <div className="space-y-2">
                      {analytics.topCoupons.filter(c => c.conversions > 0).slice(0, 5).map((coupon) => (
                        <div key={coupon.id} className="flex items-center gap-3">
                          <span className="text-[12px] font-mono font-bold text-[var(--color-text-primary)] w-28 truncate">{coupon.code}</span>
                          <div className="flex-1">
                            <div className="h-5 bg-[var(--color-surface-page)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-primary)] rounded-full flex items-center justify-end px-2"
                                style={{ width: `${Math.max((coupon.totalSaved / maxTopSaved) * 100, 10)}%` }}
                              >
                                <span className="text-[10px] text-white font-medium whitespace-nowrap">
                                  SAR {coupon.totalSaved.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] text-[var(--color-text-secondary)] w-20 text-right">
                            {coupon.conversions} {t("discountsPage.analytics.conversions") || "uses"}
                          </span>
                        </div>
                      ))}
                      {analytics.topCoupons.filter(c => c.conversions > 0).length === 0 && (
                        <p className="text-[12px] text-[var(--color-text-secondary)] text-center py-2">
                          {t("discountsPage.noCoupons") || "No usage data yet"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Coupon Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {editingId ? (t("discountsPage.editCoupon") || "Edit Discount") : t("discountsPage.createCoupon")}
              </h3>
              <button onClick={closeModal} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.code")}</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder={t("discountsPage.form.codePlaceholder")}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.type")}</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "percentage" | "fixed")}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="percentage">{t("discountsPage.form.percentage")}</option>
                    <option value="fixed">{t("discountsPage.form.fixedAmount")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{formType === "percentage" ? "%" : `${t("kpi.sar")}`}</label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder={formType === "percentage" ? "25" : "50"}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.usageLimit")}</label>
                  <input
                    type="number"
                    value={formLimit}
                    onChange={(e) => setFormLimit(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.expiryDate")}</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.perUserLimit") || "Per-user limit"}</label>
                  <input
                    type="number"
                    min="1"
                    value={formPerUser}
                    onChange={(e) => setFormPerUser(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.campaign") || "Campaign"}</label>
                  <input
                    type="text"
                    value={formCampaign}
                    onChange={(e) => setFormCampaign(e.target.value)}
                    placeholder="Summer 2026"
                    maxLength={100}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.minOrder")}</label>
                <input
                  type="number"
                  value={formMinOrder}
                  onChange={(e) => setFormMinOrder(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* Course Selector */}
              {courses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {t("discountsPage.form.courses") || "Applicable Courses"}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                      className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-left focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-card)]"
                    >
                      {formCourseIds.length === 0
                        ? (t("discountsPage.form.allCourses") || "All Courses")
                        : `${formCourseIds.length} course${formCourseIds.length > 1 ? "s" : ""} selected`}
                    </button>
                    {showCourseDropdown && (
                      <div className="absolute z-30 top-full mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => { setFormCourseIds([]); setShowCourseDropdown(false); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] border-b border-[var(--color-border-subtle)]"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${formCourseIds.length === 0 ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                            {formCourseIds.length === 0 && <Check className="w-3 h-3 text-white" />}
                          </span>
                          {t("discountsPage.form.allCourses") || "All Courses"}
                        </button>
                        {courses.map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => toggleCourseSelection(course.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${formCourseIds.includes(course.id) ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
                              {formCourseIds.includes(course.id) && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="truncate">{course.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
              >
                {t("discountsPage.form.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formCode || !formValue}
                className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? (t("discountsPage.form.save") || "Save") : t("discountsPage.form.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t("discountsPage.bulk.title") || "Bulk Generate Coupons"}
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t("discountsPage.bulk.prefix") || "Code Prefix"}
                </label>
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                  placeholder={t("discountsPage.bulk.prefixPlaceholder") || "e.g., HEALTH"}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
                {bulkPrefix && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t("discountsPage.bulk.preview", { prefix: bulkPrefix }) || `Preview: ${bulkPrefix}-XXXXXX`}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {t("discountsPage.bulk.count") || "Number of Codes"}
                  </label>
                  <input
                    type="number"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(e.target.value)}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.type")}</label>
                  <select
                    value={bulkType}
                    onChange={(e) => setBulkType(e.target.value as "percentage" | "fixed")}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="percentage">{t("discountsPage.form.percentage")}</option>
                    <option value="fixed">{t("discountsPage.form.fixedAmount")}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{bulkType === "percentage" ? "%" : "SAR"}</label>
                  <input
                    type="number"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={bulkType === "percentage" ? "25" : "50"}
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.usageLimit")}</label>
                  <input
                    type="number"
                    value={bulkLimit}
                    onChange={(e) => setBulkLimit(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.expiryDate")}</label>
                <input
                  type="date"
                  value={bulkExpiry}
                  onChange={(e) => setBulkExpiry(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{t("discountsPage.form.campaign") || "Campaign"}</label>
                <input
                  type="text"
                  value={bulkCampaign}
                  onChange={(e) => setBulkCampaign(e.target.value)}
                  placeholder="Summer 2026"
                  maxLength={100}
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
              >
                {t("discountsPage.form.cancel")}
              </button>
              <button
                onClick={handleBulkGenerate}
                disabled={bulkSaving || !bulkPrefix || !bulkValue || !bulkCount}
                className="flex-1 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("discountsPage.bulk.generate", { count: bulkCount }) || `Generate ${bulkCount} Codes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscountsContent;
