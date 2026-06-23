"use client";

/**
 * 5-step coupon creation wizard.
 *
 * Step 1 — Type & code (percentage/fixed, value, name, code auto-gen)
 * Step 2 — Scope    (all courses / specific courses with search picker)
 * Step 3 — Limits   (max uses, per-user, scheduled start, expires)
 * Step 4 — Advanced (auto-apply, early-bird, attach to campaign, min order)
 * Step 5 — Review   (summary card with everything, "Create" button)
 *
 * Edit mode pre-fills all fields and renders the same UI; the wizard
 * still walks through the steps so finance can audit each section.
 *
 * Layout: left rail with vertical step indicator + step body on the right.
 * Footer: Back / Next / Create — Next is disabled when the step is invalid.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Loader2,
  Tag,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Percent,
  ShieldCheck,
  Megaphone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { discountApi, publicApi } from "@/lib/api";
import Money from "../shared/Money";
import { FINANCE_COLORS } from "../shared/financeColors";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/admin-dashboard/Select";

interface SimpleCourse {
  id: string;
  title: string;
  titleAr?: string;
  thumbnail?: string | null;
  price?: number;
  /** Course is currently on a finance-managed sale. Surface as a chip
   * in the picker so finance knows attaching another coupon stacks
   * (or is blocked at checkout depending on `saleAllowsCoupon`). */
  onSale?: boolean;
  salePercent?: number | null;
  saleAllowsCoupon?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  endsAt: string | null;
}

interface ExistingCoupon {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  campaign?: string | null;
  campaignId?: string | null;
  autoApply?: boolean;
  earlyBird?: boolean;
  minOrderAmount?: number | null;
  applicableCourses?: string[];
  validFrom?: string | null;
  validUntil?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When set, the wizard runs in edit mode (PATCH). */
  editing?: ExistingCoupon | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

function randomCode(prefix = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++)
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return prefix ? `${prefix}-${suffix}` : suffix;
}

