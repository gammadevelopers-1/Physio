"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Coins,
  TrendingUp,
  Gift,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Clock,
  Calendar,
  AlertTriangle,
  Award,
  GraduationCap,
  CreditCard,
  RotateCcw,
  Hourglass,
  Crown,
  MinusCircle,
  Star,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import EmptyStateIllustration from "./EmptyStateIllustration";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import {
  pointsApi,
  type PointsBalance,
  type PointsTransaction,
  type RedeemableCourse,
  type ActiveRule,
} from "@/lib/api";

const PAGE_SIZE = 10;

const MyPointsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [redeemable, setRedeemable] = useState<RedeemableCourse[]>([]);
  const [rules, setRules] = useState<ActiveRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Initial load — balance + first page of history + redeemable courses + active rules
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bal, txs, red, rls] = await Promise.all([
          pointsApi.getBalance(),
          pointsApi.getTransactions({ page: 1, limit: PAGE_SIZE }),
          pointsApi.getRedeemableCourses(),
          pointsApi.getActiveRules(),
        ]);
        if (cancelled) return;
        setBalance(bal);
        setTransactions(txs.data);
        setTotal(txs.total);
        setRedeemable(red.courses);
        setRules(rls);
      } catch (err) {
        console.error("Failed to load points data", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Map rule_key → live point amount, falls back to 0 if rule disabled
  const ruleAmount = (key: string): number =>
    rules.find((r) => r.ruleKey === key)?.pointsAmount ?? 0;

  const loadPage = async (next: number) => {
    setHistoryLoading(true);
    try {
      const txs = await pointsApi.getTransactions({
        page: next,
        limit: PAGE_SIZE,
      });
      setTransactions(txs.data);
      setTotal(txs.total);
      setPage(next);
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const balanceVal = balance?.balance ?? 0;
  const expiringSoon = balance?.expiringSoon ?? 0;

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>
            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0 space-y-4">
              {/* Header */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              <OfflineBanner />

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-sm">{t("loading")}</p>
                </div>
              ) : (
                <>
                  {/* Balance card — gold gradient hero */}
                  <div
                    className="relative overflow-hidden rounded-xl p-5 sm:p-6 text-white shadow-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide opacity-90">
                          {t("balanceLabel")}
                        </p>
                        <p className="text-4xl sm:text-5xl font-bold mt-1">
                          {balanceVal.toLocaleString(locale)}
                        </p>
                        <p className="text-sm opacity-90 mt-1">
                          {t("pointsUnit")}
                        </p>
                      </div>
                      <Coins className="w-12 h-12 opacity-30" />
                    </div>
                    {expiringSoon > 0 && (
                      <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white/15 rounded-lg backdrop-blur-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs">
                          {t("expiringSoon", { count: expiringSoon })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* How to earn — visible rules. Amounts and which rules
                      to show come from the active-rules API, so admin edits
                      reflect immediately on this page. */}
                  {rules.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("howToEarnTitle")}
                        </h2>
                      </div>
                      <ul className="space-y-2">
                        {rules.some((r) => r.ruleKey === "signup") && (
                          <EarnRow
                            icon="✨"
                            title={t("earn.signup.title")}
                            description={t("earn.signup.description")}
                            amount={ruleAmount("signup")}
                            t={t}
                          />
                        )}
                        {rules.some((r) => r.ruleKey === "course_completed") && (
                          <EarnRow
                            icon="🎓"
                            title={t("earn.completion.title")}
                            description={t("earn.completion.description")}
                            amount={ruleAmount("course_completed")}
                            t={t}
                          />
                        )}
                        {rules.some((r) => r.ruleKey === "review_approved") && (
                          <EarnRow
                            icon="⭐"
                            title={t("earn.review.title")}
                            description={t("earn.review.description")}
                            amount={ruleAmount("review_approved")}
                            t={t}
                          />
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Redeem section — show only if any redeemable courses exist */}
                  {redeemable.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Gift className="w-5 h-5 text-[var(--color-primary)]" />
                        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("redeemTitle")}
                        </h2>
                        <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
                          {redeemable.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {redeemable.slice(0, 6).map((course) => (
                          <RedeemableCard
                            key={course.id}
                            course={course}
                            isRTL={isRTL}
                            locale={locale}
                            t={t}
                          />
                        ))}
                      </div>
                      {redeemable.length > 6 && (
                        <Link
                          href={`/${locale}/courses`}
                          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {t("browseAll")}
                          <ArrowIcon className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  )}

                  {/* History — premium look: gradient header + card-per-row
                      with reason-specific icon + delta on the trailing edge. */}
                  <div className="relative bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
                    {/* Top accent bar — subtle gold gradient consistent with
                        the points theme without overpowering the page. */}
                    <div className="h-1 w-full bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B]" />

                    <div className="p-4 sm:p-6">
                      <div className="flex items-center justify-between gap-3 mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center shadow-inner">
                            <Sparkles className="w-4.5 h-4.5 text-[#B45309]" strokeWidth={2} />
                          </div>
                          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
                            {t("historyTitle")}
                          </h2>
                        </div>
                        {total > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] text-[#92400E] rounded-full border border-[#FCD34D]/40">
                            {total}
                          </span>
                        )}
                      </div>

                    {historyLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <EmptyStateIllustration
                          variant="courses"
                          className="mb-2"
                        />
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("historyEmpty")}
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {transactions.map((tx) => (
                          <TransactionRow
                            key={tx.id}
                            tx={tx}
                            isRTL={isRTL}
                            locale={locale}
                            t={t}
                          />
                        ))}
                      </ul>
                    )}

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={page <= 1 || historyLoading}
                          onClick={() => loadPage(page - 1)}
                          className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t("previous")}
                        </button>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t("pageOf", { page, total: totalPages })}
                        </span>
                        <button
                          type="button"
                          disabled={page >= totalPages || historyLoading}
                          onClick={() => loadPage(page + 1)}
                          className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t("next")}
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Subcomponents ──────────────────────────────────────────

interface EarnRowProps {
  icon: string;
  title: string;
  description: string;
  amount: number;
  t: ReturnType<typeof useTranslations>;
}

function EarnRow({ icon, title, description, amount, t }: EarnRowProps) {
  return (
    <li className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)]">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          {description}
        </p>
      </div>
      <span className="text-sm font-semibold text-[var(--color-primary)] flex-shrink-0">
        +{amount} {t("pts")}
      </span>
    </li>
  );
}

interface RedeemableCardProps {
  course: RedeemableCourse;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}

function RedeemableCard({ course, isRTL, locale, t }: RedeemableCardProps) {
  const title = isRTL && course.titleAr ? course.titleAr : course.title;
  const initial = (title || "?").trim().charAt(0).toUpperCase();

  return (
    <Link
      href={`/${locale}/courses/${course.id}`}
      className="group flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail}
            alt=""
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
            }}
          >
            <span className="text-white text-5xl font-bold opacity-90 select-none">
              {initial}
            </span>
          </div>
        )}
        <div
          className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} px-2 py-0.5 rounded-full text-[10px] font-semibold ${course.affordable ? "bg-[#16A34A] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
        >
          {course.affordable ? t("affordable") : t("notEnough")}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
          {title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {course.price > 0 ? `${course.price} SAR` : t("free")}
          </span>
          <span className="text-sm font-bold text-[var(--color-primary)]">
            {course.costPoints.toLocaleString()} {t("pts")}
          </span>
        </div>
      </div>
    </Link>
  );
}

