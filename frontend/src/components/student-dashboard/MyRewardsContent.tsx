"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Sparkles,
  Loader2,
  Coins,
  Ticket,
  BookOpen,
  Radio,
  Package,
  Copy,
  Check,
  Clock,
  Calendar,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import {
  pointsApi,
  type PointsBalance,
  type RewardHistoryPage,
  type RewardHistoryRow,
  type CouponHistoryItem,
  type FreeCourseHistoryItem,
  type FreeWebinarHistoryItem,
  type OtherHistoryItem,
  type CoursePurchaseHistoryItem,
} from "@/lib/api";
import { toast } from "sonner";

const PAGE_SIZE = 20;

type TabKey = "active" | "history";

/**
 * "My Rewards" — comprehensive per-student redemption history with per-type
 * projections. Splits into an Active tab (things the student can still use)
 * and a History tab (used / expired / past). Fetches everything via
 * `pointsApi.getMyRewardHistory` — the server returns the projection already
 * resolved, so this component is presentational.
 */
const MyRewardsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myRewards");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [historyPage, setHistoryPage] = useState<RewardHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TabKey>("active");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bal, hp] = await Promise.all([
          pointsApi.getBalance(),
          pointsApi.getMyRewardHistory({ page: 1, limit: PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setBalance(bal);
        setHistoryPage(hp);
      } catch (err) {
        console.error("Failed to load rewards history", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPage = async (next: number) => {
    setLoading(true);
    try {
      const hp = await pointsApi.getMyRewardHistory({
        page: next,
        limit: PAGE_SIZE,
      });
      setHistoryPage(hp);
      setPage(next);
    } finally {
      setLoading(false);
    }
  };

  const items = historyPage?.items ?? [];
  const total = historyPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Partition rows into Active vs History based on the plan's rules.
  const { active, history } = useMemo(
    () => partitionRows(items),
    [items],
  );
  const shownRows = tab === "active" ? active : history;

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
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("subtitle")}
                  </p>
                </div>
                {balance && (
                  <Link
                    href={`/${locale}/dashboard/student/invite-friends`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] transition-colors"
                  >
                    <Coins className="w-4 h-4 text-[#D4A520]" />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {balance.balance.toLocaleString(locale)}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {t("pointsUnit")}
                    </span>
                  </Link>
                )}
              </div>

              <OfflineBanner />

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-border-subtle)] w-fit">
                <TabButton
                  active={tab === "active"}
                  onClick={() => setTab("active")}
                  label={t("activeTab")}
                  count={active.length}
                />
                <TabButton
                  active={tab === "history"}
                  onClick={() => setTab("history")}
                  label={t("historyTab")}
                  count={history.length}
                />
              </div>

              {loading && !historyPage ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                </div>
              ) : shownRows.length === 0 ? (
                <EmptyState tab={tab} locale={locale} t={t} ArrowIcon={ArrowIcon} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {shownRows.map((row) => (
                    <RewardHistoryCard
                      key={row.redemptionId}
                      row={row}
                      isRTL={isRTL}
                      locale={locale}
                    />
                  ))}
                </div>
              )}

              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t("pagination.showing", {
                      shown: items.length,
                      total,
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => loadPage(page - 1)}
                      className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("pagination.prev")}
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => loadPage(page + 1)}
                      className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t("pagination.next")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Partitioning ────────────────────────────────────────────────

