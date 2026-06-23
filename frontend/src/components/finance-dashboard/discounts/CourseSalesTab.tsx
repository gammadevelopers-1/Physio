"use client";

/**
 * Course Sales tab — promoted out of the header button into a first-class
 * destination. Lists every course with its current sale state. Click a row
 * to expand the in-place editor (percent + Riyadh-time window + stack-with-
 * coupon toggle). Save persists via the existing `course-sales/:courseId`
 * endpoint.
 *
 * Visual layout matches the other tabs (toolbar + card list with rich
 * status pills). No coupon code involved.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Search,
  Loader2,
  Trash2,
  Percent,
  Calendar,
  Tag,
  Sparkles,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { discountApi, type CourseSaleItem } from "@/lib/api";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { fromRiyadhLocal, toRiyadhLocal } from "@/lib/riyadh-time";
import Money from "../shared/Money";
import { FINANCE_COLORS } from "../shared/financeColors";

const CourseSalesTab = () => {
  const t = useTranslations("financeDashboard.discountsPage.courseSalesTab");
  const tShared = useTranslations("financeDashboard.discountsPage.sales");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CourseSaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "live" | "scheduled" | "none">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [percent, setPercent] = useState("");
  const [allowsCoupon, setAllowsCoupon] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const data = await discountApi.listCourseSales(q || undefined);
        setItems(data);
      } catch {
        toast.error(tShared("loadError"));
      } finally {
        setLoading(false);
      }
    },
    [tShared],
  );

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    const id = setTimeout(() => load(search), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  const beginEdit = (c: CourseSaleItem) => {
    setEditingId(c.id);
    setPercent(c.salePercent != null ? String(c.salePercent) : "");
    setAllowsCoupon(c.saleAllowsCoupon);
    setStartsAt(c.saleStartsAt ? toRiyadhLocal(c.saleStartsAt) : "");
    setEndsAt(c.saleEndsAt ? toRiyadhLocal(c.saleEndsAt) : "");
  };

  const save = async (courseId: string, clear = false) => {
    setSavingId(courseId);
    try {
      const payload = clear
        ? {
            salePercent: null,
            saleStartsAt: null,
            saleEndsAt: null,
            saleAllowsCoupon: false,
          }
        : {
            salePercent: percent ? Number(percent) : null,
            saleStartsAt: startsAt ? fromRiyadhLocal(startsAt) : null,
            saleEndsAt: endsAt ? fromRiyadhLocal(endsAt) : null,
            saleAllowsCoupon: allowsCoupon,
          };
      const updated = await discountApi.setCourseSale(courseId, payload);
      setItems((prev) => prev.map((c) => (c.id === courseId ? updated : c)));
      setEditingId(null);
      toast.success(clear ? tShared("removed") : tShared("saved"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg || tShared("saveError"));
    } finally {
      setSavingId(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isRTL ? "ar-SA-u-nu-latn" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const inactiveReason = (c: CourseSaleItem): string => {
    const now = Date.now();
    const pct = c.salePercent ?? 0;
    if (c.saleStartsAt && now < new Date(c.saleStartsAt).getTime())
      return tShared("startsOn", { percent: pct, date: fmtDate(c.saleStartsAt) });
    if (c.saleEndsAt && now >= new Date(c.saleEndsAt).getTime())
      return tShared("endedOn", { percent: pct, date: fmtDate(c.saleEndsAt) });
    if (c.price <= 0) return tShared("freeNoEffect");
    return tShared("inactive", { percent: pct });
  };

  const filtered = items.filter((c) => {
    if (filter === "live") return c.onSale;
    if (filter === "scheduled") {
      return (
        c.salePercent !== null &&
        c.saleStartsAt &&
        new Date(c.saleStartsAt).getTime() > Date.now()
      );
    }
    if (filter === "none") return c.salePercent === null;
    return true;
  });

  const liveCount = items.filter((c) => c.onSale).length;
  const totalSavings = items
    .filter((c) => c.onSale)
    .reduce((sum, c) => sum + (c.price - c.effectivePrice), 0);

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile
          label={t("kpi.liveSales")}
          value={liveCount}
          icon={Percent}
          color={FINANCE_COLORS.success}
        />
        <KpiTile
          label={t("kpi.totalConfigured")}
          value={items.filter((c) => c.salePercent !== null).length}
          icon={Tag}
          color={FINANCE_COLORS.info}
        />
        <KpiTile
          label={t("kpi.avgSavings")}
          value={<Money amount={totalSavings} decimals={0} className="text-2xl font-bold" />}
          icon={Sparkles}
          color={FINANCE_COLORS.warning}
        />
      </div>

      {/* Toolbar */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
        <div className={`flex flex-col lg:flex-row lg:items-center gap-3`}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tShared("searchPlaceholder")}
              className="w-full ps-9 pe-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5">
            {(["all", "live", "scheduled", "none"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
                  filter === f
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {t(`filter.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 flex items-center gap-3 animate-pulse"
            >
              <div className="w-14 h-14 rounded-lg bg-[var(--color-border-subtle)] flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[var(--color-border-subtle)] rounded w-2/3" />
                <div className="h-2.5 bg-[var(--color-border-subtle)] rounded w-1/3" />
              </div>
              <div className="h-8 w-24 bg-[var(--color-border-subtle)] rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 text-center">
          <Percent className="w-12 h-12 mx-auto text-[var(--color-text-secondary)]/40 mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{tShared("empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex items-center gap-3 flex-1">
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnail}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[var(--color-surface-page)] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {isRTL && c.titleAr ? c.titleAr : c.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-2 mt-1 text-xs">
                      {c.onSale ? (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-[#16A34A] text-white font-bold text-[10px] uppercase">
                            {tShared("liveBadge")}
                          </span>
                          <span className="font-semibold text-[var(--color-primary)]">
                            <Money amount={c.effectivePrice} decimals={0} />
                          </span>
                          <span className="line-through text-[var(--color-text-secondary)]">
                            <Money amount={c.price} decimals={0} />
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#DC2626] text-white font-bold text-[10px]">
                            {tShared("percentOff", { percent: c.salePercent ?? 0 })}
                          </span>
                          {c.saleEndsAt && (
                            <span className="text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {tShared("endsOn", { date: fmtDate(c.saleEndsAt) })}
                            </span>
                          )}
                        </>
                      ) : c.salePercent ? (
                        <span className="text-[#D97706] font-medium">{inactiveReason(c)}</span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">
                          <Money amount={c.price} decimals={0} /> · {tShared("noSale")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {editingId !== c.id && (
                  <button
                    onClick={() => beginEdit(c)}
                    className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 ${
                      c.salePercent
                        ? "bg-[var(--color-surface-page)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
                        : "bg-[var(--color-primary)] text-white hover:opacity-90"
                    }`}
                  >
                    {c.salePercent ? (
                      <>{tShared("edit")}</>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> {tShared("setSale")}
                      </>
                    )}
                  </button>
                )}
              </div>

              {editingId === c.id && (
                <div className="px-5 pb-5 border-t border-[var(--color-border-subtle)] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {tShared("percentLabel")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      placeholder="25"
                      className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm outline-none focus:border-[var(--color-primary)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      {tShared("percentHint")}
                    </p>
                  </div>
                  <label className="flex items-start gap-2 sm:pt-6 text-sm text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={allowsCoupon}
                      onChange={(e) => setAllowsCoupon(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[var(--color-primary)]"
                    />
                    {tShared("allowCoupon")}
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {tShared("startsLabel")}
                    </label>
                    <DateTimePicker id={`sale-start-${c.id}`} value={startsAt} onChange={setStartsAt} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {tShared("endsLabel")}
                    </label>
                    <DateTimePicker id={`sale-end-${c.id}`} value={endsAt} onChange={setEndsAt} />
                  </div>
                  <p className="sm:col-span-2 text-[11px] text-[var(--color-text-secondary)] -mt-1">
                    {tShared("immediateHint")}
                  </p>
                  <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1">
                    {c.salePercent ? (
                      <button
                        onClick={() => save(c.id, true)}
                        disabled={savingId === c.id}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg text-[#B91C1C] hover:bg-[#FEE2E2] disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {tShared("removeSale")}
                      </button>
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]"
                      >
                        {tShared("cancel")}
                      </button>
                      <button
                        onClick={() => save(c.id)}
                        disabled={savingId === c.id}
                        className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50"
                      >
                        {savingId === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {tShared("save")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const KpiTile = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Tag;
  color: { bg: string; text: string };
}) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
    <div className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-5 h-5 ${color.text}`} />
    </div>
    <div>
      <p className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</p>
    </div>
  </div>
);

export default CourseSalesTab;
