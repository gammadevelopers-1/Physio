"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  DollarSign,
  CreditCard,
  FileText,
  RotateCcw,
  Building2,
  Tag,
  BarChart3,
  Scale,
  ShieldAlert,
  Settings,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Percent,
  Shield,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import EscalationsContent from "./EscalationsContent";

// Finance dashboard inner components — all support `embedded` prop so they
// render without their own FinanceSidebar/Navbar chrome. We wrap them in
// ActorRoleProvider so admin-only super-actions surface inside drawers/lists.
import {
  PaymentsContent,
  RefundsContent,
  InvoicesContent,
  DiscountsContent,
  ReconciliationContent,
  BankTransferQueueContent,
  FinanceReportsContent,
  AuditLogContent,
  VatTreatmentsContent,
  GatewaysReadOnlyView,
  RefundPolicyView,
  TaxView,
} from "@/components/finance-dashboard";
import { ActorRoleProvider } from "@/components/finance-dashboard/shared/ActorRoleContext";

import { financeApi } from "@/lib/api";
import Money from "@/components/finance-dashboard/shared/Money";
import { FINANCE_COLORS } from "@/components/finance-dashboard/shared/financeColors";
import { KPICardSkeleton } from "@/components/finance-dashboard/shared/Skeleton";

type Tab =
  | "overview"
  | "payments"
  | "invoices"
  | "refunds"
  | "bank-transfers"
  | "discounts"
  | "reconciliation"
  | "escalations"
  | "reports"
  | "audit-log"
  | "settings";

const VALID_TABS: Tab[] = [
  "overview",
  "payments",
  "invoices",
  "refunds",
  "bank-transfers",
  "discounts",
  "reconciliation",
  "escalations",
  "reports",
  "audit-log",
  "settings",
];

type SettingsSubTab = "refund-policy" | "tax" | "vat-treatments" | "gateways";

const VALID_SETTINGS_SUBTABS: SettingsSubTab[] = [
  "refund-policy",
  "tax",
  "vat-treatments",
  "gateways",
];