function partitionRows(items: RewardHistoryRow[]): {
  active: RewardHistoryRow[];
  history: RewardHistoryRow[];
} {
  const now = Date.now();
  const active: RewardHistoryRow[] = [];
  const history: RewardHistoryRow[] = [];

  for (const row of items) {
    const p = row.projection;
    let isActive = false;

    if (p.kind === "coupon") {
      isActive = p.status === "unused";
    } else if (p.kind === "free_course") {
      const startsAt = p.courseStartDate ? new Date(p.courseStartDate).getTime() : null;
      isActive = (startsAt !== null && startsAt >= now) || !!p.enrollmentId;
    } else if (p.kind === "free_webinar") {
      const startsAt = p.sessionStartAt ? new Date(p.sessionStartAt).getTime() : null;
      isActive = startsAt !== null && startsAt >= now;
    } else if (p.kind === "other") {
      isActive = p.status === "pending";
    } else if (p.kind === "course_purchase") {
      // Same split rule as free_course: enrolled + not completed → Active;
      // completed / dropped / expired → History. Rows without any
      // enrollment link default to Active so the student always sees the
      // recent purchase somewhere obvious.
      const s = p.enrollmentStatus;
      isActive = s === "active" || s === null;
    }

    if (isActive) active.push(row);
    else history.push(row);
  }
  return { active, history };
}

// ─── Subcomponents ───────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}

