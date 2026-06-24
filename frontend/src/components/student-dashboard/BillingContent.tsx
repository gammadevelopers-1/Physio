"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import {
  studentFinanceApi,
  type StudentFinancePolicySnapshot,
} from "@/lib/api";
import BillingOverviewTab from "./billing/BillingOverviewTab";
import BillingPaymentsTab from "./billing/BillingPaymentsTab";
import BillingInvoicesTab from "./billing/BillingInvoicesTab";
import BillingRefundsTab from "./billing/BillingRefundsTab";
import PaymentDetailDrawer from "./billing/PaymentDetailDrawer";

type TabKey = "overview" | "payments" | "invoices" | "refunds";

const TAB_ORDER: TabKey[] = ["overview", "payments", "invoices", "refunds"];

/**
 * Student "Billing" — umbrella surface for payments, invoices, refunds,
 * and tax info. Lives at `/dashboard/student/billing`.
 *
 * Tab + drawer state is mirrored to URL query params so:
 *   - Deep links from course pages (?payment=<id>) open the drawer
 *   - Browser back/forward navigates between tabs
 *   - Refresh preserves whatever the student was looking at
 *
 * Policy snapshot is fetched ONCE here and threaded down — it's the
 * source of truth for refund rules + gateway availability and is needed
 * by Overview (policy summary, methods block) and the drawer (refund
 * eligibility copy). 60s client cache.
 */
const BillingContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-driven tab + drawer state. URL is the source of truth so the back
  // button and shared deep-links behave correctly.
  const rawTab = (searchParams.get("tab") as TabKey | null) ?? "overview";
  const activeTab: TabKey = TAB_ORDER.includes(rawTab) ? rawTab : "overview";
  const openPaymentId = searchParams.get("payment");

  const [policy, setPolicy] = useState<StudentFinancePolicySnapshot | null>(
    null,
  );
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    setPolicyLoading(true);
    setPolicyError(null);
    try {
      const data = await studentFinanceApi.getPolicySnapshot();
      setPolicy(data);
    } catch (err) {
      setPolicyError(
        err instanceof Error ? err.message : t("common.loadFailed"),
      );
    } finally {
      setPolicyLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const setTab = useCallback(
    (next: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "overview") sp.delete("tab");
      else sp.set("tab", next);
      // Closing tab change should also drop any open drawer so it
      // doesn't ghost across tabs.
      sp.delete("payment");
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const openDrawer = useCallback(
    (paymentId: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("payment", paymentId);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const closeDrawer = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("payment");
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const tabs = useMemo(
    () =>
      TAB_ORDER.map((key) => ({
        key,
        label: t(`tabs.${key}`),
      })),
    [t],
  );

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>
            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Page header */}
              <header
                className={`mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-5 h-5 text-[var(--color-primary)]" />
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                    {t("title")}
                  </h1>
                </div>
                <p className="text-sm text-[#6B7280]">{t("subtitle")}</p>
              </header>

              {/* Tab bar */}
              <nav
                className="bg-white rounded-xl border border-[#E5E7EB] mb-4 overflow-x-auto"
                aria-label={t("title")}
              >
                <div
                  className="flex min-w-max"
                  dir={isRTL ? "rtl" : "ltr"}
                  role="tablist"
                >
                  {tabs.map((tab) => {
                    const selected = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setTab(tab.key)}
                        className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                          selected
                            ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                            : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Tab panel */}
              <div role="tabpanel">
                {activeTab === "overview" && (
                  <BillingOverviewTab
                    policy={policy}
                    policyLoading={policyLoading}
                    policyError={policyError}
                    onRetryPolicy={fetchPolicy}
                    onOpenPayment={openDrawer}
                    onGoToTab={setTab}
                  />
                )}
                {activeTab === "payments" && (
                  <BillingPaymentsTab onOpenPayment={openDrawer} />
                )}
                {activeTab === "invoices" && <BillingInvoicesTab />}
                {activeTab === "refunds" && <BillingRefundsTab />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentDetailDrawer
        paymentId={openPaymentId}
        onClose={closeDrawer}
        policy={policy}
      />
    </>
  );
};

export default BillingContent;