export default function AdminFinanceShell() {
  const admin = useAdminProfile();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const deepLinkTab = searchParams?.get("tab") as Tab | null;
  const initialTab: Tab =
    deepLinkTab && VALID_TABS.includes(deepLinkTab) ? deepLinkTab : "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const deepLinkSubTab = searchParams?.get("section") as SettingsSubTab | null;
  const initialSubTab: SettingsSubTab =
    deepLinkSubTab && VALID_SETTINGS_SUBTABS.includes(deepLinkSubTab)
      ? deepLinkSubTab
      : "refund-policy";
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>(initialSubTab);

  useEffect(() => {
    if (deepLinkTab && VALID_TABS.includes(deepLinkTab) && deepLinkTab !== activeTab) {
      setActiveTab(deepLinkTab);
    }
  }, [deepLinkTab, activeTab]);

  useEffect(() => {
    if (
      deepLinkSubTab &&
      VALID_SETTINGS_SUBTABS.includes(deepLinkSubTab) &&
      deepLinkSubTab !== settingsSubTab
    ) {
      setSettingsSubTab(deepLinkSubTab);
    }
  }, [deepLinkSubTab, settingsSubTab]);

  const changeTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      const next = new URLSearchParams();
      next.set("tab", tab);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const changeSubTab = useCallback(
    (sub: SettingsSubTab) => {
      setSettingsSubTab(sub);
      const next = new URLSearchParams();
      next.set("tab", "settings");
      next.set("section", sub);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview",       label: "Overview",       icon: LayoutDashboard },
    { key: "payments",       label: "Payments",       icon: CreditCard },
    { key: "invoices",       label: "Invoices",       icon: FileText },
    { key: "refunds",        label: "Refunds",        icon: RotateCcw },
    { key: "bank-transfers", label: "Bank Transfers", icon: Building2 },
    { key: "discounts",      label: "Discounts",      icon: Tag },
    { key: "reconciliation", label: "Reconciliation", icon: Scale },
    { key: "escalations",    label: "Escalations",    icon: ShieldAlert },
    { key: "reports",        label: "Reports",        icon: BarChart3 },
    { key: "audit-log",      label: "Audit Log",      icon: ListChecks },
    { key: "settings",       label: "Settings",       icon: Settings },
  ];

  // Escalations renders its own AdminSidebar/Navbar to avoid double-chrome,
  // so handle it as an early-return outside the normal shell.
  if (activeTab === "escalations") {
    return <EscalationsContent />;
  }

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    Finance
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    Admin super-view across the finance dashboard
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-5 border-b border-[var(--color-border)] overflow-x-auto scrollbar-hide">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => changeTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] whitespace-nowrap ${
                        active
                          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content — wrap every finance content with ActorRoleProvider
                  so inner drawers/lists can surface admin-only super-actions. */}
              <ActorRoleProvider role="admin">
                {activeTab === "overview"       && <OverviewTab locale={locale} onJumpTab={changeTab} />}
                {activeTab === "payments"       && <PaymentsContent embedded />}
                {activeTab === "invoices"       && <InvoicesContent embedded />}
                {activeTab === "refunds"        && <RefundsContent embedded />}
                {activeTab === "bank-transfers" && <BankTransferQueueContent embedded />}
                {activeTab === "discounts"      && <DiscountsContent embedded />}
                {activeTab === "reconciliation" && <ReconciliationContent embedded />}
                {activeTab === "reports"        && <FinanceReportsContent embedded />}
                {activeTab === "audit-log"      && <AuditLogContent embedded />}
                {activeTab === "settings" && (
                  <SettingsTab
                    activeSubTab={settingsSubTab}
                    onChangeSubTab={changeSubTab}
                    locale={locale}
                  />
                )}
              </ActorRoleProvider>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Overview — admin-side dashboard summary ────────────────────────

function OverviewTab({
  locale,
  onJumpTab,
}: {
  locale: string;
  onJumpTab: (tab: Tab) => void;
}) {
  const [summary, setSummary] = useState<{
    totalRevenue: number;
    totalPayments: number;
    pendingPayments: number;
    pendingAmount: number;
    awaitingApprovalCount: number;
    awaitingApprovalAmount: number;
    failedPayments: number;
  } | null>(null);
  const [refundRate, setRefundRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([financeApi.getSummary(), financeApi.getRefundRate()])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary({
          totalRevenue: Number(s?.totalRevenue || 0),
          totalPayments: Number(s?.totalPayments || 0),
          pendingPayments: Number(s?.pendingPayments || 0),
          pendingAmount: Number(s?.pendingAmount || 0),
          awaitingApprovalCount: Number(s?.awaitingApprovalCount || 0),
          awaitingApprovalAmount: Number(s?.awaitingApprovalAmount || 0),
          failedPayments: Number(s?.failedPayments || 0),
        });
        setRefundRate(parseFloat(r?.refundRate || "0"));
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPendingCount =
    (summary?.pendingPayments || 0) + (summary?.awaitingApprovalCount || 0);
  const totalPendingAmount =
    (summary?.pendingAmount || 0) + (summary?.awaitingApprovalAmount || 0);

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-transparent border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              Admin finance hub
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Every tab above mirrors the finance dashboard — same data, same
              actions, plus admin-only overrides surfaced in row drawers and
              detail panels. Edit gateways under <Link href={`/${locale}/dashboard/admin/settings`} className="text-[var(--color-primary)] hover:underline">Admin Settings → Payments</Link>.
            </p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <OverviewKPI
              label="Total revenue"
              icon={TrendingUp}
              iconBg={FINANCE_COLORS.success.bg}
              iconColor={FINANCE_COLORS.success.text}
              value={<Money amount={summary?.totalRevenue || 0} decimals={0} iconSize={20} />}
              sub={`${(summary?.totalPayments || 0).toLocaleString("en-US")} payments`}
              onClick={() => onJumpTab("payments")}
            />
            <OverviewKPI
              label="Pending review"
              icon={Receipt}
              iconBg={FINANCE_COLORS.warning.bg}
              iconColor={FINANCE_COLORS.warning.text}
              value={totalPendingCount.toLocaleString("en-US")}
              sub={<Money amount={totalPendingAmount} decimals={0} iconSize={11} className="text-xs text-[var(--color-text-secondary)]" />}
              onClick={() => onJumpTab("payments")}
            />
            <OverviewKPI
              label="Failed"
              icon={ShieldAlert}
              iconBg={FINANCE_COLORS.error.bg}
              iconColor={FINANCE_COLORS.error.text}
              value={(summary?.failedPayments || 0).toLocaleString("en-US")}
              sub="Needs attention"
              onClick={() => onJumpTab("payments")}
            />
            <OverviewKPI
              label="Refund rate"
              icon={RotateCcw}
              iconBg={FINANCE_COLORS.violet.bg}
              iconColor={FINANCE_COLORS.violet.text}
              value={`${(refundRate || 0).toFixed(1)}%`}
              sub="By amount"
              onClick={() => onJumpTab("refunds")}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Quick actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={ShieldAlert}
            label="Review escalations"
            color="text-violet-700 bg-violet-50"
            onClick={() => onJumpTab("escalations")}
          />
          <QuickActionCard
            icon={Scale}
            label="Run reconciliation scan"
            color="text-blue-700 bg-blue-50"
            onClick={() => onJumpTab("reconciliation")}
          />
          <QuickActionCard
            icon={RotateCcw}
            label="Process refunds"
            color="text-amber-700 bg-amber-50"
            onClick={() => onJumpTab("refunds")}
          />
          <QuickActionCard
            icon={Building2}
            label="Review bank transfers"
            color="text-emerald-700 bg-emerald-50"
            onClick={() => onJumpTab("bank-transfers")}
          />
        </div>
      </div>
    </div>
  );
}

function OverviewKPI({
  label,
  icon: Icon,
  iconBg,
  iconColor,
  value,
  sub,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3 text-left hover:border-[var(--color-primary)] transition-colors"
    >
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</p>
        <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-primary)] transition-colors flex items-center gap-3 text-left"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
    </button>
  );
}

