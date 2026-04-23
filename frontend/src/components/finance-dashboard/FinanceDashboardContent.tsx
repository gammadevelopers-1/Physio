"use client";

import { useTranslations } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import FinanceKPICards from "./FinanceKPICards";
import RevenueSummaryWidget from "./RevenueSummaryWidget";
import PaymentsInvoicesTable from "./PaymentsInvoicesTable";
import RefundsQueueWidget from "./RefundsQueueWidget";
import FinanceRightSidebar from "./FinanceRightSidebar";

// Mock Finance Profile
const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

// Mock KPI Data
const mockKPIData = {
  revenueMTD: 245000,
  revenueTrend: 12,
  netRevenue: 228000,
  avgOrderValue: 890,
  avgOrderTrend: 5,
  pendingInvoices: 12,
  pendingInvoicesAmount: 15680,
  refundRate: 2.1,
  refundRateTrend: -0.3,
  totalTransactions: 384,
  totalTransactionsPeriod: "",
};

const FinanceDashboardContent = () => {
  const t = useTranslations("financeDashboard");

  const profile = { ...mockProfile, name: t("names.noraAlFahad") };

  // Mock Revenue Data
  const mockRevenueData = {
    gateways: [
      { name: t("revenueSummary.tapMoyasar"), percentage: 72, color: "bg-[#3B82F6]" },
      { name: t("revenueSummary.bnplTamara"), percentage: 28, color: "bg-[#22C55E]" },
    ],
    topCourses: [
      { name: t("courses.aclsTraining"), revenue: `${t("kpi.sar")} 52K` },
      { name: t("courses.firstAidCert"), revenue: `${t("kpi.sar")} 38K` },
      { name: t("courses.cprCert"), revenue: `${t("kpi.sar")} 28K` },
      { name: t("courses.emergencyResponse"), revenue: `${t("kpi.sar")} 24K` },
      { name: t("courses.infectionControl"), revenue: `${t("kpi.sar")} 18K` },
    ],
  };

  // Mock Transactions
  const mockTransactions = [
    {
      id: "1",
      invoiceNumber: "INV-2024-0156",
      date: t("mockDates.feb10_2026"),
      customer: t("names.fatimaAlNoor"),
      course: t("courses.aclsTraining"),
      amount: `${t("kpi.sar")} 1,200`,
      gateway: "Tap" as const,
      status: "paid" as const,
    },
    {
      id: "2",
      invoiceNumber: "INV-2024-0155",
      date: t("mockDates.feb10_2026"),
      customer: t("names.omarAbdullah"),
      course: t("courses.firstAidCert"),
      amount: `${t("kpi.sar")} 850`,
      gateway: "Tamara" as const,
      status: "paid" as const,
    },
    {
      id: "3",
      invoiceNumber: "INV-2024-0154",
      date: t("mockDates.feb9_2026"),
      customer: t("names.laylaHassan"),
      course: t("courses.cprCert"),
      amount: `${t("kpi.sar")} 650`,
      gateway: "Moyasar" as const,
      status: "pending" as const,
    },
    {
      id: "4",
      invoiceNumber: "INV-2024-0153",
      date: t("mockDates.feb9_2026"),
      customer: t("names.ahmedKhalid"),
      course: t("courses.emergencyResponse"),
      amount: `${t("kpi.sar")} 980`,
      gateway: "Tap" as const,
      status: "failed" as const,
    },
    {
      id: "5",
      invoiceNumber: "INV-2024-0152",
      date: t("mockDates.feb8_2026"),
      customer: t("names.saraMohammed"),
      course: t("courses.aclsTraining"),
      amount: `${t("kpi.sar")} 1,200`,
      gateway: "Tamara" as const,
      status: "refunded" as const,
    },
  ];

  // Mock Refunds Data
  const mockRefunds = [
    {
      id: "1",
      customer: t("names.ahmedAlRashid"),
      course: t("courses.aclsTraining"),
      originalAmount: `${t("kpi.sar")} 950`,
      refundAmount: `${t("kpi.sar")} 850`,
      reason: t("refundsQueue.reasons.personal"),
      deduction: t("refundsQueue.deduction", { amount: `${t("kpi.sar")} 100` }),
    },
    {
      id: "2",
      customer: t("names.saraMohammed"),
      course: t("courses.firstAidCert"),
      originalAmount: `${t("kpi.sar")} 500`,
      refundAmount: `${t("kpi.sar")} 450`,
      reason: t("refundsQueue.reasons.courseIssue"),
      deduction: t("refundsQueue.deduction", { amount: `${t("kpi.sar")} 50` }),
    },
    {
      id: "3",
      customer: t("names.khalidHassan"),
      course: t("courses.cprCert"),
      originalAmount: `${t("kpi.sar")} 380`,
      refundAmount: `${t("kpi.sar")} 380`,
      reason: t("refundsQueue.reasons.technical"),
    },
  ];

  // Mock Transaction Feed
  const mockTransactionFeed = [
    {
      id: "1",
      customer: t("names.fatimaAlNoor"),
      type: "income" as const,
      amount: `${t("kpi.sar")} 1,200`,
      time: t("time.minAgo", { count: 5 }),
    },
    {
      id: "2",
      customer: t("names.omarAbdullah"),
      type: "income" as const,
      amount: `${t("kpi.sar")} 850`,
      time: t("time.minAgo", { count: 15 }),
    },
    {
      id: "3",
      customer: t("names.saraMohammed"),
      type: "refund" as const,
      amount: `${t("kpi.sar")} 500`,
      time: t("time.hourAgo", { count: 1 }),
    },
    {
      id: "4",
      customer: t("names.ahmedKhalid"),
      type: "failed" as const,
      amount: `${t("kpi.sar")} 980`,
      time: t("time.hoursAgo", { count: 2 }),
    },
  ];

  // Mock Alerts
  const mockAlerts = [
    {
      id: "1",
      type: "error" as const,
      title: t("financialAlerts.failedPayments", { count: 3 }),
      description: t("financialAlerts.failedPaymentsDesc"),
    },
    {
      id: "2",
      type: "warning" as const,
      title: t("financialAlerts.pendingInvoices", { count: 12 }),
      description: t("financialAlerts.pendingInvoicesDesc", {
        amount: "15,680",
      }),
    },
    {
      id: "3",
      type: "warning" as const,
      title: t("financialAlerts.chargeback", { count: 1 }),
      description: t("financialAlerts.chargebackDesc"),
    },
  ];

  // Mock Coupons
  const mockCoupons = [
    {
      id: "1",
      code: "PHYSIO25",
      discount: t("discounts.off", { amount: 25 }),
      used: 45,
      limit: 100,
      status: "active" as const,
    },
    {
      id: "2",
      code: "NEWUSER50",
      discount: t("discounts.fixedOff", { amount: 50 }),
      used: 120,
      limit: 200,
      status: "active" as const,
    },
    {
      id: "3",
      code: "ACLS2024",
      discount: t("discounts.off", { amount: 15 }),
      used: 30,
      limit: 50,
      status: "active" as const,
    },
    {
      id: "4",
      code: "SUMMER23",
      discount: t("discounts.off", { amount: 20 }),
      used: 100,
      limit: 100,
      status: "expired" as const,
    },
  ];

  return (
    <>
      {/* Dashboard Navbar */}
      <FinanceNavbar profile={profile} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            {/* Mobile Sidebar */}
            <FinanceMobileSidebar profile={profile} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", {
                    name: profile.name.split(" ")[0],
                  })}
                </p>
              </div>

              {/* KPI Cards */}
              <FinanceKPICards data={{ ...mockKPIData, totalTransactionsPeriod: t("kpi.thisMonth") }} />

              {/* Revenue Summary + Refunds Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <RevenueSummaryWidget data={mockRevenueData} />
                </div>
                <div className="lg:col-span-2">
                  <RefundsQueueWidget refunds={mockRefunds} />
                </div>
              </div>

              {/* Payments & Invoices Table */}
              <PaymentsInvoicesTable transactions={mockTransactions} />
            </div>

            {/* Right Sidebar */}
            <FinanceRightSidebar
              transactions={mockTransactionFeed}
              alerts={mockAlerts}
              coupons={mockCoupons}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default FinanceDashboardContent;
