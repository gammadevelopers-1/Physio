"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  RotateCcw,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  TrendingDown,
  AlertCircle,
  MessageSquare,
  DollarSign,
  BarChart3,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

interface RefundRequest {
  id: string;
  customer: string;
  course: string;
  originalAmount: string;
  refundAmount: string;
  reason: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  deduction?: string;
  note?: string;
}

const RefundsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [activeTab, setActiveTab] = useState("pending");

  const stats = [
    {
      label: t("refundsPage.stats.totalRefunds"),
      value: `${t("kpi.sar")} 17K`,
      icon: DollarSign,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      label: t("refundsPage.stats.pendingRefunds"),
      value: "5",
      icon: Clock,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#CA8A04]",
    },
    {
      label: t("refundsPage.stats.approvedRefunds"),
      value: "28",
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: t("refundsPage.stats.refundRate"),
      value: "2.1%",
      icon: BarChart3,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
  ];

  const refunds: RefundRequest[] = [
    { id: "1", customer: t("names.ahmedAlRashid"), course: t("courses.aclsTraining"), originalAmount: `${t("kpi.sar")} 950`, refundAmount: `${t("kpi.sar")} 850`, reason: t("refundsQueue.reasons.personal"), date: t("mockDates.feb10_2026"), status: "pending", deduction: `${t("kpi.sar")} 100 (${t("refundNotes.bnplFee")})` },
    { id: "2", customer: t("names.saraMohammed"), course: t("courses.firstAidCert"), originalAmount: `${t("kpi.sar")} 500`, refundAmount: `${t("kpi.sar")} 450`, reason: t("refundsQueue.reasons.courseIssue"), date: t("mockDates.feb9_2026"), status: "pending", deduction: `${t("kpi.sar")} 50 (${t("refundNotes.adminFee")})` },
    { id: "3", customer: t("names.khalidHassan"), course: t("courses.cprCert"), originalAmount: `${t("kpi.sar")} 380`, refundAmount: `${t("kpi.sar")} 380`, reason: t("refundsQueue.reasons.technical"), date: t("mockDates.feb9_2026"), status: "pending" },
    { id: "4", customer: t("names.laylaNoor"), course: t("courses.emergencyResponse"), originalAmount: `${t("kpi.sar")} 980`, refundAmount: `${t("kpi.sar")} 880`, reason: t("refundsQueue.reasons.duplicate"), date: t("mockDates.feb8_2026"), status: "pending", deduction: `${t("kpi.sar")} 100 (${t("refundNotes.bnplFee")})` },
    { id: "5", customer: t("names.omarFahad"), course: t("courses.infectionControl"), originalAmount: `${t("kpi.sar")} 750`, refundAmount: `${t("kpi.sar")} 750`, reason: t("refundsQueue.reasons.dissatisfied"), date: t("mockDates.feb8_2026"), status: "pending" },
    { id: "6", customer: t("names.fatimaAlNoor"), course: t("courses.aclsTraining"), originalAmount: `${t("kpi.sar")} 1,200`, refundAmount: `${t("kpi.sar")} 1,080`, reason: t("refundsQueue.reasons.personal"), date: t("mockDates.feb7_2026"), status: "approved", deduction: `${t("kpi.sar")} 120 (${t("refundNotes.bnplFee")})` },
    { id: "7", customer: t("names.mohammedAlHarbi"), course: t("courses.firstAidCert"), originalAmount: `${t("kpi.sar")} 500`, refundAmount: `${t("kpi.sar")} 500`, reason: t("refundsQueue.reasons.technical"), date: t("mockDates.feb6_2026"), status: "approved" },
    { id: "8", customer: t("names.nouraAlQahtani"), course: t("courses.cprCert"), originalAmount: `${t("kpi.sar")} 650`, refundAmount: `${t("kpi.sar")} 0`, reason: t("refundsQueue.reasons.personal"), date: t("mockDates.feb5_2026"), status: "rejected", note: t("refundNotes.exceededPeriod") },
  ];

  const tabs = [
    { key: "pending", label: t("refundsPage.tabs.pending"), count: 5 },
    { key: "approved", label: t("refundsPage.tabs.approved"), count: 2 },
    { key: "rejected", label: t("refundsPage.tabs.rejected"), count: 1 },
  ];

  const filteredRefunds = refunds.filter((r) => r.status === activeTab);

  const statusStyles: Record<string, string> = {
    pending: "bg-[#FEF9C3] text-[#CA8A04]",
    approved: "bg-[#DCFCE7] text-[#16A34A]",
    rejected: "bg-[#FEE2E2] text-[#DC2626]",
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
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("refundsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("refundsPage.subtitle")}
                </p>
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

              {/* Deduction Rules */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <h4 className="text-sm font-semibold text-[#92400E]">{t("refundsPage.deductionRules")}</h4>
                </div>
                <ul className="space-y-1 text-[13px] text-[#92400E]">
                  <li>{t("refundsPage.bnplFees", { percent: "5" })}</li>
                  <li>{t("refundsPage.adminFee", { amount: "50" })}</li>
                </ul>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5 w-fit">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 ${
                          activeTab === tab.key
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6B7280] hover:text-[#374151]"
                        }`}
                      >
                        {tab.label}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                          activeTab === tab.key
                            ? "bg-[#a37f49] text-white"
                            : "bg-[#E5E7EB] text-[#6B7280]"
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Refund Items */}
                <div className="p-5 space-y-4">
                  {filteredRefunds.map((refund) => (
                    <div key={refund.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FFEDD5] flex items-center justify-center flex-shrink-0">
                            <RotateCcw className="w-4 h-4 text-[#EA580C]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{refund.customer}</p>
                            <p className="text-[12px] text-[#6B7280]">{refund.course} - {refund.reason}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`${isRTL ? "text-left" : "text-right"}`}>
                            <p className="text-sm font-semibold text-[#111827]">{refund.refundAmount}</p>
                            {refund.originalAmount !== refund.refundAmount && (
                              <p className="text-[11px] text-[#9CA3AF] line-through">{refund.originalAmount}</p>
                            )}
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[refund.status]}`}>
                            {t(`refundsPage.tabs.${refund.status}`)}
                          </span>
                        </div>
                      </div>

                      {/* Deduction + Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-[#6B7280]">
                        <div className="flex items-center gap-3">
                          <span>{refund.date}</span>
                          {refund.deduction && (
                            <span className="flex items-center gap-1 text-[#D97706]">
                              <AlertCircle className="w-3 h-3" />
                              {refund.deduction}
                            </span>
                          )}
                          {refund.note && (
                            <span className="flex items-center gap-1 text-[#DC2626]">
                              <MessageSquare className="w-3 h-3" />
                              {refund.note}
                            </span>
                          )}
                        </div>

                        {/* Actions for pending */}
                        {refund.status === "pending" && (
                          <div className="flex gap-2">
                            <button className="flex items-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-[12px] font-medium rounded-md hover:bg-[#15803D] transition-colors">
                              <Check className="w-3 h-3" />
                              {t("refundsQueue.approve")}
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#DC2626] text-[12px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors">
                              <X className="w-3 h-3" />
                              {t("refundsQueue.reject")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RefundsContent;