// ─── Settings — admin finance settings sub-tabs ──────────────────────

function SettingsTab({
  activeSubTab,
  onChangeSubTab,
  locale,
}: {
  activeSubTab: SettingsSubTab;
  onChangeSubTab: (sub: SettingsSubTab) => void;
  locale: string;
}) {
  const SUB_TABS: {
    key: SettingsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: "refund-policy",   label: "Refund Policy",  icon: Shield },
    { key: "tax",             label: "Tax & VAT",      icon: Percent },
    { key: "vat-treatments",  label: "VAT Treatments", icon: FileText },
    { key: "gateways",        label: "Gateways",       icon: CreditCard },
  ];

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Sub-tabs */}
      <div className="px-5 overflow-x-auto">
        <div className="flex flex-wrap border-b border-[var(--color-border)]">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChangeSubTab(tab.key)}
                className={`px-3 py-2.5 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1 ${
                  active
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {activeSubTab === "refund-policy" && <RefundPolicyView />}
        {activeSubTab === "tax" && <TaxView />}
        {activeSubTab === "vat-treatments" && <VatTreatmentsContent embedded />}
        {activeSubTab === "gateways" && <GatewaysAdminCallout locale={locale} />}
      </div>
    </div>
  );
}

// Admin Settings → Payments is the real editor for gateway credentials.
// This sub-tab shows the same read-only projection finance sees, plus a
// prominent call-out to the editor where admins actually change keys.
function GatewaysAdminCallout({ locale }: { locale: string }) {
  return (
    <div className="space-y-5">
      <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Edit gateway credentials in Admin Settings
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 mb-3">
            Secrets and webhook tokens are managed under <strong>Admin Settings → Payments</strong>. Changes there flow through the live payment runtime within seconds.
          </p>
          <Link
            href={`/${locale}/dashboard/admin/settings?tab=payments`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-md hover:opacity-90"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open gateway editor
          </Link>
        </div>
      </div>
      <GatewaysReadOnlyView />
    </div>
  );
}