interface TransactionRowProps {
  tx: PointsTransaction;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}

/** Pick a context-aware icon + color theme from the transaction reason.
 *  Falls back to a generic +/- look when the reason is unknown. */
function reasonVisuals(reason: string, isPositive: boolean): {
  Icon: typeof Sparkles;
  iconClass: string;
  bgClass: string;
  ringClass: string;
} {
  if (reason.startsWith("earn:signup")) {
    return {
      Icon: Gift,
      iconClass: "text-[#7C3AED]",
      bgClass: "bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE]",
      ringClass: "ring-1 ring-[#DDD6FE]",
    };
  }
  if (reason.startsWith("earn:course_completed")) {
    return {
      Icon: GraduationCap,
      iconClass: "text-[#0891B2]",
      bgClass: "bg-gradient-to-br from-[#ECFEFF] to-[#CFFAFE]",
      ringClass: "ring-1 ring-[#A5F3FC]",
    };
  }
  if (reason.startsWith("earn:review_approved")) {
    return {
      Icon: Star,
      iconClass: "text-[#D97706]",
      bgClass: "bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]",
      ringClass: "ring-1 ring-[#FCD34D]",
    };
  }
  if (reason.startsWith("redeem:")) {
    return {
      Icon: CreditCard,
      iconClass: "text-[#0891B2]",
      bgClass: "bg-gradient-to-br from-[#ECFEFF] to-[#CFFAFE]",
      ringClass: "ring-1 ring-[#A5F3FC]",
    };
  }
  if (reason.startsWith("reverse:")) {
    return {
      Icon: RotateCcw,
      iconClass: "text-[#475569]",
      bgClass: "bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9]",
      ringClass: "ring-1 ring-[#E2E8F0]",
    };
  }
  if (reason.startsWith("admin:grant")) {
    return {
      Icon: Crown,
      iconClass: "text-[#B45309]",
      bgClass: "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A]",
      ringClass: "ring-1 ring-[#F59E0B]/40",
    };
  }
  if (reason.startsWith("admin:deduct")) {
    return {
      Icon: MinusCircle,
      iconClass: "text-[#DC2626]",
      bgClass: "bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2]",
      ringClass: "ring-1 ring-[#FECACA]",
    };
  }
  if (reason.startsWith("system:expire")) {
    return {
      Icon: Hourglass,
      iconClass: "text-[#A16207]",
      bgClass: "bg-gradient-to-br from-[#FEF9C3] to-[#FDE68A]",
      ringClass: "ring-1 ring-[#FCD34D]",
    };
  }
  return isPositive
    ? {
        Icon: Award,
        iconClass: "text-[#16A34A]",
        bgClass: "bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7]",
        ringClass: "ring-1 ring-[#BBF7D0]",
      }
    : {
        Icon: MinusCircle,
        iconClass: "text-[#DC2626]",
        bgClass: "bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2]",
        ringClass: "ring-1 ring-[#FECACA]",
      };
}