function TabButton({ active, onClick, label, count }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-white shadow-sm text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {label}
      <span
        className={`ms-2 text-[11px] font-semibold rounded-full px-1.5 py-0.5 ${
          active
            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

interface EmptyStateProps {
  tab: TabKey;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  ArrowIcon: typeof ArrowRight;
}

function EmptyState({ tab, locale, t, ArrowIcon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface-card)]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center mb-3">
        <Sparkles className="w-7 h-7 text-[#B45309]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
        {tab === "active" ? t("empty.active.title") : t("empty.history.title")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
        {tab === "active" ? t("empty.active.body") : t("empty.history.body")}
      </p>
      {tab === "active" && (
        <Link
          href={`/${locale}/dashboard/student/invite-friends`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {t("empty.active.cta")}
          <ArrowIcon className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

interface RewardHistoryCardProps {
  row: RewardHistoryRow;
  isRTL: boolean;
  locale: string;
}

function RewardHistoryCard({ row, isRTL, locale }: RewardHistoryCardProps) {
  const p = row.projection;
  const rewardName =
    isRTL && row.rewardNameAr ? row.rewardNameAr : row.rewardName;

  return (
    <article className="rounded-2xl bg-white shadow-sm border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center">
          <CardIcon kind={p.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {rewardName}
          </h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" />
            {new Date(row.redeemedAt).toLocaleDateString(locale)}
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-medium text-[var(--color-primary)]">
              −{row.pointsSpent.toLocaleString(locale)} pts
            </span>
          </p>
        </div>
      </header>

      <div className="p-4">
        {p.kind === "coupon" && (
          <CouponBody projection={p} locale={locale} />
        )}
        {p.kind === "free_course" && (
          <FreeCourseBody projection={p} locale={locale} isRTL={isRTL} />
        )}
        {p.kind === "free_webinar" && (
          <FreeWebinarBody projection={p} locale={locale} />
        )}
        {p.kind === "other" && <OtherBody projection={p} locale={locale} />}
        {p.kind === "course_purchase" && (
          <CoursePurchaseBody projection={p} locale={locale} isRTL={isRTL} />
        )}
      </div>
    </article>
  );
}

function CardIcon({ kind }: { kind: RewardHistoryRow["projection"]["kind"] }) {
  const cls = "w-5 h-5 text-[#B45309]";
  if (kind === "coupon") return <Ticket className={cls} />;
  if (kind === "free_course") return <BookOpen className={cls} />;
  if (kind === "free_webinar") return <Radio className={cls} />;
  if (kind === "course_purchase") return <BookOpen className={cls} />;
  return <Package className={cls} />;
}

// ── Coupon card body ─────────────────────────────────────────

function CouponBody({
  projection,
  locale,
}: {
  projection: CouponHistoryItem;
  locale: string;
}) {
  const t = useTranslations("studentDashboard.myRewards");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!projection.code) return;
    try {
      await navigator.clipboard.writeText(projection.code);
      setCopied(true);
      toast.success(t("coupon.copiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const now = Date.now();
  const expiresAt = projection.expiresAt ? new Date(projection.expiresAt) : null;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface-page)] font-mono text-base font-bold tracking-wider text-center text-[var(--color-text-primary)] truncate">
          {projection.code || "—"}
        </code>
        {projection.status === "unused" && projection.code && (
          <button
            type="button"
            onClick={copy}
            className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
            title={t("coupon.copyButton")}
            aria-label={t("coupon.copyButton")}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>

      {projection.status === "unused" && (
        <>
          {expiresAt && (
            <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {daysLeft === 0
                ? t("coupon.expired")
                : t("coupon.expiresIn", { days: daysLeft ?? 0 })}
            </p>
          )}
          <Link
            href={`/${locale}/courses`}
            className="block w-full py-2 px-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium text-center hover:opacity-90 transition-opacity"
          >
            {t("coupon.useAtCheckoutCta")}
          </Link>
        </>
      )}

      {projection.status === "used" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium">
            {t("coupon.usedOn", {
              date: expiresAt
                ? expiresAt.toLocaleDateString(locale)
                : "—",
            })}
          </span>
        </div>
      )}

      {projection.status === "expired" && (
        <span className="inline-block px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-xs font-medium">
          {t("coupon.expired")}
        </span>
      )}
    </div>
  );
}

// ── Free-course card body ────────────────────────────────────

function FreeCourseBody({
  projection,
  locale,
  isRTL,
}: {
  projection: FreeCourseHistoryItem;
  locale: string;
  isRTL: boolean;
}) {
  const t = useTranslations("studentDashboard.myRewards");
  const title = isRTL && projection.courseTitleAr
    ? projection.courseTitleAr
    : projection.courseTitle;
  const initial = (title || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex gap-3">
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-page)]">
        {projection.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={projection.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
            }}
          >
            <span className="text-white text-2xl font-bold opacity-90 select-none">
              {initial}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
          {title || "—"}
        </p>
        {projection.enrolledAt && (
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            {t("freeCourse.enrolledOn", {
              date: new Date(projection.enrolledAt).toLocaleDateString(locale),
            })}
          </p>
        )}
        {projection.courseId && (
          <Link
            href={`/${locale}/dashboard/student/courses/${projection.courseId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("freeCourse.goToCourse")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Course-purchase card body ────────────────────────────────
//
// Point-based course purchase (row from `point_redemptions`, distinct from
// a `free_course` reward-catalog entry). Same card shell as FreeCourseBody
// but adds a violet "Paid with N points" chip so the student can quickly
// tell how the enrollment was funded.

function CoursePurchaseBody({
  projection,
  locale,
  isRTL,
}: {
  projection: CoursePurchaseHistoryItem;
  locale: string;
  isRTL: boolean;
}) {
  const t = useTranslations("studentDashboard.myRewards");
  const title =
    isRTL && projection.courseTitleAr
      ? projection.courseTitleAr
      : projection.courseTitle;
  const initial = (title || "?").trim().charAt(0).toUpperCase();

  const statusLabelKey =
    projection.enrollmentStatus === "completed"
      ? "coursePurchase.completedStatus"
      : projection.enrollmentStatus === "dropped"
        ? "coursePurchase.droppedStatus"
        : projection.enrollmentStatus === "expired"
          ? "coursePurchase.expiredStatus"
          : null;

  return (
    <div className="flex gap-3">
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-page)]">
        {projection.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={projection.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
            }}
          >
            <span className="text-white text-2xl font-bold opacity-90 select-none">
              {initial}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
          {title || "—"}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {/* Violet "points" chip mirrors the source chip on the My Courses
              card — same colour language, same purpose. */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-medium">
            <Coins className="w-3 h-3" />
            {t("coursePurchase.pointsPaidChip", {
              points: projection.pointsSpent.toLocaleString(locale),
            })}
          </span>
          {statusLabelKey && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-[11px] font-medium">
              {t(
                statusLabelKey as
                  | "coursePurchase.completedStatus"
                  | "coursePurchase.droppedStatus"
                  | "coursePurchase.expiredStatus",
              )}
            </span>
          )}
        </div>
        {projection.courseId && (
          <Link
            href={`/${locale}/dashboard/student/courses/${projection.courseId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("coursePurchase.goToCourseCta")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Free-webinar card body ───────────────────────────────────

function FreeWebinarBody({
  projection,
  locale,
}: {
  projection: FreeWebinarHistoryItem;
  locale: string;
}) {
  const t = useTranslations("studentDashboard.myRewards");
  const now = Date.now();
  const startsAt = projection.sessionStartAt
    ? new Date(projection.sessionStartAt)
    : null;
  const startMs = startsAt?.getTime() ?? null;
  const canJoinNow =
    startMs !== null &&
    startMs <= now + 15 * 60 * 1000 &&
    startMs >= now - 2 * 60 * 60 * 1000;
  const isPast = startMs !== null && startMs < now - 2 * 60 * 60 * 1000;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
        {projection.sessionTitle || "—"}
      </p>
      {startsAt && (
        <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {isPast
            ? t("freeWebinar.ended")
            : t("freeWebinar.scheduledFor", { date: dateFmt.format(startsAt) })}
        </p>
      )}
      {canJoinNow && projection.joinUrl && (
        <a
          href={projection.joinUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="block w-full py-2 px-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium text-center hover:opacity-90 transition-opacity"
        >
          {t("freeWebinar.joinCta")}
        </a>
      )}
    </div>
  );
}

// ── "Other" card body ────────────────────────────────────────

function OtherBody({
  projection,
  locale,
}: {
  projection: OtherHistoryItem;
  locale: string;
}) {
  const t = useTranslations("studentDashboard.myRewards");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const val = projection.artifact?.value;
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      toast.success(t("coupon.copiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (projection.status === "pending") {
    const redeemed = new Date(projection.redeemedAt);
    const expectedBy = new Date(
      redeemed.getTime() +
        projection.expectedDeliveryDays * 24 * 60 * 60 * 1000,
    );
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#B45309]" />
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#92400E]">
            {t("other.pending")}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {t("other.expectedBy", {
            date: expectedBy.toLocaleDateString(locale),
          })}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("other.pendingBody")}
        </p>
      </div>
    );
  }

  if (projection.status === "fulfilled") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#15803D]">
            {t("other.fulfilled")}
          </span>
          {projection.fulfilledAt && (
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {new Date(projection.fulfilledAt).toLocaleDateString(locale)}
            </span>
          )}
        </div>

        {projection.artifact?.kind === "code" && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              {t("other.yourCode")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--color-surface-page)] border border-[var(--color-border)] font-mono text-base font-bold tracking-wider text-center text-[var(--color-text-primary)] break-all">
                {projection.artifact.value}
              </div>
              <button
                type="button"
                onClick={copy}
                className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
                title={t("other.copyCode")}
                aria-label={t("other.copyCode")}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {projection.artifact?.kind === "link" && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              {t("other.yourLink")}
            </div>
            <a
              href={projection.artifact.value}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              {t("other.openLink")}
            </a>
            <p className="text-[11px] text-[var(--color-text-secondary)] break-all">
              {projection.artifact.value}
            </p>
          </div>
        )}

        {projection.artifact?.kind === "note" && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {t("other.messageFromAdmin")}
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-surface-page)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
              {projection.artifact.value}
            </div>
          </div>
        )}

        {projection.adminNote && (
          <div className="p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-xs text-[#92400E]">
            <span className="font-semibold">
              {t("other.adminNoteLabel")}
            </span>{" "}
            <span className="whitespace-pre-wrap">{projection.adminNote}</span>
          </div>
        )}
      </div>
    );
  }

  if (projection.status === "failed") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-[#B91C1C]" />
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B91C1C]">
            {t("other.failed")}
          </span>
        </div>
        {projection.adminNote && (
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">
            {projection.adminNote}
          </p>
        )}
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("other.failedBody")}
        </p>
      </div>
    );
  }

  // reversed
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
          {t("other.reversed")}
        </span>
      </div>
      {projection.adminNote && (
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">
          {projection.adminNote}
        </p>
      )}
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("other.reversedBody")}
      </p>
    </div>
  );
}

export default MyRewardsContent;
