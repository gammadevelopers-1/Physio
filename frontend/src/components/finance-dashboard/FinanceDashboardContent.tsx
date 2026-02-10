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
};

// Mock Revenue Data
const mockRevenueData = {
  gateways: [
    { name: "Tap/Moyasar", percentage: 72, color: "bg-[#3B82F6]" },
    { name: "BNPL (Tamara/Tabby)", percentage: 28, color: "bg-[#22C55E]" },
  ],
  topCourses: [
    { name: "ACLS Training", revenue: "SAR 52K" },
    { name: "First Aid Cert", revenue: "SAR 38K" },
    { name: "CPR Certification", revenue: "SAR 28K" },
    { name: "Emergency Response", revenue: "SAR 24K" },
    { name: "Infection Control", revenue: "SAR 18K" },
  ],
};

// Mock Transactions
const mockTransactions = [
  {
    id: "1",
    invoiceNumber: "INV-2024-0156",
    date: "Feb 10, 2026",
    customer: "Fatima Al-Noor",
    course: "ACLS Training",
    amount: "SAR 1,200",
    gateway: "Tap" as const,
    status: "paid" as const,
  },
  {
    id: "2",
    invoiceNumber: "INV-2024-0155",
    date: "Feb 10, 2026",
    customer: "Omar Abdullah",
    course: "First Aid Cert",
    amount: "SAR 850",
    gateway: "Tamara" as const,
    status: "paid" as const,
  },
  {
    id: "3",
    invoiceNumber: "INV-2024-0154",
    date: "Feb 9, 2026",
    customer: "Layla Hassan",
    course: "CPR Certification",
    amount: "SAR 650",
    gateway: "Moyasar" as const,
    status: "pending" as const,
  },
  {
    id: "4",
    invoiceNumber: "INV-2024-0153",
    date: "Feb 9, 2026",
    customer: "Ahmed Khalid",
    course: "Emergency Response",
    amount: "SAR 980",
    gateway: "Tap" as const,
    status: "failed" as const,
  },
  {
    id: "5",
    invoiceNumber: "INV-2024-0152",
    date: "Feb 8, 2026",
    customer: "Sara Mohammed",
    course: "ACLS Training",
    amount: "SAR 1,200",
    gateway: "Tamara" as const,
    status: "refunded" as const,
  },
];

const FinanceDashboardContent = () => {
  const t = useTranslations("financeDashboard");

  // Mock Refunds Data
  const mockRefunds = [
    {
      id: "1",
      customer: "Ahmed Al-Rashid",
      course: t("courses.aclsTraining"),
      originalAmount: "SAR 950",
      refundAmount: "SAR 850",
      reason: t("refundsQueue.reasons.personal"),
      deduction: t("refundsQueue.deduction", { amount: "SAR 100" }),
    },
    {
      id: "2",
      customer: "Sara Mohammed",
      course: t("courses.firstAidCert"),
      originalAmount: "SAR 500",
      refundAmount: "SAR 450",
      reason: t("refundsQueue.reasons.courseIssue"),
      deduction: t("refundsQueue.deduction", { amount: "SAR 50" }),
    },
    {
      id: "3",
      customer: "Khalid Hassan",
      course: t("courses.cprCert"),
      originalAmount: "SAR 380",
      refundAmount: "SAR 380",
      reason: t("refundsQueue.reasons.technical"),
    },
  ];

  // Mock Transaction Feed
  const mockTransactionFeed = [
    {
      id: "1",
      customer: "Fatima Al-Noor",
      type: "income" as const,
      amount: "SAR 1,200",
      time: t("time.minAgo", { count: 5 }),
    },
    {
      id: "2",
      customer: "Omar Abdullah",
      type: "income" as const,
      amount: "SAR 850",
      time: t("time.minAgo", { count: 15 }),
    },
    {
      id: "3",
      customer: "Sara Mohammed",
      type: "refund" as const,
      amount: "SAR 500",
      time: t("time.hourAgo", { count: 1 }),
    },
    {
      id: "4",
      customer: "Ahmed Khalid",
      type: "failed" as const,
      amount: "SAR 980",
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
      discount: "25% off",
      used: 45,
      limit: 100,
      status: "active" as const,
    },
    {
      id: "2",
      code: "NEWUSER50",
      discount: "SAR 50 off",
      used: 120,
      limit: 200,
      status: "active" as const,
    },
    {
      id: "3",
      code: "ACLS2024",
      discount: "15% off",
      used: 30,
      limit: 50,
      status: "active" as const,
    },
    {
      id: "4",
      code: "SUMMER23",
      discount: "20% off",
      used: 100,
      limit: 100,
      status: "expired" as const,
    },
  ];

  return (
    <>
      {/* Dashboard Navbar */}
      <FinanceNavbar profile={mockProfile} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={mockProfile} />
            </div>

            {/* Mobile Sidebar */}
            <FinanceMobileSidebar profile={mockProfile} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", {
                    name: mockProfile.name.split(" ")[0],
                  })}
                </p>
              </div>

              {/* KPI Cards */}
              <FinanceKPICards data={mockKPIData} />

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
