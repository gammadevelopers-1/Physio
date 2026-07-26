"use client";

/**
 * 5-step bulk-generation wizard.
 *
 *   1 — Batch (count, prefix, code-pattern preview)
 *   2 — Discount (type + value, shared across the batch)
 *   3 — Scope    (all / specific courses)
 *   4 — Settings (max uses per code, per-user, expires, auto-apply / early-bird, campaign)
 *   5 — Preview  (10 sample codes + summary + Generate)
 *
 * On success, the response includes a downloadable CSV of all generated
 * codes. Persists into the `discount_code_batches` table so finance can
 * audit each batch's redemption rate later.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Loader2,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Megaphone,
  Tag,
  Download,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { discountApi, publicApi } from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/admin-dashboard/Select";

interface SimpleCourse {
  id: string;
  title: string;
  thumbnail?: string | null;
  price?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sampleSuffix() {
  let s = "";
  for (let i = 0; i < 6; i++)
    s += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return s;
}

const BulkGenerateWizard = ({ open, onClose, onGenerated }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.bulkWizard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState("20");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<"all" | "specific">("all");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courses, setCourses] = useState<SimpleCourse[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [maxUsesPer, setMaxUsesPer] = useState("1");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [validUntil, setValidUntil] = useState("");
  const [autoApply, setAutoApply] = useState(false);
  const [earlyBird, setEarlyBird] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [previewSamples, setPreviewSamples] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setPrefix("");
    setCount("20");
    setType("percentage");
    setValue("");
    setScope("all");
    setCourseIds([]);
    setMaxUsesPer("1");
    setPerUserLimit("1");
    setValidUntil("");
    setAutoApply(false);
    setEarlyBird(false);
    setCampaignId("");
    setPreviewSamples([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (courses.length === 0) {
      (async () => {
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
                };
                return {
                  id: cc.id,
                  title: cc.title || cc.titleEn || cc.titleAr || t("untitledCourse"),
                  thumbnail: cc.thumbnail || null,
                  price: Number(cc.price ?? 0),
                };
              }),
            );
          }
        } catch {}
      })();
    }
    if (campaigns.length === 0) {
      (async () => {
        try {
          const res = await discountApi.listCampaigns({ status: "active", limit: 50 });
          if (res?.data) {
            setCampaigns(res.data.map((c) => ({ id: c.id, name: c.name })));
          }
        } catch {}
      })();
    }
  }, [open, courses.length, campaigns.length]);

  // Build previews when entering step 5
  useEffect(() => {
    if (step === 5) {
      const upperPrefix = prefix.toUpperCase().trim();
      const samples: string[] = [];
      for (let i = 0; i < Math.min(10, Number(count) || 0); i++) {
        samples.push(upperPrefix ? `${upperPrefix}-${sampleSuffix()}` : sampleSuffix());
      }
      setPreviewSamples(samples);
    }
  }, [step, prefix, count]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [courses, courseSearch]);

  const countNum = Number(count);
  const valueNum = Number(value);
  const step1Valid =
    countNum >= 1 && countNum <= 100 && prefix.trim().length >= 2;
  const step2Valid =
    Number.isFinite(valueNum) &&
    valueNum > 0 &&
    (type !== "percentage" || valueNum <= 100);
  const step3Valid = scope === "all" || courseIds.length > 0;
  const step4Valid = Number(maxUsesPer) >= 1 && Number(perUserLimit) >= 1;

  const stepValid: Record<Step, boolean> = {
    1: step1Valid,
    2: step2Valid,
    3: step3Valid,
    4: step4Valid,
    5: true,
  };
  const canSubmit = step1Valid && step2Valid && step3Valid && step4Valid;

  const stepDefs: Array<{ key: Step; label: string; icon: typeof Tag }> = [
    { key: 1, label: t("steps.batch"), icon: Layers },
    { key: 2, label: t("steps.discount"), icon: Tag },
    { key: 3, label: t("steps.scope"), icon: ShieldCheck },
    { key: 4, label: t("steps.settings"), icon: Sparkles },
    { key: 5, label: t("steps.preview"), icon: Check },
  ];

  const downloadCsv = (codes: string[], batchPrefix: string) => {
    const csv = ["Code", ...codes].join("\r\n");
    // Leading BOM keeps Excel in UTF-8 mode even if a code ever contains non-ASCII.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchPrefix.toLowerCase()}-codes-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await discountApi.bulkGenerate({
        prefix: prefix.toUpperCase().trim(),
        count: countNum,
        type,
        value: valueNum,
        maxUses: Number(maxUsesPer),
        maxUsesPerUser: Number(perUserLimit),
        validUntil: validUntil || undefined,
        autoApply,
        earlyBird,
        campaignId: campaignId || undefined,
        courseIds:
          scope === "specific" && courseIds.length > 0 ? courseIds : undefined,
      });
      toast.success(t("generatedToast", { n: res.created }));
      if (res.codes && res.codes.length > 0) {
        downloadCsv(res.codes, prefix);
      }
      onGenerated();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : (t("genericError") as string),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface-page)] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-card)] flex items-center justify-between">
          <div className={`flex items-center gap-3`}>
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("title")}
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

        <div className={`flex-1 flex overflow-hidden`}>
          <div className="w-56 bg-[var(--color-surface-card)] border-r border-[var(--color-border-subtle)] py-5 px-3 hidden md:flex md:flex-col gap-1">
            {stepDefs.map((s, idx) => {
              const Icon = s.icon;
              const active = s.key === step;
              const done = s.key < step;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(s.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-start ${
                    active
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : done
                        ? "bg-[#DCFCE7] text-[#16A34A]"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step1.prefix")}
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      placeholder="SUMMER"
                      maxLength={20}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      {t("step1.prefixHint")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step1.count")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      {t("step1.countHint")}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)]">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-2">
                    {t("step1.previewLabel")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-md bg-[var(--color-surface-page)] font-mono text-xs text-[var(--color-text-primary)] font-bold text-center"
                      >
                        {prefix.toUpperCase() || "PREFIX"}-{sampleSuffix()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step2.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step2.hint")}
                  </p>
                </div>

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
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t(opt === "percentage" ? "step2.percentage" : "step2.fixed")}
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {type === "percentage" ? t("step2.percentValue") : t("step2.amountValue")}
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
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                    {t("step3.heading")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("step3.hint")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xl">
                  {(["all", "specific"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setScope(opt)}
                      className={`p-4 rounded-xl border-2 text-start ${
                        scope === opt
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-[var(--color-border)]"
                      }`}
                    >
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t(opt === "all" ? "step3.all" : "step3.specific")}
                      </span>
                    </button>
                  ))}
                </div>

                {scope === "specific" && (
                  <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                        <input
                          type="text"
                          value={courseSearch}
                          onChange={(e) => setCourseSearch(e.target.value)}
                          placeholder={t("step3.searchPlaceholder")}
                          className="w-full ps-9 pe-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {filteredCourses.map((c) => {
                        const checked = courseIds.includes(c.id);
                        // Free courses can't take a coupon (bulk-generated
                        // codes are still coupons). Grey out + block, matching
                        // the single-coupon wizard behaviour.
                        const isFree = (c.price ?? 0) <= 0;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            disabled={isFree}
                            title={
                              isFree ? t("step3.freeCourseCannotBeAdded") : undefined
                            }
                            onClick={() => {
                              if (isFree) return;
                              setCourseIds((prev) =>
                                checked ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                              );
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-start border-b border-[var(--color-border-subtle)] last:border-b-0 ${
                              isFree
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-[var(--color-surface-page)]"
                            }`}
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
                            <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">{c.title}</span>
                            {isFree && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#166534] uppercase tracking-wide flex-shrink-0">
                                {t("step3.freeBadge")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step4.maxUsesPer")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUsesPer}
                      onChange={(e) => setMaxUsesPer(e.target.value)}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      {t("step4.maxUsesPerHint")}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("step4.perUser")}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={perUserLimit}
                      onChange={(e) => setPerUserLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {t("step4.expiresAt")}
                  </label>
                  <DatePicker value={validUntil} onChange={setValidUntil} />
                </div>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-[var(--color-text-primary)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                      {t("step4.autoApply")}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">
                      {t("step4.autoApplyHint")}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={earlyBird}
                    onChange={(e) => setEarlyBird(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-[var(--color-text-primary)]">{t("step4.earlyBird")}</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">
                      {t("step4.earlyBirdHint")}
                    </span>
                  </span>
                </label>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1.5 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5" />
                    {t("step4.campaign")}
                  </label>
                  <Select
                    value={campaignId}
                    onChange={setCampaignId}
                    options={[
                      { value: "", label: t("step4.noCampaign") },
                      ...campaigns.map((c) => ({ value: c.id, label: c.name })),
                    ]}
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

                <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-2">
                    {t("step5.sampleCodes")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {previewSamples.map((s) => (
                      <div
                        key={s}
                        className="px-3 py-2 rounded-md bg-[var(--color-surface-card)] font-mono text-xs text-[var(--color-text-primary)] font-bold text-center"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-3">
                    {t("step5.samplesNote", { n: countNum })}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)]">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <dt className="text-[var(--color-text-secondary)]">{t("step5.count")}</dt>
                    <dd className="text-[var(--color-text-primary)] text-end font-medium">{count}</dd>
                    <dt className="text-[var(--color-text-secondary)]">{t("step5.discount")}</dt>
                    <dd className="text-[var(--color-text-primary)] text-end font-medium">
                      {type === "percentage" ? `${value}%` : `SAR ${value}`}
                    </dd>
                    <dt className="text-[var(--color-text-secondary)]">{t("step5.scope")}</dt>
                    <dd className="text-[var(--color-text-primary)] text-end font-medium">
                      {scope === "all" ? t("step3.all") : t("step5.nCourses", { n: courseIds.length })}
                    </dd>
                    {validUntil && (
                      <>
                        <dt className="text-[var(--color-text-secondary)]">{t("step5.expires")}</dt>
                        <dd className="text-[var(--color-text-primary)] text-end font-medium">{validUntil}</dd>
                      </>
                    )}
                    {(autoApply || earlyBird || campaignId) && (
                      <>
                        <dt className="text-[var(--color-text-secondary)]">{t("step5.flags")}</dt>
                        <dd className="text-[var(--color-text-primary)] text-end font-medium">
                          {[
                            autoApply && t("step5.flagAuto"),
                            earlyBird && t("step5.flagEarlyBird"),
                            campaignId && t("step5.flagCampaign"),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>

                <p className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  {t("step5.downloadNote")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={`px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface-card)] flex items-center justify-between gap-3`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {t("cancel")}
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, (s - 1) as Step) as Step)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium flex items-center gap-1.5"
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
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
              >
                {t("next")}
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || saving}
                className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("generate", { n: countNum || 0 })}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkGenerateWizard;
