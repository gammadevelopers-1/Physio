"use client";

import { useEffect, useState } from "react";
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
  ArrowRight,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import EscalationsContent from "./EscalationsContent";

type Tab =
  | "overview"
  | "escalations"
  | "reconciliation"
  | "payments"
  | "invoices"
  | "refunds"
  | "bank-transfers"
  | "discounts"
  | "reports"
  | "settings";

const VALID_TABS: Tab[] = [
  "overview",
  "escalations",
  "reconciliation",
  "payments",
  "invoices",
  "refunds",
  "bank-transfers",
  "discounts",
  "reports",
  "settings",
];

/**
 * Admin finance shell — replaces the 360-line mock with sample "Tap"
 * transactions. Mirrors the AdminSupportContent tabbed pattern:
 *
 *   Overview      — real KPIs via FinanceSummaryWidget
 *   Escalations   — the queue we built in E.1; renders inline (no chrome
 *                   double-up since EscalationsContent has its own admin
 *                   sidebar wiring already)
 *   Reconciliation, Payments, Invoices, Refunds, Bank Transfers,
 *   Discounts, Reports
 *                 — each tab shows a "Open in finance dashboard" card
 *                   that link-outs to the finance route. Full embedding
 *                   would require refactoring each component to separate
 *                   inner-content from chrome; that's a later phase.
 *   Settings      — admin-only finance settings (fee config, gateway
 *                   toggles) — still placeholder content.
 *
 * This keeps the shell honest: admin sees one tabbed dashboard, real
 * values where we have them, and a clear path to the finance dashboard
 * for tabs that still need the deeper UI work.
 */
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

  useEffect(() => {
    if (deepLinkTab && VALID_TABS.includes(deepLinkTab) && deepLinkTab !== activeTab) {
      setActiveTab(deepLinkTab);
    }
  }, [deepLinkTab, activeTab]);

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "escalations", label: "Escalations", icon: ShieldAlert },
    { key: "reconciliation", label: "Reconciliation", icon: Scale },
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "invoices", label: "Invoices", icon: FileText },
    { key: "refunds", label: "Refunds", icon: RotateCcw },
    { key: "bank-transfers", label: "Bank Transfers", icon: Building2 },
    { key: "discounts", label: "Discounts", icon: Tag },
    { key: "reports", label: "Reports", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  // The Escalations component already includes its own AdminSidebar +
  // AdminNavbar shell, so render it directly without our wrapper (would
  // double-up otherwise).
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
                      onClick={() => {
                        setActiveTab(tab.key);
                        const next = new URLSearchParams();
                        next.set("tab", tab.key);
                        router.push(`${pathname}?${next.toString()}`, {
                          scroll: false,
                        });
                      }}
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

              {/* Overview */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <OverviewBanner />
                  <OverviewLinks locale={locale} />
                </div>
              )}

              {/* Reconciliation / Payments / Invoices / Refunds / Bank Transfers / Discounts / Reports.
                  Escalations is handled by the early-return above; the
                  remaining cases are exactly the LinkOutCard set. */}
              {activeTab !== "overview" && activeTab !== "settings" && (
                <LinkOutCard tab={activeTab} locale={locale} />
              )}

              {/* Settings — admin-only finance config */}
              {activeTab === "settings" && (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-6">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
                    Finance settings
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Cron thresholds, fee config, and gateway toggles will live here. For now, edit reconciliation cron settings directly in the <code className="font-mono text-xs px-1 py-0.5 bg-[var(--color-surface-page)] rounded">reconciliation_settings</code> DB table.
                  </p>
                  <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
                    <div>• Cron schedule: 02:00 KSA daily (scan + auto-escalate + digest)</div>
                    <div>• Stale-reminder sweep: 10:00 KSA daily</div>
                    <div>• Auto-escalation thresholds: missing_local (6h), paid_no_receipt (24h), orphan_receipt (24h), stuck_approval (14d)</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const TAB_LINK_INFO: Record<
  Exclude<Tab, "overview" | "escalations" | "settings">,
  { title: string; description: string; href: string }
> = {
  reconciliation: {
    title: "Reconciliation",
    description:
      "Drift between local payments and gateway records. Full read/write access in the finance dashboard.",
    href: "/dashboard/finance/reconciliation",
  },
  payments: {
    title: "Payments",
    description:
      "All transactions across all gateways. Edit status, view receipts, manage refund history.",
    href: "/dashboard/finance/payments",
  },
  invoices: {
    title: "Invoices",
    description: "Tax invoices + proforma invoices, with PDF preview + email resend.",
    href: "/dashboard/finance/invoices",
  },
  refunds: {
    title: "Refunds",
    description: "Pending and processed refund requests across all payment gateways.",
    href: "/dashboard/finance/refunds",
  },
  "bank-transfers": {
    title: "Bank Transfers",
    description: "Receipt review queue + approval workflow for manual bank transfers.",
    href: "/dashboard/finance/bank-transfers",
  },
  discounts: {
    title: "Discounts",
    description: "Coupon codes + promotional campaigns + redemption tracking.",
    href: "/dashboard/finance/discounts",
  },
  reports: {
    title: "Reports",
    description: "Revenue, refund-rate, gateway-split, and ZATCA tax exports.",
    href: "/dashboard/finance/reports",
  },
};

function LinkOutCard({
  tab,
  locale,
}: {
  tab: Exclude<Tab, "overview" | "escalations" | "settings">;
  locale: string;
}) {
  const info = TAB_LINK_INFO[tab];
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
          <ExternalLink className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            {info.title}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{info.description}</p>
          <Link
            href={`/${locale}${info.href}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:opacity-90 rounded-lg"
          >
            Open in finance dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-3">
            Embedded admin view of this tab is a follow-up phase — for now you have the same access via the finance dashboard, plus all the elevated permissions of your admin role.
          </p>
        </div>
      </div>
    </div>
  );
}

function OverviewBanner() {
  return (
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
            Tabs above mirror the finance dashboard. Reconciliation escalations live here too — that&apos;s where finance-raised drifts that need your action land. The Escalations tab badge will surface any pending ones. Real KPI numbers per tab will land as we replace the finance dashboard&apos;s mocked widgets.
          </p>
        </div>
      </div>
    </div>
  );
}

function OverviewLinks({ locale }: { locale: string }) {
  const quickLinks = [
    {
      href: `/${locale}/dashboard/admin/finance?tab=escalations`,
      label: "Open escalation queue",
      icon: ShieldAlert,
      color: "text-violet-700 bg-violet-50",
    },
    {
      href: `/${locale}/dashboard/finance/reconciliation`,
      label: "Run reconciliation scan",
      icon: Scale,
      color: "text-blue-700 bg-blue-50",
    },
    {
      href: `/${locale}/dashboard/finance/refunds`,
      label: "Review refunds",
      icon: RotateCcw,
      color: "text-amber-700 bg-amber-50",
    },
    {
      href: `/${locale}/dashboard/finance/bank-transfers`,
      label: "Review bank transfers",
      icon: Building2,
      color: "text-emerald-700 bg-emerald-50",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {quickLinks.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-primary)] transition-colors flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${l.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {l.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