const CreateCouponWizard = ({ open, onClose, onSaved, editing }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.wizard");
  const tShared = useTranslations("financeDashboard.discountsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState<string>("");
  const [code, setCode] = useState<string>("");

  // Step 2
  const [scope, setScope] = useState<"all" | "specific">("all");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courses, setCourses] = useState<SimpleCourse[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Step 3
  const [maxUses, setMaxUses] = useState<string>("");
  const [perUserLimit, setPerUserLimit] = useState<string>("1");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");

  // Step 4
  const [autoApply, setAutoApply] = useState(false);
  const [earlyBird, setEarlyBird] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [minOrder, setMinOrder] = useState<string>("");

  // Pre-fill on edit / open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setValue(String(editing.value));
      setCode(editing.code);
      setScope(
        editing.applicableCourses && editing.applicableCourses.length > 0
          ? "specific"
          : "all",
      );
      setCourseIds(editing.applicableCourses ?? []);
      setMaxUses(editing.maxUses ? String(editing.maxUses) : "");
      setPerUserLimit(
        editing.maxUsesPerUser !== null && editing.maxUsesPerUser !== undefined
          ? String(editing.maxUsesPerUser)
          : "1",
      );
      setValidFrom(editing.validFrom ? editing.validFrom.slice(0, 10) : "");
      setValidUntil(editing.validUntil ? editing.validUntil.slice(0, 10) : "");
      setAutoApply(!!editing.autoApply);
      setEarlyBird(!!editing.earlyBird);
      setCampaignId(editing.campaignId ?? "");
      setMinOrder(editing.minOrderAmount ? String(editing.minOrderAmount) : "");
    } else {
      setType("percentage");
      setValue("");
      setCode("");
      setScope("all");
      setCourseIds([]);
      setMaxUses("");
      setPerUserLimit("1");
      setValidFrom("");
      setValidUntil("");
      setAutoApply(false);
      setEarlyBird(false);
      setCampaignId("");
      setMinOrder("");
    }
    setStep(1);
  }, [open, editing]);

  // Lazy-load courses + campaigns
  useEffect(() => {
    if (!open) return;
    if (courses.length === 0) {
      (async () => {
        setCoursesLoading(true);
        try {
          const res = await publicApi.getCourses({ limit: 100 });
          if (res?.data) {
            setCourses(
              res.data.map((c) => {
                const cc = c as unknown as {
                  id: string;
                  title?: string;
                  titleEn?: string;
                  titleAr?: string;
                  thumbnail?: string | null;
                  price?: number | string;
                  onSale?: boolean;
                  salePercent?: number | null;
                  saleAllowsCoupon?: boolean;
                };
                return {
                  id: cc.id,
                  title: cc.title || cc.titleEn || cc.titleAr || "Untitled",
                  titleAr: cc.titleAr,
                  thumbnail: cc.thumbnail || null,
                  price: Number(cc.price ?? 0),
                  onSale: !!cc.onSale,
                  salePercent: cc.salePercent ?? null,
                  saleAllowsCoupon: !!cc.saleAllowsCoupon,
                };
              }),
            );
          }
        } finally {
          setCoursesLoading(false);
        }
      })();
    }
    if (campaigns.length === 0) {
      (async () => {
        try {
          const res = await discountApi.listCampaigns({
            status: "active",
            limit: 50,
          });
          if (res?.data) {
            setCampaigns(
              res.data.map((c) => ({
                id: c.id,
                name: c.name,
                endsAt: c.endsAt,
              })),
            );
          }
        } catch {}
      })();
    }
  }, [open, courses.length, campaigns.length]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [courses, courseSearch]);

  const valueNum = Number(value);
  const valueValid =
    Number.isFinite(valueNum) &&
    valueNum > 0 &&
    (type !== "percentage" || valueNum <= 100);

  const step1Valid = valueValid && code.trim().length >= 3;
  const step2Valid = scope === "all" || courseIds.length > 0;
  const step3Valid =
    (!maxUses || Number(maxUses) > 0) &&
    Number(perUserLimit) >= 1 &&
    (!validFrom || !validUntil || new Date(validUntil) > new Date(validFrom));

  const stepValid: Record<Step, boolean> = {
    1: step1Valid,
    2: step2Valid,
    3: step3Valid,
    4: true,
    5: true,
  };

  const stepDefs: Array<{ key: Step; label: string; icon: typeof Tag }> = [
    { key: 1, label: t("steps.type"), icon: Percent },
    { key: 2, label: t("steps.scope"), icon: Tag },
    { key: 3, label: t("steps.limits"), icon: ShieldCheck },
    { key: 4, label: t("steps.advanced"), icon: Sparkles },
    { key: 5, label: t("steps.review"), icon: Check },
  ];

  const canSubmit = step1Valid && step2Valid && step3Valid;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        code: code.toUpperCase().trim(),
        type,
        value: valueNum,
        maxUses: maxUses ? Number(maxUses) : undefined,
        maxUsesPerUser: Number(perUserLimit),
        autoApply,
        earlyBird,
        campaignId: campaignId || undefined,
        minOrderAmount: minOrder ? Number(minOrder) : undefined,
        courseIds: scope === "specific" && courseIds.length > 0 ? courseIds : undefined,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      };
      if (editing) {
        await discountApi.update(editing.id, payload);
        toast.success(t("editedToast"));
      } else {
        await discountApi.create(payload);
        toast.success(t("createdToast"));
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : (t("saveError") as string),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const previewBadge = (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#F59E0B] to-[#DC2626] text-white shadow-md">
      <Tag className="w-4 h-4" />
      <span className="font-bold text-sm">
        {type === "percentage"
          ? `${valueNum || "—"}% OFF`
          : (
            <>
              <Money amount={valueNum || 0} decimals={0} iconClassName="text-white" /> OFF
            </>
          )}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface-page)] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-card)] flex items-center justify-between">
          <div className={`flex items-center gap-3`}>
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Tag className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {editing ? t("editTitle") : t("createTitle")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("stepXofY", { current: step, total: 5 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — sidebar + main */}
        <div className={`flex-1 flex overflow-hidden`}>
          {/* Sidebar — step indicator */}
          <div className="w-56 bg-[var(--color-surface-card)] border-r border-[var(--color-border-subtle)] py-5 px-3 hidden md:flex md:flex-col gap-1 overflow-y-auto">
            {stepDefs.map((s, idx) => {
              const Icon = s.icon;
              const active = s.key === step;
              const done = s.key < step;
              const disabled =
                s.key > step && !stepValid[Math.min(s.key, step) as Step];
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={disabled && s.key !== step}
                  onClick={() => setStep(s.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-start ${
                    active
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : done
                      ? "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                  } ${disabled && s.key !== step ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : done
                        ? `${FINANCE_COLORS.success.bg} ${FINANCE_COLORS.success.text}`
                        : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </span>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {step === 1 && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step1.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step1.hint")}
                  </p>
                </div>

                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-3">
                  {(["percentage", "fixed"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setType(opt)}
                      className={`p-4 rounded-xl border-2 text-start transition-all ${
                        type === opt
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {t(opt === "percentage" ? "step1.percentage" : "step1.fixed")}
                        </span>
                        {type === opt && (
                          <Check className="w-4 h-4 text-[var(--color-primary)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {t(opt === "percentage" ? "step1.percentageHint" : "step1.fixedHint")}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Value */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {type === "percentage" ? t("step1.percentValue") : t("step1.amountValue")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === "percentage" ? "25" : "100"}
                      className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-base focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-secondary)] font-medium">
                      {type === "percentage" ? "%" : "SAR"}
                    </span>
                  </div>
                  {type === "percentage" && valueNum > 100 && (
                    <p className="text-[11px] text-[#DC2626] mt-1">
                      {t("step1.percentMax")}
                    </p>
                  )}
                </div>

                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {t("step1.code")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="PHYSIO25"
                      className="flex-1 px-4 py-3 border border-[var(--color-border)] rounded-lg text-base focus:outline-none focus:border-[var(--color-primary)] font-mono uppercase"
                      disabled={!!editing}
                    />
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => setCode(randomCode())}
                        className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {t("step1.generate")}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t("step1.codeHint")}
                  </p>
                </div>

                {/* Live preview */}
                <div className="p-4 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-2">
                    {t("preview")}
                  </p>
                  {previewBadge}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step2.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step2.hint")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  {(["all", "specific"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setScope(opt)}
                      className={`p-4 rounded-xl border-2 text-start transition-all ${
                        scope === opt
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {t(opt === "all" ? "step2.allCourses" : "step2.specificCourses")}
                        </span>
                        {scope === opt && (
                          <Check className="w-4 h-4 text-[var(--color-primary)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {t(opt === "all" ? "step2.allCoursesHint" : "step2.specificCoursesHint")}
                      </p>
                    </button>
                  ))}
                </div>

                {scope === "specific" && (
                  <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] flex items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                        <input
                          type="text"
                          value={courseSearch}
                          onChange={(e) => setCourseSearch(e.target.value)}
                          placeholder={t("step2.searchPlaceholder")}
                          className="w-full ps-9 pe-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {t("step2.selectedCount", { n: courseIds.length })}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {coursesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                        </div>
                      ) : filteredCourses.length === 0 ? (
                        <p className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                          {t("step2.noCourses")}
                        </p>
                      ) : (
                        filteredCourses.map((c) => {
                          const checked = courseIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setCourseIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== c.id)
                                    : [...prev, c.id],
                                )
                              }
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-page)] text-start border-b border-[var(--color-border-subtle)] last:border-b-0"
                            >
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                  checked
                                    ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                                    : "border-[var(--color-border)]"
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </span>
                              {c.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={c.thumbnail}
                                  alt=""
                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-[var(--color-surface-page)] flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                    {c.title}
                                  </p>
                                  {c.onSale && (
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C] uppercase tracking-wide flex-shrink-0"
                                      title={
                                        c.saleAllowsCoupon
                                          ? "This course is on sale. Coupons stack on top of the sale."
                                          : "This course is on sale. Coupons will be REJECTED at checkout unless the sale allows stacking."
                                      }
                                    >
                                      {c.salePercent ? `${c.salePercent}% Sale` : "On Sale"}
                                    </span>
                                  )}
                                  {c.onSale && !c.saleAllowsCoupon && (
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] uppercase tracking-wide flex-shrink-0"
                                      title="The sale on this course does not allow coupon stacking. A coupon attached here will be rejected at checkout."
                                    >
                                      No-stack
                                    </span>
                                  )}
                                </div>
                                {c.price !== undefined && c.price > 0 && (
                                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                                    <Money amount={c.price} decimals={0} />
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step3.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step3.hint")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step3.maxUses")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder={t("step3.maxUsesPlaceholder")}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      {t("step3.maxUsesHint")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step3.perUserLimit")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={perUserLimit}
                      onChange={(e) => setPerUserLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step3.startsAt")}
                    </label>
                    <DatePicker value={validFrom} onChange={setValidFrom} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step3.expiresAt")}
                    </label>
                    <DatePicker
                      value={validUntil}
                      onChange={setValidUntil}
                      min={validFrom || undefined}
                    />
                  </div>
                </div>

                {validFrom && validUntil && new Date(validUntil) <= new Date(validFrom) && (
                  <p className="text-[11px] text-[#DC2626]">{t("step3.dateOrder")}</p>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step4.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step4.hint")}
                  </p>
                </div>

                {/* Auto-apply */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-card)] transition-colors">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#D97706]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t("step4.autoApply")}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
                      {t("step4.autoApplyHint")}
                    </p>
                  </div>
                </label>

                {/* Early bird */}
                <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-card)] transition-colors">
                  <input
                    type="checkbox"
                    checked={earlyBird}
                    onChange={(e) => setEarlyBird(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#D97706]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t("step4.earlyBird")}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
                      {t("step4.earlyBirdHint")}
                    </p>
                  </div>
                </label>

                {/* Campaign attach */}
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1.5 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5" />
                    {t("step4.attachCampaign")}
                  </label>
                  <Select
                    value={campaignId}
                    onChange={setCampaignId}
                    options={[
                      { value: "", label: t("step4.noCampaign") },
                      ...campaigns.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t("step4.campaignHint")}
                  </p>
                </div>

                {/* Min order */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {t("step4.minOrder")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder={t("step4.minOrderPlaceholder")}
                    className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step5.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step5.hint")}
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
                  <div className="flex items-center justify-between mb-4">
                    {previewBadge}
                    <span className="text-2xl font-mono font-bold text-[var(--color-text-primary)] tracking-wide">
                      {code || "—"}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                    <ReviewRow label={t("step5.scope")}>
                      {scope === "all" ? t("step2.allCourses") : t("step5.nCourses", { n: courseIds.length })}
                    </ReviewRow>
                    <ReviewRow label={t("step5.maxUses")}>
                      {maxUses || t("step5.unlimited")}
                    </ReviewRow>
                    <ReviewRow label={t("step5.perUser")}>{perUserLimit}</ReviewRow>
                    <ReviewRow label={t("step5.validity")}>
                      {validFrom || tShared("kpi.now")} → {validUntil || t("step5.noExpiry")}
                    </ReviewRow>
                    {autoApply && (
                      <ReviewRow label={t("step4.autoApply")}>✓</ReviewRow>
                    )}
                    {earlyBird && (
                      <ReviewRow label={t("step4.earlyBird")}>✓</ReviewRow>
                    )}
                    {campaignId && (
                      <ReviewRow label={t("step4.attachCampaign")}>
                        {campaigns.find((c) => c.id === campaignId)?.name ?? "—"}
                      </ReviewRow>
                    )}
                    {minOrder && Number(minOrder) > 0 && (
                      <ReviewRow label={t("step4.minOrder")}>
                        <Money amount={Number(minOrder)} decimals={0} />
                      </ReviewRow>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface-card)] flex items-center justify-between gap-3`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            {t("cancel")}
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, (s - 1) as Step) as Step)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] flex items-center gap-1.5"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {t("back")}
              </button>
            )}
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, (s + 1) as Step) as Step)}
                disabled={!stepValid[step]}
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-95 flex items-center gap-1.5"
              >
                {t("next")}
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSubmit || saving}
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:opacity-95 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? t("save") : t("create")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReviewRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <dt className="text-[var(--color-text-secondary)] font-medium">{label}</dt>
    <dd className="text-[var(--color-text-primary)] text-end font-medium">{children}</dd>
  </>
);

export default CreateCouponWizard;
