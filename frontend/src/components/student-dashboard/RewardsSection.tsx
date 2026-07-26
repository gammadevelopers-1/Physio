"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  Gift,
  Sparkles,
  Loader2,
  Ticket,
  Copy,
  Check,
  BookOpen,
  Radio,
  Package,
  X,
  AlertTriangle,
  Search as SearchIcon,
} from "lucide-react";
import {
  pointsApi,
  type RewardCardData,
  type RedeemRewardResult,
  type RewardType,
} from "@/lib/api";
import { toast } from "sonner";

interface RewardsSectionProps {
  balance: number;
  isRTL: boolean;
  onBalanceChanged: (newBalance: number) => void;
}

/**
 * Student-facing Rewards grid. Loads its own data so the parent page doesn't
 * need to know about the rewards catalog. Post-redemption we bump the balance
 * up in the parent via onBalanceChanged.
 *
 * `free_course` rewards can bundle multiple courses; when they do the
 * confirm modal renders a searchable radio-picker so the student chooses
 * ONE before the POST goes out.
 */
export default function RewardsSection({
  balance,
  isRTL,
  onBalanceChanged,
}: RewardsSectionProps) {
  const t = useTranslations("studentDashboard.myPoints.rewards");
  const locale = useLocale();
  const [rewards, setRewards] = useState<RewardCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmReward, setConfirmReward] = useState<RewardCardData | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<
    | { reward: RewardCardData; outcome: RedeemRewardResult; selectedCourseId: string | null }
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await pointsApi.getRewards();
        if (!cancelled) setRewards(list);
      } catch (err) {
        console.error("Failed to load rewards", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    try {
      const list = await pointsApi.getRewards();
      setRewards(list);
    } catch (err) {
      console.error("Failed to reload rewards", err);
    }
  };

  const handleRedeem = async (selectedCourseId: string | null) => {
    if (!confirmReward) return;
    setRedeeming(true);
    try {
      const outcome = await pointsApi.redeemReward(
        confirmReward.id,
        selectedCourseId ? { selectedCourseId } : {},
      );
      onBalanceChanged(outcome.newBalance);
      setResult({ reward: confirmReward, outcome, selectedCourseId });
      setConfirmReward(null);
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("errors.redeemFailed");
      toast.error(message);
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  if (rewards.length === 0) return null;

  return (
    <>
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#FBBF24]" />
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center shadow-inner">
              <Gift className="w-4.5 h-4.5 text-[#B45309]" strokeWidth={2} />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {t("title")}
            </h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
              {rewards.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rewards.map((r) => (
              <RewardCard
                key={r.id}
                reward={r}
                balance={balance}
                isRTL={isRTL}
                locale={locale}
                onRedeem={() => setConfirmReward(r)}
              />
            ))}
          </div>
        </div>
      </div>

      {confirmReward && (
        <ConfirmModal
          reward={confirmReward}
          balance={balance}
          isRTL={isRTL}
          locale={locale}
          redeeming={redeeming}
          onClose={() => setConfirmReward(null)}
          onConfirm={handleRedeem}
        />
      )}

      {result && (
        <ResultModal
          reward={result.reward}
          outcome={result.outcome}
          selectedCourseId={result.selectedCourseId}
          isRTL={isRTL}
          locale={locale}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}

// ─── Card ────────────────────────────────────────────────────────

function RewardCard({
  reward,
  balance,
  isRTL,
  locale,
  onRedeem,
}: {
  reward: RewardCardData;
  balance: number;
  isRTL: boolean;
  locale: string;
  onRedeem: () => void;
}) {
  const t = useTranslations("studentDashboard.myPoints.rewards");
  const name = locale === "ar" ? reward.nameAr || reward.nameEn : reward.nameEn;
  const desc =
    locale === "ar"
      ? reward.descriptionAr || reward.descriptionEn
      : reward.descriptionEn;
  const Icon = iconForType(reward.type);
  const shortOn = balance < reward.pointsCost ? reward.pointsCost - balance : 0;

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-4 flex flex-col hover:border-[var(--color-primary)]/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#B45309]" strokeWidth={2} />
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--color-text-secondary)] font-medium">
            {t("pointsLabel")}
          </div>
          <div className="text-lg font-bold text-[var(--color-primary)]">
            {reward.pointsCost.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-3 flex-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
          {name}
        </h3>
        {desc && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-3">
            {desc}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {reward.stockLeft !== null && reward.stockLeft <= 5 && reward.stockLeft > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-medium">
            {t("stockLeft", { n: reward.stockLeft })}
          </span>
        )}
        {reward.perUserLeft !== null && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
            {t("perUserLeft", { n: reward.perUserLeft })}
          </span>
        )}
      </div>
      <div className="mt-3">
        {reward.canRedeem ? (
          <button
            onClick={onRedeem}
            className="w-full py-2 px-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t("redeemBtn")}
          </button>
        ) : !reward.canAfford ? (
          <button
            disabled
            className="w-full py-2 px-3 rounded-lg bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium cursor-not-allowed"
            title={t("needMore", { n: shortOn })}
          >
            {t("needMore", { n: shortOn })}
          </button>
        ) : !reward.inStock ? (
          <button
            disabled
            className="w-full py-2 px-3 rounded-lg bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium cursor-not-allowed"
          >
            {t("outOfStock")}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2 px-3 rounded-lg bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium cursor-not-allowed"
          >
            {t("perUserCapReached")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirm modal ─────────────────────────────────────────────

function ConfirmModal({
  reward,
  balance,
  isRTL,
  locale,
  redeeming,
  onClose,
  onConfirm,
}: {
  reward: RewardCardData;
  balance: number;
  isRTL: boolean;
  locale: string;
  redeeming: boolean;
  onClose: () => void;
  onConfirm: (selectedCourseId: string | null) => void;
}) {
  const t = useTranslations("studentDashboard.myPoints.rewards");
  const name = locale === "ar" ? reward.nameAr || reward.nameEn : reward.nameEn;
  const after = balance - reward.pointsCost;
  const Icon = iconForType(reward.type);

  const needsCoursePick =
    reward.type === "free_course" && reward.courses.length > 1;
  const autoCourseId =
    reward.type === "free_course" && reward.courses.length === 1
      ? reward.courses[0].id
      : null;
  const [pickedCourseId, setPickedCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const filteredCourses = useMemo(() => {
    if (!needsCoursePick) return [];
    const q = query.trim().toLowerCase();
    if (!q) return reward.courses;
    return reward.courses.filter((c) => {
      const title = locale === "ar" ? c.titleAr || c.title : c.title;
      return title.toLowerCase().includes(q);
    });
  }, [needsCoursePick, reward.courses, query, locale]);

  const canConfirm = !needsCoursePick || !!pickedCourseId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#B45309]" />
            </div>
            <h3 className="text-base font-semibold">{t("confirmTitle")}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {t.rich("confirmBody", {
            name: () => <strong>{name}</strong>,
            cost: () => <strong>{reward.pointsCost.toLocaleString()}</strong>,
          })}
        </p>

        {needsCoursePick && (
          <div className="mb-4">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
              {t("selectCourseTitle")}
            </div>
            <div className="relative mb-2">
              <SearchIcon className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("selectCourseSearch")}
                className="w-full h-9 ps-9 pe-2 text-sm bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-md focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="max-h-56 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border-subtle)]">
              {filteredCourses.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-text-secondary)]">
                  {t("selectCourseEmpty")}
                </div>
              ) : (
                filteredCourses.map((c) => {
                  const title = locale === "ar" ? c.titleAr || c.title : c.title;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 p-2.5 cursor-pointer hover:bg-[var(--color-border-subtle)] ${
                        pickedCourseId === c.id ? "bg-[var(--color-primary)]/5" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="course-pick"
                        checked={pickedCourseId === c.id}
                        onChange={() => setPickedCourseId(c.id)}
                        className="accent-[var(--color-primary)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[var(--color-text-primary)] truncate">
                          {title}
                        </div>
                        {c.priceSar > 0 ? (
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {t("selectCoursePrice", { price: c.priceSar.toLocaleString() })}
                          </div>
                        ) : (
                          <div className="text-xs text-[#16A34A] font-medium">
                            {t("selectCourseFree")}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg bg-[var(--color-surface-page)] p-3 text-sm space-y-1">
          <Row label={t("currentBalance")} value={balance.toLocaleString()} />
          <Row
            label={t("cost")}
            value={`− ${reward.pointsCost.toLocaleString()}`}
            valueClass="text-[#DC2626]"
          />
          <Row
            label={t("newBalance")}
            value={after.toLocaleString()}
            valueClass="font-bold"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={redeeming}
            className="flex-1 py-2 px-3 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-border-subtle)]"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => onConfirm(pickedCourseId ?? autoCourseId)}
            disabled={redeeming || !canConfirm}
            className="flex-1 py-2 px-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-60"
          >
            {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("confirmBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

// ─── Result modal ─────────────────────────────────────────────

function ResultModal({
  reward,
  outcome,
  selectedCourseId,
  isRTL,
  locale,
  onClose,
}: {
  reward: RewardCardData;
  outcome: RedeemRewardResult;
  selectedCourseId: string | null;
  isRTL: boolean;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations("studentDashboard.myPoints.rewards");
  const [copied, setCopied] = useState(false);
  const name = locale === "ar" ? reward.nameAr || reward.nameEn : reward.nameEn;
  const code = outcome.fulfillment.discountCode as string | undefined;
  const enrollmentId = outcome.fulfillment.enrollmentId as string | undefined;
  // Prefer the id we sent up (the student's explicit pick), fall back to
  // whatever the server echoed in the fulfilment payload.
  const courseId =
    selectedCourseId ??
    (outcome.fulfillment.courseId as string | undefined) ??
    null;
  const sessionTitle = outcome.fulfillment.sessionTitle as string | undefined;
  const expiresAt = outcome.expiresAt
    ? new Date(outcome.expiresAt).toLocaleDateString()
    : null;

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="text-center mb-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] flex items-center justify-center mb-3">
            <Sparkles className="w-8 h-8 text-[#16A34A]" />
          </div>
          <h3 className="text-lg font-semibold">{t("successTitle")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t.rich("successBody", { name: () => <strong>{name}</strong> })}
          </p>
        </div>

        {code && (
          <div className="space-y-2 mb-4">
            <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
              {t("yourCode")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-[var(--color-surface-page)] rounded-lg font-mono text-lg font-bold tracking-wider text-center">
                {code}
              </div>
              <button
                onClick={copy}
                className="p-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90"
                title={t("copy")}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            {expiresAt && (
              <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t("expiresOn", { date: expiresAt })}
              </p>
            )}
          </div>
        )}

        {(enrollmentId || courseId) && courseId && (
          <div className="mb-4">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="block w-full py-2 px-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium text-center hover:opacity-90"
            >
              {t("goToCourse")}
            </Link>
          </div>
        )}

        {sessionTitle && (
          <div className="mb-4 p-3 bg-[var(--color-surface-page)] rounded-lg text-sm">
            {t("registeredForWebinar", { title: sessionTitle })}
          </div>
        )}

        {outcome.status === "pending" && outcome.type === "other" && (
          <div className="mb-4 p-3 bg-[#FEF3C7] rounded-lg text-sm text-[#92400E] space-y-2">
            <p>
              {t("result.otherPendingWithinDays", {
                days:
                  typeof (outcome.fulfillment as Record<string, unknown>)
                    .expectedDeliveryDays === "number"
                    ? ((outcome.fulfillment as Record<string, unknown>)
                        .expectedDeliveryDays as number)
                    : 7,
              })}
            </p>
            <Link
              href={`/${locale}/dashboard/student/my-rewards`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#92400E] hover:underline"
              onClick={onClose}
            >
              {t("result.viewRewardsLink")}
              <span aria-hidden>{isRTL ? "←" : "→"}</span>
            </Link>
          </div>
        )}

        {outcome.status === "pending" && outcome.type !== "other" && (
          <div className="mb-4 p-3 bg-[#FEF3C7] rounded-lg text-sm text-[#92400E]">
            {t("pendingFulfillment")}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 px-3 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-border-subtle)]"
        >
          {t("done")}
        </button>

        {/* Footer link — takes the student to the new "My Rewards" page where
            every past redemption (this one included) is tracked. */}
        <div className="mt-3 text-center">
          <Link
            href={`/${locale}/dashboard/student/my-rewards`}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
            onClick={onClose}
          >
            {t("viewAllRewardsLink")}
            <span aria-hidden>{isRTL ? "←" : "→"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function iconForType(type: RewardType) {
  switch (type) {
    case "discount_coupon":
    case "fixed_discount_coupon":
      return Ticket;
    case "free_course":
      return BookOpen;
    case "free_webinar":
      return Radio;
    default:
      return Package;
  }
}
