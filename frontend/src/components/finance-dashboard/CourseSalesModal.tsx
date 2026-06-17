"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { discountApi, CourseSaleItem } from "@/lib/api";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { fromRiyadhLocal, toRiyadhLocal } from "@/lib/riyadh-time";

/**
 * Finance-dashboard surface for managing course-level sales (no coupon required).
 * Sales are a pricing/promotion decision owned by finance — set/clear a percentage
 * off per course, with an optional Riyadh-time window and a "may a coupon stack on
 * top of this sale" toggle. The backend (DiscountsController course-sales routes)
 * is the authority; this is display + edit only.
 */
export default function CourseSalesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CourseSaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Editor fields (one course at a time)
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
        toast.error(t("discountsPage.sales.loadError") || "Failed to load courses");
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (open) load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search while the modal is open
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => load(search), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
      toast.success(
        clear
          ? t("discountsPage.sales.removed") || "Sale removed"
          : t("discountsPage.sales.saved") || "Sale saved",
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(msg || t("discountsPage.sales.saveError") || "Failed to save sale");
    } finally {
      setSavingId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("discountsPage.sales.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("discountsPage.sales.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-border-subtle)]"
            aria-label={t("discountsPage.sales.cancel") || "Close"}
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search
              className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("discountsPage.sales.searchPlaceholder")}
              className={`w-full h-10 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm outline-none focus:border-[var(--color-primary)]`}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-text-secondary)] py-10">
              {t("discountsPage.sales.empty")}
            </p>
          ) : (
            items.map((c) => (
              <div
                key={c.id}
                className="border border-[var(--color-border)] rounded-xl p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {isRTL && c.titleAr ? c.titleAr : c.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-2 mt-1 text-xs">
                      {c.onSale ? (
                        <>
                          <span className="font-semibold text-[var(--color-primary)]">
                            SAR {c.effectivePrice}
                          </span>
                          <span className="line-through text-[var(--color-text-secondary)]">
                            SAR {c.price}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold">
                            {t("discountsPage.sales.percentOff", { percent: c.salePercent ?? 0 })}
                          </span>
                        </>
                      ) : c.salePercent ? (
                        <span className="text-[var(--color-text-secondary)]">
                          {t("discountsPage.sales.scheduledOrInactive", { percent: c.salePercent })}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">
                          SAR {c.price} · {t("discountsPage.sales.noSale")}
                        </span>
                      )}
                    </div>
                  </div>
                  {editingId !== c.id && (
                    <button
                      onClick={() => beginEdit(c)}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]"
                    >
                      {c.salePercent
                        ? t("discountsPage.sales.edit")
                        : t("discountsPage.sales.setSale")}
                    </button>
                  )}
                </div>

                {editingId === c.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("discountsPage.sales.percentLabel")}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={percent}
                        onChange={(e) => setPercent(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface)]"
                      />
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                        {t("discountsPage.sales.percentHint")}
                      </p>
                    </div>
                    <label className="flex items-start gap-2 sm:pt-6 text-sm text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={allowsCoupon}
                        onChange={(e) => setAllowsCoupon(e.target.checked)}
                        className="mt-0.5 w-4 h-4"
                      />
                      {t("discountsPage.sales.allowCoupon")}
                    </label>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("discountsPage.sales.startsLabel")}
                        <span className="ms-1 font-normal">
                          ({isRTL ? "بتوقيت الرياض" : "Riyadh time"})
                        </span>
                      </label>
                      <DateTimePicker
                        id={`sale-start-${c.id}`}
                        value={startsAt}
                        onChange={setStartsAt}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        {t("discountsPage.sales.endsLabel")}
                        <span className="ms-1 font-normal">
                          ({isRTL ? "بتوقيت الرياض" : "Riyadh time"})
                        </span>
                      </label>
                      <DateTimePicker
                        id={`sale-end-${c.id}`}
                        value={endsAt}
                        onChange={setEndsAt}
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1">
                      {c.salePercent ? (
                        <button
                          onClick={() => save(c.id, true)}
                          disabled={savingId === c.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("discountsPage.sales.removeSale")}
                        </button>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
                        >
                          {t("discountsPage.sales.cancel")}
                        </button>
                        <button
                          onClick={() => save(c.id)}
                          disabled={savingId === c.id}
                          className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-lg btn-gold text-white disabled:opacity-50"
                        >
                          {savingId === c.id && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          {t("discountsPage.sales.save")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