function TransactionRow({ tx, isRTL, locale, t }: TransactionRowProps) {
  const isPositive = tx.delta > 0;
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const description =
    (isRTL && tx.ruleDescriptionAr) || tx.ruleDescription || reasonLabel(tx.reason, t);
  const { Icon, iconClass, bgClass, ringClass } = reasonVisuals(tx.reason, isPositive);

  // Highlight expiry chip if the points expire within 30 days.
  const expiresAt = tx.expiresAt ? new Date(tx.expiresAt) : null;
  const expiresSoon =
    expiresAt &&
    expiresAt > new Date() &&
    expiresAt.getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000;

  return (
    <li
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-page)] hover:bg-[var(--color-border-subtle)]/60 hover:border-[var(--color-border-subtle)] transition-colors"
    >
      <div
        className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass} ${ringClass}`}
      >
        <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 ${iconClass}`} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate leading-tight">
          {description}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateFmt.format(new Date(tx.createdAt))}
          </span>
          {expiresAt && expiresAt > new Date() && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <span
                className={`inline-flex items-center gap-1 ${expiresSoon ? "text-[#B45309] font-medium" : ""}`}
              >
                <Clock className="w-3 h-3" />
                {t("expiresOn", { date: dateFmt.format(expiresAt) })}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end flex-shrink-0">
        <span
          className={`inline-flex items-baseline gap-0.5 text-base sm:text-lg font-bold tabular-nums ${
            isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
          }`}
          dir="ltr"
        >
          <span>{isPositive ? "+" : ""}{tx.delta}</span>
          <span className="text-[10px] uppercase tracking-wide opacity-70 font-semibold">
            pts
          </span>
        </span>
      </div>
    </li>
  );
}

function reasonLabel(reason: string, t: ReturnType<typeof useTranslations>) {
  const map: Record<string, string> = {
    "earn:signup": t("reasons.signup"),
    "earn:course_completed": t("reasons.courseCompleted"),
    "earn:review_approved": t("reasons.reviewApproved"),
    "redeem:hold": t("reasons.redeemHold"),
    "redeem:committed": t("reasons.redeemCommitted"),
    "redeem:released": t("reasons.redeemReleased"),
    "reverse:refund": t("reasons.reverseRefund"),
    "admin:grant": t("reasons.adminGrant"),
    "admin:deduct": t("reasons.adminDeduct"),
    "system:expire": t("reasons.systemExpire"),
  };
  return map[reason] || reason;
}

export default MyPointsContent;
