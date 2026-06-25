"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  CreditCard,
  Wallet,
  Landmark,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronRight,
} from "lucide-react";
import {
  studentFinanceApi,
  type StudentFinanceOverview,
  type StudentFinancePolicySnapshot,
  type StudentGatewayKey,
} from "@/lib/api";
import {
  formatSar,
  formatDate,
  pickCourseTitle,
  statusPillClasses,
  statusLabel,
} from "./billingHelpers";

type Props = {
  policy: StudentFinancePolicySnapshot | null;
  policyLoading: boolean;
  policyError: string | null;
  onRetryPolicy: () => void;
  onOpenPayment: (paymentId: string) => void;
  onGoToTab: (tab: "overview" | "payments" | "invoices" | "refunds") => void;
};

const GATEWAY_ICONS: Record<StudentGatewayKey, typeof CreditCard> = {
  moyasar: CreditCard,
  tamara: Wallet,
  tabby: Wallet,
  bank_transfer: Landmark,
  mock: Info,
};

const BillingOverviewTab = ({
  policy,
  policyLoading,
  policyError,
  onRetryPolicy,
  onOpenPayment,
  onGoToTab,
}: Props) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const isRTL = locale === "ar";

  const [overview, setOverview] = useState<StudentFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mount-only fetch — `loading: true` and `error: null` are the initial
    // state, so no redundant sync setState needed (lint rule
    // react-hooks/set-state-in-effect).
    let cancelled = false;
    studentFinanceApi
      .getOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E5E7EB]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
        <p className="text-sm text-[#DC2626] mb-3">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          {t("common.refresh")}
        </button>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label={t("kpi.lifetimePaid")}
          value={`${formatSar(overview.totals.lifetimePaidSar)} ${t("common.sar")}`}
        />
        <Kpi
          label={t("kpi.vatPaidYtd")}
          value={`${formatSar(overview.totals.vatPaidYtdSar)} ${t("common.sar")}`}
        />
        <Kpi label={t("kpi.paidCount")} value={overview.counts.paid} />
        <Kpi
          label={t("kpi.refundInFlight")}
          value={overview.counts.refundInFlight}
          accent={overview.counts.refundInFlight > 0 ? "amber" : undefined}
        />
      </div>

      {/* Active payment methods */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-5">
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            {t("methodsBlock.title")}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {t("methodsBlock.subtitle")}
          </p>
        </header>
        {policyLoading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : policyError ? (
          <div className="text-sm text-[#DC2626] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{policyError}</span>
            <button
              type="button"
              onClick={onRetryPolicy}
              className="text-xs text-[var(--color-primary)] hover:underline ms-auto"
            >
              {t("common.refresh")}
            </button>
          </div>
        ) : policy ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                "moyasar",
                "tamara",
                "tabby",
                "bank_transfer",
              ] as const
            ).map((g) => {
              const Icon = GATEWAY_ICONS[g];
              const gwStatus = policy.activeGateways[g];
              const available = gwStatus.available;
              return (
                <li
                  key={g}
                  className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg ${
                    available
                      ? "border-[#E5E7EB] bg-white"
                      : "border-[#E5E7EB] bg-[#F9FAFB] opacity-70"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${available ? "text-[var(--color-primary)]" : "text-[#9CA3AF]"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1F2937]">
                      {t(`gateway.${g}`)}
                    </div>
                    {gwStatus.mode === "test" && available && (
                      <div className="text-[11px] text-[#B45309]">
                        {t("methodsBlock.sandboxNotice")}
                      </div>
                    )}
                  </div>
                  {available ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#16A34A]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t("methodsBlock.available")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                      <XCircle className="w-3.5 h-3.5" />
                      {t("methodsBlock.unavailable")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {/* Refund policy at a glance */}
      {policy && (
        <section className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-5">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-[#1F2937]">
              {t("policy.title")}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {t("policy.subtitle")}
            </p>
          </header>
          <ul className="space-y-1.5 text-sm text-[#374151]">
            <PolicyRule
              active={policy.rules.blockAfterCourseStart}
              label={t("policy.ruleCourseStart")}
              offLabel={t("policy.ruleOff")}
            />
            <PolicyRule
              active={policy.rules.blockAfterAttendance}
              label={t("policy.ruleAttendance")}
              offLabel={t("policy.ruleOff")}
            />
            <PolicyRule
              active={policy.rules.blockAfterCertificate}
              label={t("policy.ruleCertificate")}
              offLabel={t("policy.ruleOff")}
            />
            <PolicyRule
              active={policy.rules.blockAfterCmeGranted}
              label={t("policy.ruleCme")}
              offLabel={t("policy.ruleOff")}
            />
          </ul>
          <p className="mt-3 text-xs text-[#6B7280] flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{t("policy.merchantDeductionNote")}</span>
          </p>
        </section>
      )}

      {/* Recent payments */}
      <section className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <header className="px-4 sm:px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            {t("payments.title")}
          </h2>
          <button
            type="button"
            onClick={() => onGoToTab("payments")}
            className="text-xs text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
          >
            {t("common.viewDetails")}
            <ChevronRight
              className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
            />
          </button>
        </header>
        {overview.recentPayments.length === 0 ? (
          <div className="px-4 sm:px-5 py-8 text-center text-sm text-[#6B7280]">
            <p className="font-medium text-[#1F2937] mb-1">
              {t("payments.emptyTitle")}
            </p>
            <p>{t("payments.emptyDesc")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {overview.recentPayments.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenPayment(p.id)}
                  className="w-full px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-[#F9FAFB] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1F2937] truncate">
                      {pickCourseTitle(
                        p.courseTitle,
                        p.courseTitleAr,
                        locale,
                      )}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {formatDate(p.paidAt ?? p.createdAt, locale)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#1F2937] tabular-nums">
                    {formatSar(p.amount)} {t("common.sar")}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(p.status)}`}
                  >
                    {statusLabel(p.status, t)}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-[#9CA3AF] shrink-0 ${isRTL ? "rotate-180" : ""}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default BillingOverviewTab;

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "amber";
}) {
  const valueColor =
    accent === "amber" ? "text-[#B45309]" : "text-[#1F2937]";
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className={`mt-1 text-lg sm:text-xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function PolicyRule({
  active,
  label,
  offLabel,
}: {
  active: boolean;
  label: string;
  offLabel: string;
}) {
  return (
    <li className="flex items-center gap-2">
      {active ? (
        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
      ) : (
        <Info className="w-4 h-4 text-[#9CA3AF] shrink-0" />
      )}
      <span>
        {active ? label : `${label} — ${offLabel}`}
      </span>
    </li>
  );
}
